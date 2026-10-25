import PageHeader from '../components/PageHeader'

const SECTIONS = [
  {
    title: '1. Problem Definition',
    body: `The project applies two Operations Research network optimization techniques to an urban traffic network to support decisions about routing and throughput under time-varying congestion:
• Time-Dependent Shortest Path (Dijkstra's algorithm)
• Maximum Flow (Boykov-Kolmogorov algorithm)`,
  },
  {
    title: '2. Dataset',
    body: `The application uses three dataset files:
- **train.csv** — Contains traffic observations for 36 intersections across 24 hourly periods, along with location-related features.
- **adj_matrix.csv** — A (36 × 36) binary adjacency matrix describing which intersections are directly connected by a road. This file remains unchanged.
- **edge_capacity.csv** — Stores road capacities at the edge level, with each row representing a unique undirected road and its capacity in vehicles per hour per direction.`,
  },
  {
    title: '3. Data Preprocessing',
    body: `Each row of train.csv carries a one-hot encoding across columns hour_1..hour_24. The active column is converted into a single integer hour (1-24) per row. Rows are then grouped by (location, hour) and the mean of the traffic column is taken, producing a 36 × 24 traffic table T[location, hour]. Any missing (location, hour) combinations are imputed with the column-wise mean, then with 0.0 as a final fallback.`,
  },
  {
    title: '4. Network Representation',
    body: `The network is represented as an undirected graph with one node per intersection (0 through 35). An edge exists between node i and node j if and only if adj_matrix[i][j] == 1 (43 undirected edges). The graph topology is static across all hours; only edge weights vary with the selected hour (for shortest path). Road capacities are static physical attributes loaded directly from edge_capacity.csv.`,
  },
  {
    title: '5. Traffic Aggregation',
    body: `T[location, hour] is the arithmetic mean of all traffic observations recorded for that intersection during that hour across the dataset. This produces an expected congestion baseline for each hour of the day, smoothing localized stochastic fluctuations.`,
  },
  {
    title: '6. Edge Weight (Shortest Path)',
    body: `The time-dependent traversal cost for edge (i, j) at hour h is a modeled traffic-related cost:

  w(i, j, h) = (T[i, h] + T[j, h]) / ((no_roads[i] + no_roads[j]) / 2)

The numerator sums the congestion at both endpoints; the denominator averages the road count (no_roads) available at both endpoints. Higher congestion increases cost; higher road count reduces it. Weights are neither travel times nor geographic distances; they are dimensionless modeled costs reflecting relative congestion load. All weights are guaranteed finite and ≥ 0.`,
  },
  {
    title: '7. Shortest Path (Dijkstra)',
    body: `Given a source, destination, and hour, all edges are assigned their hour-specific modeled cost weight and Dijkstra's algorithm (networkx.dijkstra_path) computes the minimum-cost path. The displayed total cost is the exact sum of edge weights along the returned path. Invalid nodes, source == destination, invalid hours, and disconnected graphs are caught before the algorithm runs and returned as descriptive error messages.`,
  },
  {
    title: '8. Maximum Flow (Boykov-Kolmogorov)',
    body: `Given a source, destination, and hour, a capacitated directed graph is built:
  • Each undirected road (u, v) from adj_matrix.csv gives two directed arcs: u→v and v→u (86 arcs total)
  • Both directed arcs carry the stored physical capacity directly from edge_capacity.csv:
      arc_capacity(u→v) = arc_capacity(v→u) = edge_capacity(u, v)   [veh/hr/dir]

The Boykov-Kolmogorov algorithm (networkx.algorithms.flow.boykov_kolmogorov) computes the maximum flow value and per-arc flow assignment.

Validation performed before returning:
  1. Valid source and destination nodes (0–35, distinct)
  2. Valid hour (1–24)
  3. Source and destination are in the same connected component
  4. All arc capacities are present, finite, and > 0

Outputs include: flow value, per-edge flow and capacity, utilization (flow/capacity), min-cut edges, min-cut capacity, max-flow = min-cut verification, and flow conservation check at all intermediate nodes.`,
  },
  {
    title: '9. Utilization and Bottleneck Analysis',
    body: `For each undirected road segment:
  utilization(u, v) = max(flow(u→v), flow(v→u)) / edge_capacity(u, v)   [dimensionless, 0..1]

An edge is classified as a bottleneck if:
  • It is a min-cut edge (crosses from the source-side to the sink-side of the minimum cut partition), OR
  • Its net flow equals its stored capacity within numerical tolerance (saturated arc, utilization ≥ 99.9%, flow > 0).

The minimum cut is computed using the same Boykov-Kolmogorov flow function. The Max-Flow Min-Cut theorem is mathematically verified on every run by checking |flow_value - cut_value| < 1e-6.`,
  },
  {
    title: '10. Assumptions',
    body: `• Road capacities are loaded directly from edge_capacity.csv and represent static physical carrying limits.
• The directed flow network uses a symmetric model: each physical road has the same capacity in both directions (shared by u→v and v→u arcs).
• Shortest path edge weights are modeled traffic-related costs, not geographic travel times.
• The network topology is static; only shortest path edge weights vary by hour.
• Traffic congestion at an edge is approximated as the average of its two endpoint traffic values.`,
  },
  {
    title: '11. Limitations',
    body: `• A single source-sink pair is modeled per max-flow query; real urban networks have many concurrent origin-destination trips with competing demand.
• The symmetric capacity model treats each road as equally traversable in both directions, which may not reflect real one-way or asymmetric road segments.
• The unit-length assumption for shortest path ignores real geographic Euclidean distances between intersections.
• Hourly aggregation smooths within-hour variability and may understate peak-minute congestion spikes.`,
  },
]

export default function Methodology() {
  return (
    <div>
      <PageHeader title="Methodology" subtitle="Mathematical formulation of the models implemented in this application." />
      <div className="space-y-6 max-w-3xl">
        {SECTIONS.map((s) => (
          <div key={s.title} className="card p-5">
            <div className="section-label mb-2">{s.title}</div>
            <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
