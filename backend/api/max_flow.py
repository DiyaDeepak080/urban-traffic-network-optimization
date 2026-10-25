from fastapi import APIRouter, HTTPException
from models.schemas import MaxFlowRequest
from services import dataset_service as ds
from services import optimization_service as opt
from services import results_service as results

router = APIRouter(prefix="/api", tags=["max-flow"])


@router.post("/max-flow")
@router.post("/max-flow/solve")
def compute_max_flow(req: MaxFlowRequest):
    try:
        ds.get_state()
    except (ds.DatasetNotLoadedError, ds.DatasetValidationError):
        raise HTTPException(status_code=400, detail="Dataset has not been processed yet.")

    if req.destination is None and req.sink is None:
        raise HTTPException(status_code=400, detail="destination (or sink) is required.")

    dest = req.destination if req.destination is not None else req.sink

    try:
        result = opt.solve_max_flow(req.source, dest, req.hour)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except opt.DisconnectedError as e:
        raise HTTPException(status_code=422, detail=str(e))

    results.record_result(
        technique="Maximum Flow",
        hour=req.hour,
        source=req.source,
        destination=dest,
        result_summary=(
            f"Flow {result['max_flow']:.2f} veh/hr | "
            f"Min-cut {result['min_cut_value']:.2f} | "
            f"{result['num_bottlenecks']} bottleneck(s)"
        ),
        parameters={"source": req.source, "destination": dest, "hour": req.hour},
        payload=result,
    )
    return result
