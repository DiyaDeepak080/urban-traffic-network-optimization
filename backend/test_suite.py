"""
test_suite.py
=============
Comprehensive test suite for the Urban Traffic Network Optimization project.
Covers dataset, shortest path, max flow, and integration checks.

Run with:  python test_suite.py
"""

import sys
import os
import math
import pandas as pd
import numpy as np
import networkx as nx
import networkx.algorithms.flow as nxf

# ---- Setup paths -------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

TRAIN_CSV = os.path.join(BASE_DIR, "dataset", "train.csv")
ADJ_CSV   = os.path.join(BASE_DIR, "dataset", "adj_matrix.csv")
EDGE_CAP_CSV = os.path.join(BASE_DIR, "dataset", "edge_capacity.csv")

PASS = 0
FAIL = 0

def ok(name):
    global PASS
    PASS += 1
    print(f"  [PASS] {name}")

def fail(name, msg=""):
    global FAIL
    FAIL += 1
    print(f"  [FAIL] {name}" + (f": {msg}" if msg else ""))

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

# ========================================================================
# SECTION 1: Dataset checks
# ========================================================================
section("1. Dataset Checks")

df = pd.read_csv(TRAIN_CSV)

# 1.1 capacity column removed from train.csv
if "capacity" not in df.columns:
    ok("1.1  `capacity` column successfully removed from train.csv")
else:
    fail("1.1  `capacity` column removal", "capacity column still present in train.csv")

# 1.2 row count unchanged (36 locations × 1261 records = 45396)
EXPECTED_ROWS = 45396
if len(df) == EXPECTED_ROWS:
    ok(f"1.2  Row count = {EXPECTED_ROWS}")
else:
    fail("1.2  Row count", f"expected {EXPECTED_ROWS}, got {len(df)}")

# 1.3 original columns intact (location, traffic, no_roads, hour_1..hour_24)
required_cols = ["location", "traffic", "no_roads"] + [f"hour_{h}" for h in range(1, 25)]
all_present = all(c in df.columns for c in required_cols)
no_nulls = df[required_cols].isnull().sum().sum() == 0
valid_traffic = (df["traffic"] >= 0).all() and (df["traffic"] <= 1.0).all()
if all_present and no_nulls and valid_traffic:
    ok("1.3  Original columns (location, traffic, no_roads, hour_1..24) intact and valid")
else:
    fail("1.3  Original columns", f"present={all_present}, no_nulls={no_nulls}, valid_traffic={valid_traffic}")

# 1.4 edge_capacity.csv exists and has correct columns
if os.path.exists(EDGE_CAP_CSV):
    edge_cap_df = pd.read_csv(EDGE_CAP_CSV)
    if set(["source", "destination", "capacity"]).issubset(set(edge_cap_df.columns)):
        ok("1.4  edge_capacity.csv exists with required columns (source, destination, capacity)")
    else:
        fail("1.4  edge_capacity.csv columns", f"columns: {list(edge_cap_df.columns)}")
else:
    fail("1.4  edge_capacity.csv exists", "file not found")

# 1.5 capacity values numeric, finite, > 0 in edge_capacity.csv
cap_vals = edge_cap_df["capacity"]
if pd.api.types.is_numeric_dtype(cap_vals) and np.isfinite(cap_vals.values).all() and (cap_vals > 0).all():
    ok("1.5  Edge capacity values: numeric, finite, > 0")
else:
    fail("1.5  Edge capacity values valid")

# 1.6 edge_capacity.csv row count matches 43 unique undirected edges in adj_matrix
adj = pd.read_csv(ADJ_CSV, index_col=0)
edges_in_adj = [(i, j) for i in range(36) for j in range(i+1, 36) if adj.iloc[i, j] == 1]
if len(edge_cap_df) == len(edges_in_adj):
    ok(f"1.6  edge_capacity.csv has {len(edge_cap_df)} rows (matches {len(edges_in_adj)} adj_matrix edges)")
else:
    fail("1.6  edge_capacity.csv edge count", f"expected {len(edges_in_adj)}, got {len(edge_cap_df)}")

# 1.7 all 36 locations present in train.csv
if df["location"].nunique() == 36:
    ok("1.7  All 36 locations present in train.csv")
