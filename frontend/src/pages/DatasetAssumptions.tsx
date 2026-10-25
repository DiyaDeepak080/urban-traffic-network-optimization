import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { api } from '../services/api'
import type { DatasetStatus } from '../types'

export default function DatasetAssumptions() {
  const [status, setStatus] = useState<DatasetStatus | null>(null)

  useEffect(() => {
    api.datasetStatus().then(setStatus).catch(() => {})
  }, [])

  return (
    <div>
      <PageHeader title="Dataset & Assumptions" subtitle="What the existing dataset contains, and how observed data differs from derived, modeled, and optimization results." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Intersections" value={status?.num_nodes ?? '—'} />
        <StatCard label="Hourly Periods" value={status?.num_hours ?? '—'} />
        <StatCard label="Network Edges" value={status?.num_edges ?? '—'} />
        <StatCard label="Traffic Records" value={status?.num_records?.toLocaleString() ?? '—'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="section-label mb-3">Dataset Files</div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-300 font-mono text-xs">train.csv</dt>
              <dd className="text-slate-500 text-xs mt-1">
                Per-observation traffic readings for each of the 36 intersections, with one-hot
                hour columns (hour_1..hour_24), an intersection road-count column (no_roads), and auxiliary
                engineered features.
              </dd>
            </div>
            <div>
              <dt className="text-slate-300 font-mono text-xs">adj_matrix.csv</dt>
              <dd className="text-slate-500 text-xs mt-1">
                A 36 × 36 binary adjacency matrix. Entry adj[i][j] = 1 indicates a direct road
                corridor connecting intersection i and intersection j (43 undirected edges).
              </dd>
            </div>
            <div>
              <dt className="text-slate-300 font-mono text-xs">edge_capacity.csv</dt>
              <dd className="text-slate-500 text-xs mt-1">
                Direct edge-level physical capacity (vehicles/hour/direction) for all 43 road segments,
                used directly by the Maximum Flow algorithm.
              </dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <div className="section-label mb-3">Dataset Characteristics</div>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>• 36 intersections / nodes</li>
            <li>• 24 hourly traffic periods</li>
            <li>• 43 undirected road segments (86 directed flow arcs)</li>
            <li>• Traffic measurements aggregated by (intersection, hour)</li>
            <li>• Adjacency-based connected network topology</li>
          </ul>
        </div>

        <div className="card p-5">
          <div className="section-label mb-3">Data Categories</div>
          <dl className="space-y-3 text-sm">
            <CategoryRow label="Observed" desc="Raw traffic time-series and road counts recorded in train.csv." />
            <CategoryRow label="Physical Capacities" desc="Per-edge throughput limits recorded in edge_capacity.csv (vehicles/hour/direction)." />
            <CategoryRow label="Derived" desc="The hourly traffic matrix T[location, hour] and per-node connectivity attributes." />
            <CategoryRow label="Optimization Results" desc="Dynamic shortest paths and maximum flow values with min-cut bottleneck verification." />
          </dl>
        </div>

        <div className="card p-5">
          <div className="section-label mb-3">Assumptions</div>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>• Unit-length roads: shortest-path impedance reflects congestion relative to intersection capacity.</li>
            <li>• Static topology: the physical road network connectivity is constant across time.</li>
            <li>• Hourly aggregation: raw time-step data is averaged per (intersection, hour).</li>
            <li>• Symmetric road capacity: physical capacity applies equally in both directions on each link.</li>
            <li>• Stored capacities: Max Flow uses explicit physical capacities from edge_capacity.csv without synthetic decay.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function CategoryRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div>
      <dt className="text-slate-300 text-xs font-medium">{label}</dt>
      <dd className="text-slate-500 text-xs mt-0.5">{desc}</dd>
    </div>
  )
}
