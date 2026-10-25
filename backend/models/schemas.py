from pydantic import BaseModel, model_validator
from typing import Optional


class ShortestPathRequest(BaseModel):
    source: int
    destination: int
    hour: int


class MaxFlowRequest(BaseModel):
    source: int
    destination: Optional[int] = None
    sink: Optional[int] = None
    hour: int

    @model_validator(mode="before")
    @classmethod
    def reconcile_sink_and_destination(cls, data):
        if isinstance(data, dict):
            sink = data.get("sink")
            dest = data.get("destination")
            if sink is not None and dest is None:
                data["destination"] = sink
            elif dest is not None and sink is None:
                data["sink"] = dest
        return data