else:
    fail("1.7  All 36 locations", f"found {df['location'].nunique()}")

# 1.8 adj_matrix unchanged
if adj.shape == (36, 36):
    ok("1.8  adj_matrix.csv shape unchanged (36x36)")
else:
    fail("1.8  adj_matrix.csv shape", f"got {adj.shape}")

# 1.9 all valid roads covered by edge_capacity.csv
provided_edges = set((min(int(r.source), int(r.destination)), max(int(r.source), int(r.destination))) for r in edge_cap_df.itertuples())
adj_edges_set = set((min(u, v), max(u, v)) for u, v in edges_in_adj)
missing_edge_caps = adj_edges_set - provided_edges
if not missing_edge_caps:
    ok(f"1.9  All {len(edges_in_adj)} adj-matrix edges covered by edge_capacity.csv")
else:
    fail("1.9  Edge-capacity coverage", f"{len(missing_edge_caps)} edges missing coverage")

# ========================================================================
# SECTION 2: Shortest Path Tests
# ========================================================================
section("2. Shortest Path Tests")

from services import dataset_service as ds
from services import optimization_service as opt

st = ds.load_dataset()

# 2.1 Small known-graph test
G_test = nx.Graph()
G_test.add_edge(0, 1, weight=1.0)
G_test.add_edge(1, 2, weight=1.0)
G_test.add_edge(0, 2, weight=10.0)  # direct but expensive
path = nx.dijkstra_path(G_test, 0, 2, weight="weight")
if path == [0, 1, 2]:
    ok("2.1  Small graph: Dijkstra chooses optimal path (0->1->2, not direct 0->2)")
else:
    fail("2.1  Small graph optimality", f"got path {path}")

# 2.2 total_cost = sum of edge weights
sp = opt.solve_shortest_path(0, 35, 12)
computed_cost = sum(sp["edges"][i]["weight"] for i in range(len(sp["edges"])))
if abs(sp["total_cost"] - computed_cost) < 1e-9:
    ok(f"2.2  total_cost ({sp['total_cost']:.6f}) = sum of edge weights")
else:
    fail("2.2  total_cost accuracy", f"total_cost={sp['total_cost']}, sum={computed_cost}")

# 2.3 all edge weights finite and >= 0
bad_weights = [e for e in sp["edges"] if not math.isfinite(e["weight"]) or e["weight"] < 0]
if not bad_weights:
    ok("2.3  All edge weights finite and >= 0")
else:
    fail("2.3  Edge weights valid", f"{len(bad_weights)} bad weights")

# 2.4 path reconstruction correct (connected)
path_nodes = sp["path"]
for i in range(len(path_nodes)-1):
    if not st.G.has_edge(path_nodes[i], path_nodes[i+1]):
        fail(f"2.4  Path reconstruction: edge ({path_nodes[i]},{path_nodes[i+1]}) not in graph")
        break
else:
    ok("2.4  Path reconstruction: all edges in graph topology")

# 2.5 invalid source == destination
try:
    opt.solve_shortest_path(5, 5, 12)
    fail("2.5  Same source/dest raises error")
except ValueError:
    ok("2.5  Same source/dest: raises ValueError")

# 2.6 invalid node
try:
    opt.solve_shortest_path(0, 100, 12)
    fail("2.6  Invalid node raises error")
except ValueError:
    ok("2.6  Invalid node: raises ValueError")

# 2.7 invalid hour
try:
    opt.solve_shortest_path(0, 35, 99)
    fail("2.7  Invalid hour raises error")
except ValueError:
    ok("2.7  Invalid hour: raises ValueError")

# 2.8 multiple hours give different results
costs = [opt.solve_shortest_path(0, 35, h)["total_cost"] for h in [1, 6, 12, 18, 24]]
if len(set(round(c,6) for c in costs)) > 1:
    ok("2.8  Time-dependency: different hours give different costs")
else:
    fail("2.8  Time-dependency", f"all costs same: {costs}")

# ========================================================================
# SECTION 3: Maximum Flow Tests
# ========================================================================
section("3. Maximum Flow Tests")

