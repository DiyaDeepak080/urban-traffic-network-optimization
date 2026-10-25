from fastapi import APIRouter, HTTPException, Query
from services import dataset_service as ds
import networkx as nx
import math

router = APIRouter(prefix="/api", tags=["network"])


def _layout_positions(G):
    """Deterministic circular layout so the frontend can render consistent coordinates."""
    n = G.number_of_nodes()
    positions = {}
    for idx, node in enumerate(sorted(G.nodes())):
        angle = 2 * math.pi * idx / n
        positions[node] = {"x": round(math.cos(angle), 4), "y": round(math.sin(angle), 4)}
    return positions


@router.get("/network")
def get_network(hour: int = Query(1, ge=1, le=24)):
    try:
        st = ds.get_state()
    except (ds.DatasetNotLoadedError, ds.DatasetValidationError):
        raise HTTPException(status_code=400, detail="Dataset has not been processed yet.")

    if hour not in st.hours:
        raise HTTPException(status_code=400, detail=f"Invalid hour. Available hours: {st.hours}")

    positions = _layout_positions(st.G)

    nodes = []
    for node in sorted(st.G.nodes()):
        nodes.append({
            "id": node,
            "label": f"Node {node}",
            "traffic": float(st.T.loc[node, hour]),
            "no_roads": float(st.no_roads[node]),
            "degree": st.G.degree[node],
            "x": positions[node]["x"],
            "y": positions[node]["y"],
        })

    edges = []
    for u, v in st.G.edges():
        w = ds.edge_weight(u, v, hour)
        edges.append({"from": u, "to": v, "weight": w})

    components = list(nx.connected_components(st.G))

    return {
        "hour": hour,
        "nodes": nodes,
        "edges": edges,
        "num_nodes": st.num_nodes,
        "num_edges": st.G.number_of_edges(),
        "num_connected_components": len(components),
    }


@router.get("/network/{node_id}")
def get_node_detail(node_id: int, hour: int = Query(1, ge=1, le=24)):
    try:
        st = ds.get_state()
    except (ds.DatasetNotLoadedError, ds.DatasetValidationError):
        raise HTTPException(status_code=400, detail="Dataset has not been processed yet.")

    if not (0 <= node_id < st.num_nodes):
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found.")
    if hour not in st.hours:
        raise HTTPException(status_code=400, detail=f"Invalid hour. Available hours: {st.hours}")

    neighbors = sorted(st.G.neighbors(node_id))

    return {
        "id": node_id,
        "label": f"Node {node_id}",
        "hour": hour,
        "traffic": float(st.T.loc[node_id, hour]),
        "no_roads": float(st.no_roads[node_id]),
        "degree": st.G.degree[node_id],
        "connected_nodes": neighbors,
        "traffic_all_hours": [
            {"hour": h, "traffic": float(st.T.loc[node_id, h])} for h in st.hours
        ],
    }
