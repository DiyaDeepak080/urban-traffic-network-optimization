from fastapi import APIRouter, HTTPException, Query
from services import results_service as results

router = APIRouter(prefix="/api", tags=["results"])


@router.get("/results")
def get_results(technique: str = Query("all")):
    return {"results": results.list_results(technique)}


@router.get("/results/{result_id}")
def get_result(result_id: int):
    r = results.get_result(result_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Result not found.")
    return r