# 3.1 Hand-verifiable small graph test
# Triangle: 0->1 cap=100, 0->2 cap=50, 1->2 cap=60 (as undirected)
G_small = nx.DiGraph()
G_small.add_edge(0, 1, capacity=100.0)
G_small.add_edge(1, 0, capacity=100.0)
G_small.add_edge(0, 2, capacity=50.0)
G_small.add_edge(2, 0, capacity=50.0)
G_small.add_edge(1, 2, capacity=60.0)
G_small.add_edge(2, 1, capacity=60.0)
fv, _ = nx.maximum_flow(G_small, 0, 2, capacity="capacity", flow_func=nxf.boykov_kolmogorov)
cv, _ = nx.minimum_cut(G_small, 0, 2, capacity="capacity", flow_func=nxf.boykov_kolmogorov)
# max flow 0->2 = min(50+60, 100) considering paths: 0->2 (cap 50) + 0->1->2 (cap min(100,60)=60) = 110
# min cut: {0} -> {1,2} cuts (0->1)=100 and (0->2)=50, total 150 but that's not the min cut
# actual min cut: separate 1,2 from 0: cut = cap(0->1)+cap(0->2)=150... or separate 2 from 0,1: cut=(0->2)+(1->2)=50+60=110
if abs(fv - cv) < 1e-6:
    ok(f"3.1  Small graph: max-flow ({fv:.1f}) = min-cut ({cv:.1f})")
else:
    fail("3.1  Small graph max-flow = min-cut", f"flow={fv}, cut={cv}")

# 3.2 stored capacities used (not old formula)
mf = opt.solve_max_flow(0, 35, 12)
# Verify that edges in result have capacity matching the ds.edge_capacity function
cap_mismatch = []
for e in mf["edges"][:5]:
    u, v = e["from"], e["to"]
    expected_cap = ds.edge_capacity(u, v)
    if abs(e["capacity"] - expected_cap) > 0.01:
        cap_mismatch.append((u, v, e["capacity"], expected_cap))
if not cap_mismatch:
    ok("3.2  Edge capacities come from stored values (not old formula)")
else:
    fail("3.2  Stored capacities used", f"mismatches: {cap_mismatch}")

# 3.3 max-flow = min-cut
if mf["flow_equals_min_cut"]:
    ok(f"3.3  Max-flow ({mf['max_flow']:.2f}) = min-cut ({mf['min_cut_value']:.2f}) verified")
else:
    fail("3.3  Max-flow = min-cut", f"flow={mf['max_flow']}, cut={mf['min_cut_value']}")

# 3.4 flow conservation at intermediate nodes
if mf["num_conservation_violations"] == 0:
    ok("3.4  Flow conservation: 0 violations at intermediate nodes")
else:
    fail("3.4  Flow conservation", f"{mf['num_conservation_violations']} violations")

# 3.5 utilization = flow / capacity for all edges
util_errors = []
for e in mf["edges"]:
    if e["capacity"] > 0:
        expected_util = e["flow"] / e["capacity"]
        if abs(e["utilization"] - expected_util) > 1e-6:
            util_errors.append(e)
if not util_errors:
    ok("3.5  Utilization = flow / capacity for all edges")
else:
    fail("3.5  Utilization formula", f"{len(util_errors)} edges with wrong utilization")

# 3.6 bottlenecks are a subset of edges
bottleneck_set = {(e["from"], e["to"]) for e in mf["bottleneck_edges"]}
edge_set = {(e["from"], e["to"]) for e in mf["edges"]}
if bottleneck_set.issubset(edge_set) or len(bottleneck_set) == 0:
    ok("3.6  Bottleneck edges are subset of all edges")
else:
    fail("3.6  Bottleneck edges validity")

# 3.7 missing capacity error
try:
    opt.solve_max_flow(5, 5, 12)
    fail("3.7  Same source/dest raises error")
except ValueError:
    ok("3.7  Same source/dest: raises ValueError")

# 3.8 invalid node error
try:
    opt.solve_max_flow(0, 100, 12)
    fail("3.8  Invalid node raises error")
except ValueError:
    ok("3.8  Invalid node: raises ValueError")

# 3.9 invalid hour error
try:
    opt.solve_max_flow(0, 35, 99)
    fail("3.9  Invalid hour raises error")
except ValueError:
    ok("3.9  Invalid hour: raises ValueError")

