import { useEffect, useState } from 'react'
import {
  Waves, PlayCircle, Download, ArrowRight, ShieldAlert, CheckCircle2,
  Scissors, Activity, Info,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import NodeSelect from '../components/NodeSelect'
import NetworkGraph from '../components/NetworkGraph'
import ErrorBanner from '../components/ErrorBanner'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { useHour, formatHour } from '../hooks/useHour'
import { api } from '../services/api'
import type { MaxFlowResult, NetworkData } from '../types'

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function MaxFlow() {
  const { hour, setHour } = useHour()
  const [source, setSource] = useState(0)
  const [destination, setDestination] = useState(35)
  const [network, setNetwork] = useState<NetworkData | null>(null)
  const [result, setResult] = useState<MaxFlowResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.network(hour).then(setNetwork).catch(() => {})
  }, [hour])

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.maxFlow(source, destination, hour)
      setResult(res)
    } catch (e: any) {
      setError(e.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = () => {
    if (!result) return
    const rows: (string | number)[][] = [
      ['from', 'to', 'edge_capacity_veh_hr_dir', 'flow_veh_hr', 'utilization_pct', 'is_bottleneck', 'status']
    ]
    result.edges.forEach((e) =>
      rows.push([
        e.from,
        e.to,
        e.capacity.toFixed(2),
        e.flow.toFixed(2),
        (e.utilization * 100).toFixed(1) + '%',
        e.is_bottleneck ? 'yes' : 'no',
        e.status,
      ])
    )
    downloadCsv('maximum_flow_analysis.csv', rows)
  }

  const numNodes = network?.num_nodes ?? 36
  const numEdges = network?.num_edges ?? 43
  const flowCarryingCount = result ? result.edges.filter((e) => e.flow > 1e-4).length : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analysis Workspace"
        title="Maximum Flow"
        subtitle="Compute the maximum network throughput between source and destination using stored road capacities (vehicles/hour/direction), with min-cut analysis and bottleneck detection."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* LEFT COLUMN: Controls */}
        <div className="card p-5 h-fit space-y-4">
          <div className="section-label mb-1">Model Inputs</div>
          <NodeSelect
            label="Source Node"
            value={source}
            onChange={setSource}
            numNodes={numNodes}
            excludeValue={destination}
          />
          <NodeSelect
            label="Destination (Sink) Node"
            value={destination}
            onChange={setDestination}
            numNodes={numNodes}
            excludeValue={source}
          />
          <label className="block">
            <span className="text-xs text-slate-400 mb-1.5 block">Hourly Traffic Slice</span>
            <select
              id="max-flow-hour-select"
              className="input-field"
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)} / Hour {h}
                </option>
              ))}
            </select>
          </label>
          <button
            id="max-flow-run-btn"
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            onClick={run}
            disabled={loading}
          >
            <PlayCircle size={16} />
            {loading ? 'Computing Max Flow…' : 'Calculate Maximum Flow'}
          </button>

          <div className="pt-3 border-t border-border space-y-2 text-xs text-slate-500 leading-relaxed">
            <div className="font-semibold text-slate-400">Methodology:</div>
            <p>
              • Each undirected road gives two directed arcs with equal stored capacity (symmetric model).
            </p>
            <p>
              • Algorithm: <strong className="text-slate-300">Boykov-Kolmogorov</strong> (networkx).
            </p>
            <p>
              • Bottlenecks = min-cut edges and/or saturated arcs (flow ≈ capacity).
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Results & Visualization */}
        <div className="space-y-6">
          {error && <ErrorBanner message={error} />}

          {!result && !error && (
            <div className="card">
              <EmptyState
                icon={Waves}
                title="No Maximum Flow analysis run yet"
                description="Select a source node, destination node, and hourly traffic slice, then click Calculate Maximum Flow."
              />
            </div>
          )}

          {result && network && (
            <>
              {/* KPI Cards Row 1: Flow */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
                <FlowStatCard
                  label="Maximum Flow"
                  value={result.max_flow.toFixed(2)}
                  subtitle={result.flow_unit ?? 'veh/hr/dir'}
                  highlight
                />
                <FlowStatCard
                  label="Min-Cut Capacity"
                  value={result.min_cut_value.toFixed(2)}
                  subtitle="Max-flow = Min-cut"
                  highlight={result.flow_equals_min_cut}
                />
                <FlowStatCard
                  label="Bottleneck Edges"
                  value={result.num_bottlenecks}
                  subtitle="Saturated / min-cut links"
                  isWarning={result.num_bottlenecks > 0}
                />
                <FlowStatCard
                  label="Flow-Carrying Edges"
                  value={flowCarryingCount}
                  subtitle={`of ${numEdges} total`}
                />
                <FlowStatCard
                  label="Flow = Min-Cut"
                  value={result.flow_equals_min_cut ? 'Verified' : 'Mismatch!'}
                  subtitle="Max-flow min-cut theorem"
                  highlight={result.flow_equals_min_cut}
                  isWarning={!result.flow_equals_min_cut}
                />
              </div>

              {/* Badges + Info Row */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge status="info" label="STORED CAPACITY" />
                <StatusBadge status="info" label="BOYKOV-KOLMOGOROV" />
                {result.flow_equals_min_cut && (
                  <StatusBadge status="passed" label="MAX-FLOW = MIN-CUT" />
                )}
                {result.num_conservation_violations === 0 && (
                  <StatusBadge status="passed" label="FLOW CONSERVATION OK" />
                )}
                <span className="text-slate-500 font-mono text-[11px] ml-auto">
                  Source: Node {result.source} → Sink: Node {result.destination} @ Hr {result.hour}
                </span>
              </div>

              {/* Network Visualization */}
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div>
                    <span className="section-label">Network Visualization</span>
                    <h3 className="text-base font-semibold text-white">Maximum Flow Topology</h3>
                  </div>
                  <button
                    id="max-flow-export-btn"
                    className="btn-secondary flex items-center gap-2 text-xs py-1.5"
                    onClick={exportCsv}
                  >
                    <Download size={13} /> Export Flow Table CSV
                  </button>
                </div>

                <NetworkGraph
                  mode="max-flow"
                  network={network}
                  hour={hour}
                  sourceNodeId={source}
                  destinationNodeId={destination}
                  maxFlowResult={result}
                />
              </div>

              {/* Min-Cut Details */}
              {result.min_cut_edges && result.min_cut_edges.length > 0 && (
                <div className="card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Scissors size={15} className="text-rose-400" />
                    <div className="section-label">Min-Cut Edges</div>
                    <span className="text-xs text-slate-500 ml-auto">
                      Total min-cut capacity: <strong className="text-rose-300">{result.min_cut_capacity?.toFixed(2)} veh/hr</strong>
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-400 border-b border-border">
                          <th className="pb-2 font-semibold">Cut Arc (directed)</th>
                          <th className="pb-2 font-semibold">Arc Capacity (veh/hr/dir)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.min_cut_edges.map((e, i) => (
                          <tr key={i} className="border-b border-border/40 last:border-0 bg-rose-950/10">
                            <td className="py-2 font-mono text-xs text-rose-300 flex items-center gap-1.5">
                              <span>Node {e.from}</span>
                              <ArrowRight size={11} className="text-rose-400" />
                              <span>Node {e.to}</span>
                            </td>
                            <td className="py-2 font-mono text-xs text-slate-300">
                              {e.capacity.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bottleneck Edges Summary */}
              {result.bottleneck_edges && result.bottleneck_edges.length > 0 && (
                <div className="card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={15} className="text-amber-400" />
                    <div className="section-label">Bottleneck Roads</div>
                    <span className="text-xs text-slate-500 ml-1">
                      ({result.num_bottlenecks} bottleneck{result.num_bottlenecks !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-400 border-b border-border">
                          <th className="pb-2 font-semibold">Road</th>
                          <th className="pb-2 font-semibold">Capacity (veh/hr/dir)</th>
                          <th className="pb-2 font-semibold">Flow (veh/hr)</th>
                          <th className="pb-2 font-semibold">Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.bottleneck_edges.map((e, i) => (
                          <tr key={i} className="border-b border-border/40 last:border-0 bg-amber-950/10">
                            <td className="py-2 font-mono text-xs text-amber-300 flex items-center gap-1.5">
                              <span>Node {e.from}</span>
                              <ArrowRight size={11} className="text-amber-400" />
                              <span>Node {e.to}</span>
                            </td>
                            <td className="py-2 font-mono text-xs text-slate-300">{e.capacity.toFixed(2)}</td>
                            <td className="py-2 font-mono text-xs text-amber-300 font-semibold">{e.flow.toFixed(2)}</td>
                            <td className="py-2 font-mono text-xs text-rose-400 font-bold">
                              {(e.utilization * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Full Edge Flow Table */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="section-label">Link Allocation Details</div>
                    <h3 className="text-base font-semibold text-white">Edge Flow & Capacity Table</h3>
                  </div>
                  <div className="text-xs text-slate-400">
                    Sorted by utilization (highest first)
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-border">
                        <th className="pb-2.5 font-semibold">Edge</th>
                        <th className="pb-2.5 font-semibold">Capacity (veh/hr/dir)</th>
                        <th className="pb-2.5 font-semibold">Flow (veh/hr)</th>
                        <th className="pb-2.5 font-semibold">Utilization %</th>
                        <th className="pb-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.edges.map((e, i) => {
                        const isCarrying = e.flow > 1e-4
                        return (
                          <tr
                            key={i}
                            className={`border-b border-border/40 last:border-0 hover:bg-slate-800/30 transition-colors ${
                              e.is_bottleneck ? 'bg-rose-950/20' : isCarrying ? 'bg-cyan-950/10' : ''
                            }`}
                          >
                            <td className="py-2.5 text-slate-200 font-mono text-xs">
                              <span className="flex items-center gap-1.5">
                                <span>Node {e.from}</span>
                                <ArrowRight size={11} className={isCarrying ? 'text-teal-400' : 'text-slate-600'} />
                                <span>Node {e.to}</span>
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-300 font-mono text-xs">{e.capacity.toFixed(2)}</td>
                            <td className="py-2.5 font-mono text-xs font-semibold">
                              <span className={isCarrying ? 'text-teal-300' : 'text-slate-500'}>
                                {e.flow.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-300 font-mono text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      e.is_bottleneck
                                        ? 'bg-rose-500'
                                        : e.utilization > 0.7
                                        ? 'bg-amber-400'
                                        : 'bg-teal-400'
                                    }`}
                                    style={{ width: `${Math.min(100, e.utilization * 100)}%` }}
                                  />
                                </div>
                                <span className={e.is_bottleneck ? 'text-rose-400 font-bold' : ''}>
                                  {(e.utilization * 100).toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5">
                              {e.is_bottleneck ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  <ShieldAlert size={11} /> BOTTLENECK
                                </span>
                              ) : isCarrying ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                  <CheckCircle2 size={11} /> Flow Carrying
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-slate-500 bg-slate-800/60">
                                  Unused
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Flow Conservation Check */}
              <div className={`card p-4 flex items-start gap-3 ${
                result.num_conservation_violations === 0 ? 'border-teal-500/30' : 'border-rose-500/30'
              }`}>
                {result.num_conservation_violations === 0 ? (
                  <CheckCircle2 size={16} className="text-teal-400 mt-0.5 shrink-0" />
                ) : (
                  <ShieldAlert size={16} className="text-rose-400 mt-0.5 shrink-0" />
                )}
                <div className="text-xs text-slate-400">
                  <strong className="text-slate-300">Flow Conservation:</strong>{' '}
                  {result.num_conservation_violations === 0
                    ? 'Verified — inflow equals outflow at all intermediate nodes.'
                    : `${result.num_conservation_violations} violation(s) detected at intermediate nodes.`}
                  {' '}<span className="text-slate-500">
                    Algorithm: {result.algorithm}
                    {result.algorithm_detail ? ` (${result.algorithm_detail})` : ''}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FlowStatCard({
  label,
  value,
  subtitle,
  highlight,
  isWarning,
}: {
  label: string
  value: string | number
  subtitle?: string
  highlight?: boolean
  isWarning?: boolean
}) {
  return (
    <div
      className={`card p-4 transition-all ${
        highlight
          ? 'border-teal-500/50 bg-teal-950/20 shadow-[0_0_15px_rgba(20,184,166,0.1)]'
          : isWarning
          ? 'border-rose-500/40 bg-rose-950/15'
          : ''
      }`}
    >
      <div className="section-label mb-1.5">{label}</div>
      <div
        className={`text-2xl font-bold font-mono ${
          highlight ? 'text-teal-300' : isWarning ? 'text-rose-400' : 'text-white'
        }`}
      >
        {value}
      </div>
      {subtitle && <div className="text-[11px] text-slate-500 mt-1">{subtitle}</div>}
    </div>
  )
}
