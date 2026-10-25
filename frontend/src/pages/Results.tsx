import { useEffect, useState } from 'react'
import { Eye, Share2, Download, ListChecks } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { formatHour } from '../hooks/useHour'
import { api } from '../services/api'
import type { ResultRecord } from '../types'

const TABS = [
  { key: 'all', label: 'All Runs' },
  { key: 'Shortest Path', label: 'Shortest Path' },
  { key: 'Maximum Flow', label: 'Maximum Flow' },
]

export default function Results() {
  const [tab, setTab] = useState('all');
  const [results, setResults] = useState<ResultRecord[]>([])
  const [selected, setSelected] = useState<ResultRecord | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.results(tab).then((d) => setResults(d.results)).catch(() => setResults([]))
  }, [tab])

  const showOnNetwork = (r: ResultRecord) => {
    if (r.technique === 'Shortest Path') navigate('/shortest-path')
    else if (r.technique === 'Maximum Flow') navigate('/max-flow')
  }

  const downloadResult = (r: ResultRecord) => {
    const blob = new Blob([JSON.stringify(r.payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `result_${r.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="Optimization Results"
        subtitle="Review recent model outputs and compare the decision-support question answered by each technique."
      />

      <div className="flex gap-1 mb-5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              tab === t.key ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="card"><EmptyState icon={ListChecks} title="No analysis run yet"
          description="Run a Shortest Path or Maximum Flow analysis to see results here." /></div>
      ) : (
        <div className="card p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-border">
                <th className="pb-2 font-medium">Timestamp</th>
                <th className="pb-2 font-medium">Technique</th>
                <th className="pb-2 font-medium">Hour</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Destination</th>
                <th className="pb-2 font-medium">Result</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 text-slate-400 text-xs">{new Date(r.timestamp).toLocaleString()}</td>
                  <td className="py-2.5 text-slate-200">{r.technique}</td>
                  <td className="py-2.5 text-slate-400">{formatHour(r.hour)}</td>
                  <td className="py-2.5 text-slate-400">{r.source !== null ? `Node ${r.source}` : '—'}</td>
                  <td className="py-2.5 text-slate-400">{r.destination !== null ? `Node ${r.destination}` : '—'}</td>
                  <td className="py-2.5 text-slate-300 font-mono text-xs">{r.result}</td>
                  <td className="py-2.5"><StatusBadge status="success" label={r.status} /></td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <button title="View" onClick={() => setSelected(r)} className="text-slate-500 hover:text-accent"><Eye size={14} /></button>
                      <button title="Show on network" onClick={() => showOnNetwork(r)} className="text-slate-500 hover:text-accent"><Share2 size={14} /></button>
                      <button title="Download" onClick={() => downloadResult(r)} className="text-slate-500 hover:text-accent"><Download size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6" onClick={() => setSelected(null)}>
          <div className="card p-5 max-w-lg w-full max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="section-label mb-3">Run Detail — {selected.technique}</div>
            <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">{JSON.stringify(selected.payload, null, 2)}</pre>
            <button className="btn-secondary mt-4 w-full" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