# 3.10 algorithm name
if mf["algorithm"] == "Boykov-Kolmogorov":
    ok("3.10 Algorithm named 'Boykov-Kolmogorov'")
else:
    fail("3.10 Algorithm name", f"got {mf['algorithm']}")

# 3.11 flow_unit present
if mf.get("flow_unit"):
    ok(f"3.11 flow_unit present: '{mf['flow_unit']}'")
else:
    fail("3.11 flow_unit present")

# 3.12 min_cut_edges present and non-empty for non-trivial case
if isinstance(mf.get("min_cut_edges"), list) and len(mf["min_cut_edges"]) > 0:
    ok(f"3.12 min_cut_edges present ({len(mf['min_cut_edges'])} edge(s))")
else:
    fail("3.12 min_cut_edges present")

# ========================================================================
# SECTION 4: Integration Checks
# ========================================================================
section("4. Integration Checks")

# 4.1 No MST in optimization service
import importlib.util
spec = importlib.util.spec_from_file_location("opt_src", os.path.join(BASE_DIR, "services", "optimization_service.py"))
with open(os.path.join(BASE_DIR, "services", "optimization_service.py")) as f:
    opt_src = f.read()

if "solve_mst" not in opt_src and "compute_mst_stability" not in opt_src:
    ok("4.1  No MST functions in optimization_service.py")
else:
    fail("4.1  MST functions removed", "solve_mst or compute_mst_stability still present")

# 4.2 No MST router in main.py
with open(os.path.join(BASE_DIR, "main.py")) as f:
    main_src = f.read()
if "mst" not in main_src.lower():
    ok("4.2  No MST router import in main.py")
else:
    fail("4.2  MST removed from main.py", "mst still referenced")

# 4.3 dataset_service loads edge capacities
if hasattr(st, "edge_capacities") and bool(st.edge_capacities):
    ok("4.3  dataset_service loads edge_capacities from edge_capacity.csv")
else:
    fail("4.3  edge_capacities loaded")

# 4.4 edge_capacity function returns > 0 for all edges
bad_edges = [(u,v) for u,v in st.G.edges() if ds.edge_capacity(u,v) <= 0]
if not bad_edges:
    ok("4.4  All edge capacities > 0 (via ds.edge_capacity)")
else:
    fail("4.4  Edge capacities > 0", f"{len(bad_edges)} edges with cap <= 0")

# 4.5 DiGraph has correct structure
DG = ds.capacity_directed_graph()
if isinstance(DG, nx.DiGraph) and DG.number_of_nodes() == 36 and DG.number_of_edges() == 43 * 2:
    ok(f"4.5  capacity_directed_graph: DiGraph with 36 nodes, {43*2} arcs")
else:
    fail("4.5  capacity_directed_graph structure",
         f"nodes={DG.number_of_nodes()}, arcs={DG.number_of_edges()}")

# 4.6 capacity in train.csv is used (not old congestion decay formula)
# Old formula: cap = min(no_roads[u], no_roads[v]) / (1 + k * congestion)
# If we check a specific edge's capacity against the old formula output, they should differ
u, v = 0, 1
stored_cap = ds.edge_capacity(u, v)
no_roads_u = float(st.no_roads[u])
no_roads_v = float(st.no_roads[v])
old_base = min(no_roads_u, no_roads_v)
congestion = (float(st.T.loc[u, 12]) + float(st.T.loc[v, 12])) / 2.0
old_cap = old_base / (1.0 + 2.0 * congestion)
if abs(stored_cap - old_cap) > 0.1:
    ok(f"4.6  Stored capacity ({stored_cap:.2f}) differs from old formula ({old_cap:.4f}): correct")
else:
    fail("4.6  Old formula not in use", f"capacities are suspiciously similar: stored={stored_cap:.4f}, old={old_cap:.4f}")

# ========================================================================
# FINAL SUMMARY
# ========================================================================
print(f"\n{'='*60}")
print(f"  SUMMARY: {PASS} passed, {FAIL} failed")
print(f"{'='*60}")
if FAIL == 0:
    print("  ALL TESTS PASSED")
else:
    print(f"  {FAIL} TEST(S) FAILED")

sys.exit(0 if FAIL == 0 else 1)
