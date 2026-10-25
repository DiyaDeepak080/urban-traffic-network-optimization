"""
Dataset Service
================
Loads train.csv, adj_matrix.csv, and edge_capacity.csv.
Builds the traffic table T[location, hour], the no_roads series, and the undirected
NetworkX graph. Loaded once and cached in memory (module-level singleton) so that
API requests do not re-read CSV files on every call.

Data Model:
- locations are 0..35 (36 intersections)
- hours are 1..24 (derived from one-hot hour_1..hour_24 columns in train.csv)
- no_roads is constant per location (from train.csv)
- the graph is undirected, built from adj_matrix.csv where adj[i][j] == 1
- edge capacity is stored per undirected road link in edge_capacity.csv
"""

import os
import threading
import numpy as np
import pandas as pd
import networkx as nx

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAIN_CSV_PATH = os.path.join(BASE_DIR, "dataset", "train.csv")
ADJ_MATRIX_CSV_PATH = os.path.join(BASE_DIR, "dataset", "adj_matrix.csv")
EDGE_CAPACITY_CSV_PATH = os.path.join(BASE_DIR, "dataset", "edge_capacity.csv")

HOUR_COLS = [f"hour_{h}" for h in range(1, 25)]


class DatasetNotLoadedError(Exception):
    pass


class DatasetValidationError(Exception):
    def __init__(self, message, details=None):
        super().__init__(message)
        self.details = details or []


class _DatasetState:
    """Module-level singleton holding the processed dataset + graph."""

    def __init__(self):
        self.lock = threading.Lock()
        self.loaded = False
        self.raw_df = None
        self.T = None  # DataFrame: index=location (0..35), columns=hour (1..24)
        self.no_roads = None  # Series indexed by location
        self.edge_capacities = {}  # Dict: (min(u,v), max(u,v)) -> float capacity
        self.loc_capacity = None  # Series indexed by location (mean incident edge capacity)
        self.G = None  # networkx.Graph (topology only, no weights yet)
        self.num_nodes = 0
        self.hours = []
        self.validation_report = None
        self.train_path = TRAIN_CSV_PATH
        self.adj_path = ADJ_MATRIX_CSV_PATH
        self.edge_cap_path = EDGE_CAPACITY_CSV_PATH
        self.train_meta = None  # {filename, size_bytes}
        self.adj_meta = None
        self.edge_cap_meta = None


_state = _DatasetState()


def _file_meta(path):
    if not os.path.exists(path):
        return None
    return {
        "filename": os.path.basename(path),
        "size_bytes": os.path.getsize(path),
    }


def validate_train_csv(df: pd.DataFrame):
    issues = []
    warnings = []

    required_base_cols = ["location", "traffic", "no_roads"]
    missing_base = [c for c in required_base_cols if c not in df.columns]
    if missing_base:
        issues.append(f"Missing required columns: {missing_base}")

    missing_hours = [c for c in HOUR_COLS if c not in df.columns]
    if missing_hours:
        issues.append(f"Missing hour one-hot columns: {missing_hours}")

    duplicate_count = int(df.duplicated().sum())
    if duplicate_count > 0:
        warnings.append(f"{duplicate_count} duplicate rows detected")

    missing_values = int(df.isnull().sum().sum())
    if missing_values > 0:
        warnings.append(f"{missing_values} missing values detected")

    if "traffic" in df.columns:
        negative_traffic = int((df["traffic"] < 0).sum()) if pd.api.types.is_numeric_dtype(df["traffic"]) else 0
        if negative_traffic > 0:
            warnings.append(f"{negative_traffic} negative traffic values detected")

    if "location" in df.columns:
        num_locations = int(df["location"].nunique())
    else:
        num_locations = 0

    return {
        "issues": issues,
        "warnings": warnings,
        "duplicate_count": duplicate_count,
        "missing_values": missing_values,
        "num_locations": num_locations,
        "num_rows": int(len(df)),
    }


