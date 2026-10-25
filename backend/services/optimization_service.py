"""
Optimization Service
=====================
Implements two network optimization techniques over the existing 36-node
urban traffic dataset:

  1. Time-Dependent Shortest Path (Dijkstra)
     - Edge weight: w(i,j,h) = modeled traffic-related cost (see dataset_service)
     - Algorithm: networkx.dijkstra_path

  2. Maximum Flow (Boykov-Kolmogorov via networkx)
     - Each undirected edge becomes two directed arcs (u->v and v->u)
     - Capacity on each arc = stored capacity from train.csv (veh/hr/dir)
     - Algorithm: networkx.maximum_flow with flow_func=boykov_kolmogorov
     - Includes min-cut, flow conservation check, utilization, bottleneck detection

No mathematical formulation is changed for Shortest Path; max-flow now uses
stored capacities from train.csv instead of the old congestion-decay formula.
"""

import math
import networkx as nx
import networkx.algorithms.flow as nxf
from . import dataset_service as ds


class NoPathError(Exception):
    pass


class DisconnectedError(Exception):
    pass


def validate_nodes(source: int, sink: int, num_nodes: int):
    if source == sink:
        raise ValueError("Source and destination must be distinct.")
    if not (0 <= source < num_nodes) or not (0 <= sink < num_nodes):
        raise ValueError(f"Node ids must be within 0 to {num_nodes - 1}.")


def validate_connectivity(G, source: int, sink: int):
    # Works for both Graph and DiGraph
    if isinstance(G, nx.DiGraph):
        uG = G.to_undirected()
    else:
        uG = G
    source_component = nx.node_connected_component(uG, source)
    if sink not in source_component:
        raise DisconnectedError(
            f"Source node {source} and destination node {sink} are in different "
            f"connected components. The selected network is disconnected between them."
        )


def validate_hour(hour: int, valid_hours: list):
    if hour not in valid_hours:
        raise ValueError(f"Invalid hour {hour}. Must be one of {valid_hours}.")


# ---------------------------------------------------------------------------
# Time-Dependent Shortest Path (Dijkstra)
# ---------------------------------------------------------------------------
def solve_shortest_path(source: int, destination: int, hour: int):
    st = ds.get_state()
    validate_nodes(source, destination, st.num_nodes)
    validate_hour(hour, st.hours)
    validate_connectivity(st.G, source, destination)

    G = ds.weighted_graph_for_hour(hour)

    # Verify all weights are finite and >= 0
    for u, v in G.edges():
        w = G[u][v]["weight"]
        if not math.isfinite(w) or w < 0:
            raise ValueError(f"Edge ({u},{v}) has invalid weight {w}; cannot run Dijkstra.")

    try:
        path = nx.dijkstra_path(G, source=source, target=destination, weight="weight")
    except nx.NetworkXNoPath:
        raise NoPathError(f"No path exists between node {source} and node {destination}.")

    total_cost = sum(G[path[k]][path[k + 1]]["weight"] for k in range(len(path) - 1))
    edges = [
        {
            "from": path[k],
            "to": path[k + 1],
            "weight": G[path[k]][path[k + 1]]["weight"],
        }
        for k in range(len(path) - 1)
    ]

    return {
        "source": source,
        "destination": destination,
        "hour": hour,
        "path": path,
        "edges": edges,
        "hops": len(path) - 1,
        "total_cost": total_cost,
        "weight_formula": "w(i,j,h) = (T[i,h] + T[j,h]) / ((no_roads[i] + no_roads[j]) / 2)",
        "weight_description": "Modeled traffic-related cost: higher congestion increases cost, higher road count reduces it.",
    }


# ---------------------------------------------------------------------------
# Maximum Flow (Boykov-Kolmogorov via networkx)
# ---------------------------------------------------------------------------
FLOW_ALGORITHM = "Boykov-Kolmogorov"


