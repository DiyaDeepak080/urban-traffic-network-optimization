import { useEffect, useState } from 'react'
import { Route, PlayCircle, Download } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import NodeSelect from '../components/NodeSelect'
import NetworkGraph from '../components/NetworkGraph'
import ErrorBanner from '../components/ErrorBanner'
import EmptyState from '../components/EmptyState'
import { useHour, formatHour } from '../hooks/useHour'
import { api } from '../services/api'
import type { ShortestPathResult, NetworkData } from '../types'

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

export default function ShortestPath() {
  const { hour, setHour } = useHour()
  const [source, setSource] = useState(0)
  const [destination, setDestination] = useState(35)
  const [network, setNetwork] = useState<NetworkData | null>(null)
  const [result, setResult] = useState<ShortestPathResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.network(hour).then(setNetwork).catch(() => {})
  }, [hour])

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.shortestPath(source, destination, hour)
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
    const rows: (string | number)[][] = [['from', 'to', 'weight']]
    result.edges.forEach((e) => rows.push([e.from, e.to, e.weight]))
    downloadCsv('shortest_path_route.csv', rows)
  }

  const numNodes = network?.num_nodes ?? 36

  return (
    <div>
      <PageHeader
        eyebrow="Analysis Workspace"
        title="Time-Dependent Shortest Path"
        subtitle="Find the minimum-cost route between a selected source and destination under the traffic conditions of a selected hour."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        <div className="card p-5 h-fit space-y-4">
          <div className="section-label mb-1">Model Inputs</div>
          <div className="text-xs text-slate-500 -mt-2 mb-1">
            Dataset: Urban Traffic Network<br />Network: 36 Intersections
          </div>
          <NodeSelect label="Source Location" value={source} onChange={setSource} numNodes={numNodes} excludeValue={destination} />
          <NodeSelect label="Destination Location" value={destination} onChange={setDestination} numNodes={numNodes} excludeValue={source} />
          <label className="block">
            <span className="text-xs text-slate-400 mb-1.5 block">Hour</span>
            <select className="input-field" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{formatHour(h)} / Hour {h}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={run} disabled={loading}>
            <PlayCircle size={15} />
            {loading ? 'Computing…' : 'Find Shortest Path'}
          </button>
        </div>

        <div className="space-y-5">
          {error && <ErrorBanner message={error} />}

          {!result && !error && (
            <div className="card"><EmptyState icon={Route} title="No analysis run yet"
              description="Select a source, destination, and hour, then click Find Shortest Path." /></div>
          )}

          {result && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ResultStat label="Path Found" value={result.path.join(' → ')} wide />
                <ResultStat label="Total Cost" value={result.total_cost.toFixed(4)} />
                <ResultStat label="Number of Hops" value={result.hops} />
                <ResultStat label="Selected Hour" value={`${formatHour(result.hour)} / Hour ${result.hour}`} />
              </div>

              {network && (
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="section-label">Network Visualization</span>
                    <button className="btn-secondary flex items-center gap-2 text-xs py-1.5" onClick={exportCsv}>
                      <Download size={13} /> Export Route CSV
                    </button>
                  </div>
                  <NetworkGraph
                    mode="shortest-path"
                    network={network}
                    hour={hour}
                    sourceNodeId={source}
                    destinationNodeId={destination}
                    shortestPathResult={result}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultStat({ label, value, wide }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div className={`card p-4 ${wide ? 'col-span-2 md:col-span-4' : ''}`}>
      <div className="section-label mb-2">{label}</div>
      <div className={`font-semibold text-white ${wide ? 'text-base font-mono' : 'text-xl'}`}>{value}</div>
    </div>
  )
}
