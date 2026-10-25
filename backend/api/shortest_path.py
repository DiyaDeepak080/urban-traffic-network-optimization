from fastapi import APIRouter, HTTPException
from models.schemas import ShortestPathRequest
from services import dataset_service as ds
from services import optimization_service as opt
from services import results_service as results

router = APIRouter(prefix="/api", tags=["shortest-path"])


@router.post("/shortest-path")
def compute_shortest_path(req: ShortestPathRequest):
    try:
        ds.get_state()
    except (ds.DatasetNotLoadedError, ds.DatasetValidationError):
        raise HTTPException(status_code=400, detail="Dataset has not been processed yet.")

    try:
        result = opt.solve_shortest_path(req.source, req.destination, req.hour)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except opt.DisconnectedError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except opt.NoPathError as e:
        raise HTTPException(status_code=422, detail=str(e))

    path_str = " -> ".join(str(n) for n in result["path"])
    results.record_result(
        technique="Shortest Path",
        hour=req.hour,
        source=req.source,
        destination=req.destination,
        result_summary=f"Cost {result['total_cost']:.4f} | {result['hops']} hops",
        parameters={"source": req.source, "destination": req.destination, "hour": req.hour},
        payload=result,
    )
    return result