def solve_max_flow(source: int, destination: int, hour: int):
    """
    Compute maximum flow from source to destination using stored capacities
    from train.csv.

    Capacity model
    --------------
    For each undirected edge (u, v):
      stored_cap(u, v) = (loc_capacity[u] + loc_capacity[v]) / 2   [veh/hr/dir]
    The directed graph has arcs u->v and v->u, both with stored_cap(u,v).

    Algorithm: Boykov-Kolmogorov (networkx.algorithms.flow.boykov_kolmogorov)

    Returns
    -------
    flow_value, per-edge flow and capacity, utilization, min-cut, bottlenecks,
    flow conservation check at intermediate nodes.
    """
    st = ds.get_state()
    validate_nodes(source, destination, st.num_nodes)
    validate_hour(hour, st.hours)
    validate_connectivity(st.G, source, destination)

    # Build directed graph with stored capacities
    DG = ds.capacity_directed_graph()

    # Validate all capacities are present and valid
    for u, v, data in DG.edges(data=True):
        cap = data.get("capacity")
        if cap is None:
            raise ValueError(f"Missing capacity on arc ({u},{v}).")
        if not math.isfinite(cap) or cap <= 0:
            raise ValueError(f"Invalid capacity {cap} on arc ({u},{v}).")

    # Compute maximum flow using Boykov-Kolmogorov algorithm
    flow_value, flow_dict = nx.maximum_flow(
        DG, source, destination,
        capacity="capacity",
        flow_func=nxf.boykov_kolmogorov,
    )

    # Minimum cut (max-flow min-cut theorem validation)
    cut_value, partition = nx.minimum_cut(
        DG, source, destination,
        capacity="capacity",
        flow_func=nxf.boykov_kolmogorov,
    )

    # Verify max-flow == min-cut (within tolerance)
    flow_cut_match = abs(flow_value - cut_value) < 1e-6

    # Min-cut edges: arcs crossing from source-side to sink-side of partition
    reachable, non_reachable = partition
    min_cut_edges = []
    min_cut_capacity = 0.0
    for u in reachable:
        for v in non_reachable:
            if DG.has_edge(u, v):
                cap = DG[u][v]["capacity"]
                min_cut_edges.append({"from": u, "to": v, "capacity": cap})
                min_cut_capacity += cap

    # Build per-edge table over the undirected graph edges
    edge_table = []
    bottlenecks = []
    bottleneck_edges = []

    for u, v in st.G.edges():
        cap = ds.edge_capacity(u, v)   # stored capacity (symmetric)
        f_uv = flow_dict[u].get(v, 0.0)
        f_vu = flow_dict[v].get(u, 0.0)
        net_flow = max(f_uv, f_vu)     # net flow on the undirected road
        utilization = net_flow / cap if cap > 0 else 0.0

        # Bottleneck: min-cut edge OR saturated (flow ≈ capacity, flow > 0)
        is_bottleneck_saturation = cap > 0 and abs(net_flow - cap) < 1e-6 and net_flow > 1e-6
        is_bottleneck_mincut = any(
            (e["from"] == u and e["to"] == v) or (e["from"] == v and e["to"] == u)
            for e in min_cut_edges
        )
        is_bottleneck = is_bottleneck_saturation or is_bottleneck_mincut

        if f_uv >= f_vu:
            flow_from, flow_to = u, v
        else:
            flow_from, flow_to = v, u

        status = (
            "Bottleneck" if is_bottleneck
            else ("Flow-carrying" if net_flow > 1e-6 else "Unused")
        )

        edge_info = {
            "from": flow_from if net_flow > 1e-6 else u,
            "to": flow_to if net_flow > 1e-6 else v,
            "capacity": cap,
            "flow": net_flow,
            "utilization": utilization,
            "is_bottleneck": is_bottleneck,
            "status": status,
        }
        edge_table.append(edge_info)

        if is_bottleneck:
            bottlenecks.append([flow_from, flow_to])
            bottleneck_edges.append(edge_info)

    edge_table.sort(key=lambda e: e["utilization"], reverse=True)

    # Flow conservation check at intermediate nodes
    conservation_violations = []
    for node in range(st.num_nodes):
        if node == source or node == destination:
            continue
        inflow = sum(flow_dict[u].get(node, 0.0) for u in DG.predecessors(node))
        outflow = sum(flow_dict[node].get(v, 0.0) for v in DG.successors(node))
        if abs(inflow - outflow) > 1e-6:
            conservation_violations.append({
                "node": node, "inflow": inflow, "outflow": outflow,
                "imbalance": inflow - outflow
            })

    flow_edges = [e for e in edge_table if e["flow"] > 1e-6]

    return {
        "source": source,
        "sink": destination,
        "destination": destination,
        "hour": hour,
        # Flow results
        "maximum_flow": flow_value,
        "max_flow": flow_value,
        "flow_unit": "vehicles/hour/direction",
        # Edge details
        "flow_edges": flow_edges,
        "edges": edge_table,
        # Bottlenecks
        "bottleneck_edges": bottleneck_edges,
        "bottlenecks": bottlenecks,
        "num_bottlenecks": len(bottlenecks),
        # Min cut
        "min_cut_value": cut_value,
        "min_cut_edges": min_cut_edges,
        "min_cut_capacity": min_cut_capacity,
        # Validation
        "flow_equals_min_cut": flow_cut_match,
        "conservation_violations": conservation_violations,
        "num_conservation_violations": len(conservation_violations),
        # Methodology
        "capacity_model": (
            "Stored capacity from edge_capacity.csv (veh/hr/dir). "
            "Directed graph: each undirected road gives u->v and v->u arcs "
            "with equal stored capacity (symmetric model)."
        ),
        "algorithm": FLOW_ALGORITHM,
        "algorithm_detail": "networkx.algorithms.flow.boykov_kolmogorov",
        "status": "Optimal / Converged",
    }
