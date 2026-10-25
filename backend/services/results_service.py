"""
Results Service
================
Stores every successful optimization run in-memory (process lifetime).
For a production deployment this would be backed by a database, but for
this application's scope an in-memory store satisfies "results persistence
across pages within a session" per the requirements.
"""

import itertools
from datetime import datetime, timezone

_results = []
_id_counter = itertools.count(1)


def record_result(technique: str, hour: int, source=None, destination=None, result_summary: str = "",
                   status: str = "success", parameters=None, payload=None):
    entry = {
        "id": next(_id_counter),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "technique": technique,
        "hour": hour,
        "source": source,
        "destination": destination,
        "result": result_summary,
        "status": status,
        "parameters": parameters or {},
        "payload": payload or {},
    }
    _results.insert(0, entry)
    return entry


def list_results(technique: str = None):
    if technique and technique != "all":
        return [r for r in _results if r["technique"] == technique]
    return list(_results)


def get_result(result_id: int):
    for r in _results:
        if r["id"] == result_id:
            return r
    return None


def clear_results():
    _results.clear()
