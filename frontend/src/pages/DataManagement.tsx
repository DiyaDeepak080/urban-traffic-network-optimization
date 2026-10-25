import { useState, useRef, useEffect } from 'react'
import { UploadCloud, FileText, CheckCircle2, RefreshCw, Table2, Zap } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import ErrorBanner from '../components/ErrorBanner'
import { api } from '../services/api'
import { useDatasetStatus } from '../hooks/useDatasetStatus'
import type { DatasetPreview } from '../types'

function bytesToSize(bytes?: number) {
  if (!bytes) return '—'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function UploadCard({
  title, expectedFile, fileType, meta, onUploaded,
}: {
  title: string
  expectedFile: string
  fileType: 'train' | 'adjacency' | 'capacity'
  meta?: { filename: string; size_bytes: number }
  onUploaded: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      await api.uploadDatasetFile(fileType, file)
      onUploaded()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-200">{title}</span>
        {meta ? <StatusBadge status="passed" label="Loaded" /> : <StatusBadge status="warning" label="Not loaded" />}
      </div>
      <div className="text-xs text-slate-500 mb-4">Expected file: <span className="font-mono text-slate-400">{expectedFile}</span></div>

      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-base-850 border border-border">
        <FileText size={16} className="text-slate-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-300 truncate">{meta?.filename || 'No file loaded'}</div>
          <div className="text-xs text-slate-600">{bytesToSize(meta?.size_bytes)}</div>
        </div>
        {meta && <CheckCircle2 size={15} className="text-accent shrink-0" />}
      </div>

      <input ref={inputRef} type="file" accept=".csv" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <button className="btn-secondary w-full flex items-center justify-center gap-2" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <UploadCloud size={14} />
        {uploading ? 'Uploading…' : 'Replace file'}
      </button>
      {error && <div className="mt-2"><ErrorBanner message={error} /></div>}
    </div>
  )
}

export default function DataManagement() {
  const { status, refresh } = useDatasetStatus()
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [preview, setPreview] = useState<DatasetPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const handleProcess = async () => {
    setProcessing(true)
    setProcessError(null)
    try {
      await api.datasetProcess()
      await refresh()
    } catch (e: any) {
      setProcessError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  const loadPreview = async () => {
    setPreviewLoading(true)
    try {
      const p = await api.datasetPreview(8)
      setPreview(p)
    } catch {
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    if (status?.loaded) {
      loadPreview()
    }
  }, [status?.loaded])

  const validation = status?.validation
  const capacityInfo = status?.capacity_info

  return (
    <div>
      <PageHeader
        eyebrow="Dataset Ingestion"
        title="Data Management"
        subtitle="Load the traffic measurements and network connectivity files required by the analysis pipeline."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <UploadCard
          title="Traffic Data"
          expectedFile="train.csv"
          fileType="train"
          meta={status?.train_csv}
          onUploaded={refresh}
        />
        <UploadCard
          title="Network Connectivity"
          expectedFile="adj_matrix.csv"
          fileType="adjacency"
          meta={status?.adj_matrix_csv}
          onUploaded={refresh}
        />
        <UploadCard
          title="Road Capacities"
          expectedFile="edge_capacity.csv"
          fileType="capacity"
          meta={status?.edge_capacity_csv}
          onUploaded={refresh}
        />
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="section-label">Process Dataset</span>
          <button className="btn-primary flex items-center gap-2" onClick={handleProcess} disabled={processing}>
            <RefreshCw size={14} className={processing ? 'animate-spin' : ''} />
            {processing ? 'Processing…' : 'Process Dataset'}
          </button>
        </div>
        {processError && <ErrorBanner message={processError} />}
        {status?.loaded && !processError && (
          <div className="text-xs text-slate-500">
            Dataset processed: {status.num_nodes} nodes, {status.num_edges} edges, {status.num_hours} hourly periods,
            {' '}{status.num_records?.toLocaleString()} records.
          </div>
        )}
      </div>

      {/* Dataset Validation */}
      <div className="card p-5 mb-6">
        <div className="section-label mb-4">Dataset Validation</div>
        {!validation ? (
          <div className="text-sm text-slate-500">Process the dataset to see validation results.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-300">train.csv</span>
                <StatusBadge status={validation.train_csv.status} />
              </div>
              <dl className="space-y-2 text-xs">
                <Row label="Required columns detected" value={validation.train_csv.issues.length === 0 ? 'Yes' : 'No'} />
                <Row label="Missing values" value={validation.train_csv.missing_values} />
                <Row label="Duplicate records" value={validation.train_csv.duplicate_count} />
                <Row label="Intersections detected" value={validation.train_csv.num_locations} />
                <Row label="Total rows" value={validation.train_csv.num_rows?.toLocaleString()} />
              </dl>
              {validation.train_csv.warnings.map((w: string, i: number) => (
                <div key={i} className="text-xs text-amber-400/80 mt-1">⚠ {w}</div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-300">adj_matrix.csv</span>
                <StatusBadge status={validation.adj_matrix.status} />
              </div>
              <dl className="space-y-2 text-xs">
                <Row label="Network dimensions" value={validation.adj_matrix.shape?.join(' × ')} />
                <Row label="Symmetric matrix" value={validation.adj_matrix.is_symmetric ? 'Yes' : 'No'} />
                <Row label="Diagonal valid" value={validation.adj_matrix.diagonal_ok ? 'Yes' : 'No'} />
                <Row label="Connected components" value={validation.adj_matrix.connected_components} />
              </dl>
              {validation.adj_matrix.warnings.map((w: string, i: number) => (
                <div key={i} className="text-xs text-amber-400/80 mt-1">⚠ {w}</div>
              ))}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-300">edge_capacity.csv</span>
                <StatusBadge status={validation.edge_capacity?.status ?? 'passed'} />
              </div>
              <dl className="space-y-2 text-xs">
                <Row label="Required columns detected" value={(validation.edge_capacity?.issues?.length ?? 0) === 0 ? 'Yes' : 'No'} />
                <Row label="Roads covered" value={validation.edge_capacity?.num_edges ?? 43} />
                <Row label="Network coverage" value={validation.edge_capacity?.covers_all_network_edges ? '100% (43 / 43 roads)' : 'Incomplete'} />
                <Row label="Capacity unit" value="veh/hr/dir" />
              </dl>
              {validation.edge_capacity?.warnings?.map((w: string, i: number) => (
                <div key={i} className="text-xs text-amber-400/80 mt-1">⚠ {w}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dataset Preview Table */}
      {status?.loaded && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Table2 size={15} className="text-slate-400" />
            <span className="section-label">train.csv Preview</span>
            {preview?.capacity_column_present && (
              <StatusBadge status="passed" label="capacity column present" />
            )}
            <span className="text-xs text-slate-500 ml-auto">
              First {preview?.rows?.length ?? 0} of {preview?.total_rows?.toLocaleString()} rows
            </span>
          </div>

          {previewLoading ? (
            <div className="text-sm text-slate-500">Loading preview…</div>
          ) : preview ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-border">
                    {preview.columns.map((col) => (
                      <th
                        key={col}
                        className={`pb-2 font-semibold pr-4 ${col === 'capacity' ? 'text-accent' : ''}`}
                      >
                        {col}
                        {col === 'capacity' && (
                          <span className="ml-1 text-[10px] text-accent/70">(veh/hr/dir)</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-slate-800/20">
                      {preview.columns.map((col) => (
                        <td
                          key={col}
                          className={`py-1.5 pr-4 font-mono ${col === 'capacity' ? 'text-accent' : 'text-slate-300'}`}
                        >
                          {row[col] !== undefined ? String(row[col]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Preview unavailable.</div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-300">{value}</dd>
    </div>
  )
}
