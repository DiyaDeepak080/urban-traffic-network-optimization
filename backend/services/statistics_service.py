"""Statistics Service: descriptive statistics computed on-demand from train.csv."""

from . import dataset_service as ds


def generate_statistics():
    st = ds.get_state()
    df = st.raw_df
    traffic = df["traffic"]

    by_hour = df.groupby("hour")["traffic"].mean().sort_index()
    by_location = df.groupby("location")["traffic"].mean().sort_index()

    hist_counts, hist_edges = _histogram(traffic.values, bins=20)

    return {
        "total_observations": int(len(df)),
        "num_intersections": int(df["location"].nunique()),
        "num_hours": int(df["hour"].nunique()),
        "mean_traffic": float(traffic.mean()),
        "min_traffic": float(traffic.min()),
        "max_traffic": float(traffic.max()),
        "std_traffic": float(traffic.std()),
        "traffic_by_hour": [{"hour": int(h), "avg_traffic": float(v)} for h, v in by_hour.items()],
        "traffic_by_intersection": [
            {"location": int(loc), "avg_traffic": float(v)} for loc, v in by_location.items()
        ],
        "traffic_distribution": [
            {"bin_start": float(hist_edges[i]), "bin_end": float(hist_edges[i + 1]), "count": int(hist_counts[i])}
            for i in range(len(hist_counts))
        ],
    }


def _histogram(values, bins=20):
    import numpy as np
    counts, edges = np.histogram(values, bins=bins)
    return counts, edges
