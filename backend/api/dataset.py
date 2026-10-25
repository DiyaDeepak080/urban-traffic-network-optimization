from fastapi import APIRouter, HTTPException, UploadFile, File
from services import dataset_service as ds

router = APIRouter(prefix="/api/dataset", tags=["dataset"])


@router.post("/upload")
async def upload_dataset_file(file_type: str, file: UploadFile = File(...)):
    """
    Replaces train.csv or adj_matrix.csv on disk with an uploaded file of the
    same name/shape, then re-validates. file_type must be 'train' or 'adjacency'.
    The dataset is NOT reprocessed automatically; call /api/dataset/process next.
    """
    if file_type not in ("train", "adjacency", "capacity", "edge_capacity"):
        raise HTTPException(status_code=400, detail="file_type must be 'train', 'adjacency', or 'capacity'")

    if file_type == "train":
        target_path = ds.TRAIN_CSV_PATH
    elif file_type == "adjacency":
        target_path = ds.ADJ_MATRIX_CSV_PATH
    else:
        target_path = ds.EDGE_CAPACITY_CSV_PATH

    contents = await file.read()
    with open(target_path, "wb") as f:
        f.write(contents)

    return {
        "file_type": file_type,
        "filename": file.filename,
        "size_bytes": len(contents),
        "message": "File uploaded. Call /api/dataset/process to validate and load it.",
    }


@router.get("/status")
def dataset_status():
    try:
        st = ds.get_state()
    except ds.DatasetNotLoadedError as e:
        return {
            "loaded": False,
            "message": str(e),
        }
    except ds.DatasetValidationError as e:
        return {
            "loaded": False,
            "message": str(e),
            "issues": e.details,
        }

    import networkx as nx
    components = list(nx.connected_components(st.G))

    # Capacity info
    has_capacity = bool(st.edge_capacities)
    cap_info = {}
    if has_capacity:
        cap_vals = list(st.edge_capacities.values())
        cap_info = {
            "has_capacity": True,
            "capacity_unit": "vehicles/hour/direction",
            "capacity_encoding": "edge-level capacity from edge_capacity.csv",
            "capacity_min": float(min(cap_vals)),
            "capacity_max": float(max(cap_vals)),
            "capacity_mean": float(sum(cap_vals) / len(cap_vals)),
            "num_edges_with_capacity": len(cap_vals),
        }
    else:
        cap_info = {"has_capacity": False}

    return {
        "loaded": True,
        "train_csv": st.train_meta,
        "adj_matrix_csv": st.adj_meta,
        "edge_capacity_csv": st.edge_cap_meta,
        "num_nodes": st.num_nodes,
        "num_hours": len(st.hours),
        "hours": st.hours,
        "num_edges": st.G.number_of_edges(),
        "num_connected_components": len(components),
        "num_records": int(len(st.raw_df)),
        "validation": st.validation_report,
        "capacity_info": cap_info,
    }


@router.get("/summary")
def dataset_summary():
    try:
        st = ds.get_state()
    except (ds.DatasetNotLoadedError, ds.DatasetValidationError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    avg_traffic = float(st.raw_df["traffic"].mean())
    import networkx as nx
    components = list(nx.connected_components(st.G))

    return {
        "num_intersections": st.num_nodes,
        "num_hours": len(st.hours),
        "num_edges": st.G.number_of_edges(),
        "num_records": int(len(st.raw_df)),
        "avg_traffic": avg_traffic,
        "num_connected_components": len(components),
        "is_fully_connected": len(components) == 1,
    }


@router.post("/process")
def process_dataset():
    """Re-loads/re-processes the dataset from disk (forces cache refresh)."""
    try:
        ds.load_dataset(force=True)
    except ds.DatasetValidationError as e:
        raise HTTPException(status_code=400, detail={"message": str(e), "issues": e.details})
    except ds.DatasetNotLoadedError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return dataset_status()


@router.get("/validation")
def dataset_validation():
    try:
        st = ds.get_state()
    except (ds.DatasetNotLoadedError, ds.DatasetValidationError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return st.validation_report


@router.get("/preview")
def dataset_preview(n_rows: int = 10):
    """
    Returns the first n_rows of train.csv as a list of records,
    including the capacity column. Used by the Data Management page.
    """
    try:
        st = ds.get_state()
    except (ds.DatasetNotLoadedError, ds.DatasetValidationError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    if n_rows < 1 or n_rows > 100:
        raise HTTPException(status_code=400, detail="n_rows must be between 1 and 100.")

    # Show key columns including capacity
    display_cols = ["location", "traffic", "no_roads", "capacity", "timestep"]
    hour_cols_present = [c for c in ["hour_1", "hour_2", "hour_3"] if c in st.raw_df.columns]
    cols = [c for c in display_cols + hour_cols_present if c in st.raw_df.columns]

    preview_df = st.raw_df[cols].head(n_rows)
    records = preview_df.to_dict(orient="records")

    # Round floats for display
    for rec in records:
        for k, v in rec.items():
            if isinstance(v, float):
                rec[k] = round(v, 6)

    return {
        "columns": cols,
        "rows": records,
        "total_rows": len(st.raw_df),
        "capacity_column_present": "capacity" in st.raw_df.columns,
    }
