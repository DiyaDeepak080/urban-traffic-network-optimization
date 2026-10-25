from fastapi import APIRouter, HTTPException
from services import dataset_service as ds
from services import statistics_service as stats

router = APIRouter(prefix="/api", tags=["statistics"])


@router.get("/statistics")
def get_statistics():
    try:
        ds.get_state()
    except (ds.DatasetNotLoadedError, ds.DatasetValidationError) as e:
        raise HTTPException(status_code=400, detail="Dataset has not been processed yet.")
    return stats.generate_statistics()