def validate_adj_matrix(adj_df: pd.DataFrame):
    issues = []
    warnings = []

    n_rows, n_cols = adj_df.shape
    is_square = n_rows == n_cols
    if not is_square:
        issues.append(f"Adjacency matrix is not square: {n_rows} rows x {n_cols} cols")

    values = adj_df.values
    is_binary = bool(np.isin(values, [0, 1]).all())
    if not is_binary:
        issues.append("Adjacency matrix contains non-binary values")

    is_symmetric = bool(is_square and np.array_equal(values, values.T))
    if not is_symmetric:
        warnings.append("Adjacency matrix is not perfectly symmetric")

    diagonal_ok = bool(np.all(np.diag(values) == 0)) if is_square else False
    if not diagonal_ok:
        warnings.append("Adjacency matrix has non-zero diagonal entries (self-loops)")

    return {
        "issues": issues,
        "warnings": warnings,
        "shape": [int(n_rows), int(n_cols)],
        "is_symmetric": is_symmetric,
        "diagonal_ok": diagonal_ok,
    }


def validate_edge_capacity_csv(edge_df: pd.DataFrame, G: nx.Graph):
    issues = []
    warnings = []

    required_cols = ["source", "destination", "capacity"]
    missing = [c for c in required_cols if c not in edge_df.columns]
    if missing:
        issues.append(f"Missing required columns in edge_capacity.csv: {missing}")
        return {"issues": issues, "warnings": warnings}

    if not pd.api.types.is_numeric_dtype(edge_df["capacity"]):
        issues.append("capacity column in edge_capacity.csv is not numeric")
    elif (edge_df["capacity"] <= 0).any():
        issues.append("capacity column in edge_capacity.csv contains non-positive values")

    # Check coverage of network edges
    provided_edges = set()
    for _, row in edge_df.iterrows():
        try:
            u, v = int(row["source"]), int(row["destination"])
            provided_edges.add((min(u, v), max(u, v)))
        except (ValueError, TypeError):
            issues.append(f"Invalid edge endpoints in edge_capacity.csv: {row}")

    network_edges = { (min(u, v), max(u, v)) for u, v in G.edges() }
    missing_edges = network_edges - provided_edges
    if missing_edges:
        issues.append(f"edge_capacity.csv is missing {len(missing_edges)} roads from adj_matrix.csv: {sorted(list(missing_edges))[:5]}")

    return {
        "issues": issues,
        "warnings": warnings,
        "num_edges": len(edge_df),
        "covers_all_network_edges": len(missing_edges) == 0,
    }


