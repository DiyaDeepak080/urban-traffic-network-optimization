"""
Urban Traffic Network Optimization - Backend
==============================================
FastAPI application implementing two OR algorithms (Dijkstra shortest
path, Boykov-Kolmogorov max flow) over the existing dataset
(train.csv, adj_matrix.csv). No new dataset is introduced; no algorithm is
rewritten. See services/dataset_service.py and services/optimization_service.py.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services import dataset_service as ds
from api import dataset, statistics, network, shortest_path, max_flow, results

app = FastAPI(
    title="Urban Traffic Network Optimization API",
    description=(
        "Operations Research decision-support backend: Time-Dependent Shortest Path "
        "and Maximum Flow over a 36-node urban traffic network. "
        "Max flow uses stored capacity values from train.csv (vehicles/hour/direction). "
        "Shortest path uses modeled traffic-related cost weights."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dataset.router)
app.include_router(statistics.router)
app.include_router(network.router)
app.include_router(shortest_path.router)
app.include_router(max_flow.router)
app.include_router(results.router)


@app.on_event("startup")
def _startup():
    # Load/preprocess the dataset once at startup and cache it in memory.
    try:
        ds.load_dataset()
    except Exception as e:
        # Do not crash the server if the dataset is temporarily missing/invalid;
        # /api/dataset/status will surface the problem and the Data Management
        # page lets the user re-upload and re-process.
        print(f"[startup] Dataset not loaded yet: {e}")


@app.get("/api/health")
def health():
    return {"status": "ok", "dataset_loaded": ds.is_loaded()}
