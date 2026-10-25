import { useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'
import NetworkGraph from '../components/NetworkGraph'
import { useHour, formatHour } from '../hooks/useHour'
import { api } from '../services/api'
import type { NetworkData, NodeDetail } from '../types'

export default function NetworkExplorer() {
  const { hour, setHour } = useHour()
  const [data, setData] = useState<NetworkData | null>(null)
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [showOverlay, setShowOverlay] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const d = await api.network(hour)
        setData(d)
        setError(null)
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [hour])

  const handleNodeClick = async (id: number) => {
    try {
      const detail = await api.nodeDetail(id, hour)
      setSelectedNode(detail)
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (error) {
    return (
      <div>
        <PageHeader eyebrow="Analysis Workspace" title="Network Explorer" />
        <ErrorBanner message={error} />
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <PageHeader eyebrow="Analysis Workspace" title="Network Explorer" />
        <div className="card"><EmptyState icon={Share2} title="Loading network…" /></div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Analysis Workspace"
        title="Network Explorer"
        subtitle="Explore the 36-node urban traffic network topology, road-count-weighted traffic overlays, and per-node detail."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-5">
        {/* LEFT: Network Controls */}
        <div className="card p-4 space-y-4 h-fit">
          <div className="section-label">Network Controls</div>
          <label className="block">
            <span className="text-xs text-slate-400 mb-1.5 block">Hour</span>
            <select className="input-field" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{formatHour(h)} / Hour {h}</option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-400">Traffic metric</div>
          <div className="text-xs text-slate-600 -mt-2">Mean hourly traffic per intersection</div>

          <div className="space-y-2 pt-2 border-t border-border">
            <Checkbox label="Show node labels" checked={showLabels} onChange={setShowLabels} />
            <Checkbox label="Show traffic overlay" checked={showOverlay} onChange={setShowOverlay} />
          </div>
        </div>

        {/* CENTER: Road Network */}
        <div className="card p-4">
          <div className="section-label mb-3">Road Network</div>
          <NetworkGraph
            mode="explorer"
            network={data}
            hour={hour}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNode?.id ?? null}
            showLabels={showLabels}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-border">
            <span>{data.num_nodes} nodes</span>
            <span>{data.num_edges} edges</span>
            <span>{data.num_connected_components === 1 ? 'Fully connected' : `${data.num_connected_components} components`}</span>
          </div>
        </div>

        {/* RIGHT: Selection Inspector */}
        <div className="card p-4 h-fit">
          <div className="section-label mb-3">Selection Inspector</div>
          {!selectedNode ? (
            <div className="text-xs text-slate-500">Click a node in the network to inspect its traffic and connectivity.</div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500">Selected Node</div>
                <div className="text-lg font-semibold text-white">Node {selectedNode.id}</div>
              </div>
              <Row label="Traffic" value={selectedNode.traffic.toFixed(4)} />
              <Row label="Connected Roads" value={selectedNode.no_roads} />
              <Row label="Degree" value={selectedNode.degree} />
              <Row label="Hour" value={`${formatHour(selectedNode.hour)} / Hour ${selectedNode.hour}`} />
              <div>
                <div className="text-xs text-slate-500 mb-1">Connected Nodes</div>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.connected_nodes.map((n) => (
                    <span key={n} className="text-xs px-1.5 py-0.5 rounded bg-base-800 border border-border text-slate-400">{n}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded accent-accent" />
      {label}
    </label>
  )
}