def load_dataset(force: bool = False):
    """
    Loads and preprocesses the dataset (train.csv, adj_matrix.csv, edge_capacity.csv).
    Idempotent: only reloads if not already loaded or force=True.
    """
    with _state.lock:
        if _state.loaded and not force:
            return _state

        if not os.path.exists(TRAIN_CSV_PATH):
            raise DatasetNotLoadedError(f"train.csv not found at {TRAIN_CSV_PATH}")
        if not os.path.exists(ADJ_MATRIX_CSV_PATH):
            raise DatasetNotLoadedError(f"adj_matrix.csv not found at {ADJ_MATRIX_CSV_PATH}")
        if not os.path.exists(EDGE_CAPACITY_CSV_PATH):
            raise DatasetNotLoadedError(f"edge_capacity.csv not found at {EDGE_CAPACITY_CSV_PATH}")

        df = pd.read_csv(TRAIN_CSV_PATH)
        train_validation = validate_train_csv(df)
        if train_validation["issues"]:
            raise DatasetValidationError("train.csv failed validation", train_validation["issues"])

        # STEP 1: derive integer hour (1-24) from one-hot hour_1..hour_24 columns
        df["hour"] = (
            df[HOUR_COLS].idxmax(axis=1).str.replace("hour_", "", regex=False).astype(int)
        )

        # STEP 2: T[location, hour] = mean traffic per (location, hour)
        T = df.pivot_table(index="location", columns="hour", values="traffic", aggfunc="mean")
        T = T.fillna(T.mean()).fillna(0.0)
        T.index = T.index.astype(int)
        T.columns = T.columns.astype(int)

        # STEP 3: no_roads per location (constant per location; first observed value)
        no_roads = df.groupby("location")["no_roads"].first()

        # STEP 4: adjacency matrix -> undirected graph
        adj_df = pd.read_csv(ADJ_MATRIX_CSV_PATH, index_col=0)
        adj_validation = validate_adj_matrix(adj_df)
        if adj_validation["issues"]:
            raise DatasetValidationError("adj_matrix.csv failed validation", adj_validation["issues"])

        num_nodes = len(adj_df)
        G = nx.Graph()
        for node in range(num_nodes):
            G.add_node(node)

        for i in range(num_nodes):
            for j in range(i + 1, num_nodes):
                if adj_df.iloc[i, j] == 1:
                    G.add_edge(i, j)

        components = list(nx.connected_components(G))

        # STEP 5: load and validate edge_capacity.csv
        edge_cap_df = pd.read_csv(EDGE_CAPACITY_CSV_PATH)
        edge_cap_validation = validate_edge_capacity_csv(edge_cap_df, G)
        if edge_cap_validation["issues"]:
            raise DatasetValidationError("edge_capacity.csv failed validation", edge_cap_validation["issues"])

        edge_capacities = {}
        for _, row in edge_cap_df.iterrows():
            u = int(row["source"])
            v = int(row["destination"])
            cap = float(row["capacity"])
            edge_capacities[(min(u, v), max(u, v))] = cap

        # Compute location-level average incident capacity for convenience/backward compatibility
        loc_cap_dict = {}
        for node in range(num_nodes):
            incident_caps = [
                edge_capacities[(min(node, nbr), max(node, nbr))]
                for nbr in G.neighbors(node)
                if (min(node, nbr), max(node, nbr)) in edge_capacities
            ]
            loc_cap_dict[node] = float(np.mean(incident_caps)) if incident_caps else 0.0
        loc_capacity = pd.Series(loc_cap_dict)

        _state.raw_df = df
        _state.T = T
        _state.no_roads = no_roads
        _state.edge_capacities = edge_capacities
        _state.loc_capacity = loc_capacity
        _state.G = G
        _state.num_nodes = num_nodes
        _state.hours = sorted(int(h) for h in T.columns.tolist())
        _state.loaded = True
        _state.train_meta = _file_meta(TRAIN_CSV_PATH)
        _state.adj_meta = _file_meta(ADJ_MATRIX_CSV_PATH)
        _state.edge_cap_meta = _file_meta(EDGE_CAPACITY_CSV_PATH)
        _state.validation_report = {
            "train_csv": {**train_validation, "status": "passed" if not train_validation["warnings"] else "warning"},
            "adj_matrix": {**adj_validation, "status": "passed" if not adj_validation["warnings"] else "warning",
                           "connected_components": len(components)},
            "edge_capacity": {**edge_cap_validation, "status": "passed" if not edge_cap_validation["warnings"] else "warning"},
        }

        return _state


def get_state() -> _DatasetState:
    if not _state.loaded:
        load_dataset()
    return _state


def is_loaded() -> bool:
    return _state.loaded


def edge_weight(i: int, j: int, hour: int) -> float:
    """
    Modeled traffic-related cost for edge (i, j) at hour h:
      w(i, j, h) = (T[i,h] + T[j,h]) / ((no_roads[i] + no_roads[j]) / 2)

    The numerator sums the congestion at both endpoints; the denominator
    averages the road count (no_roads) at both endpoints.
    """
    st = get_state()
    numerator = st.T.loc[i, hour] + st.T.loc[j, hour]
    denominator = (st.no_roads[i] + st.no_roads[j]) / 2.0
    return float(numerator / denominator)


def weighted_graph_for_hour(hour: int) -> nx.Graph:
    """Returns a copy of the topology graph with 'weight' set for the given hour."""
    st = get_state()
    G = st.G.copy()
    for u, v in G.edges():
        G[u][v]["weight"] = edge_weight(u, v, hour)
    return G


def edge_capacity(i: int, j: int) -> float:
    """
    Stored capacity for edge (i, j) in vehicles/hour/direction loaded directly
    from edge_capacity.csv. Always > 0 and finite for valid edges.
    """
    st = get_state()
    key = (min(i, j), max(i, j))
    if key in st.edge_capacities:
        return float(st.edge_capacities[key])
    raise KeyError(f"No capacity defined for edge ({i}, {j}) in edge_capacity.csv")


def capacity_directed_graph() -> nx.DiGraph:
    """
    Returns a directed graph (DiGraph) with 'capacity' set on both
    u->v and v->u arcs for each undirected edge, using stored capacity
    from edge_capacity.csv.
    This is the graph used by the Maximum Flow solver.
    """
    st = get_state()
    DG = nx.DiGraph()
    DG.add_nodes_from(st.G.nodes())
    for u, v in st.G.edges():
        cap = edge_capacity(u, v)
        DG.add_edge(u, v, capacity=cap)
        DG.add_edge(v, u, capacity=cap)
    return DG
