import { useState } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import ErrorBanner from '../components/ErrorBanner'
import { api } from '../services/api'
import type { Statistics } from '../types'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

export default function TrafficStatistics() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.statistics()
      setStats(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Analysis Workspace"
        title="Traffic Statistics"
        subtitle="Generate descriptive statistics only when required."
      />

      <div className="mb-6">
        <button className="btn-primary flex items-center gap-2" onClick={generate} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Generating…' : 'Generate Statistics'}
        </button>
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} /></div>}

      {!stats ? (
        <div className="card">
          <EmptyState icon={BarChart3} title="No statistics generated yet" description="Click Generate Statistics to compute descriptive statistics from train.csv." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Observations" value={stats.total_observations.toLocaleString()} />
            <StatCard label="Intersections" value={stats.num_intersections} />
            <StatCard label="Hours" value={stats.num_hours} />
            <StatCard label="Mean Traffic" value={stats.mean_traffic.toFixed(4)} />
            <StatCard label="Minimum Traffic" value={stats.min_traffic.toFixed(4)} />
            <StatCard label="Maximum Traffic" value={stats.max_traffic.toFixed(4)} />
            <StatCard label="Std. Deviation" value={stats.std_traffic.toFixed(4)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <div className="card p-5">
              <div className="section-label mb-4">Traffic by Hour</div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={stats.traffic_by_hour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2436" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0d131c', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="avg_traffic" stroke="#22d3c7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <div className="section-label mb-4">Traffic by Intersection</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.traffic_by_intersection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2436" vertical={false} />
                  <XAxis dataKey="location" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0d131c', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="avg_traffic" fill="#22d3c7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-5">
            <div className="section-label mb-4">Hourly Traffic Distribution</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.traffic_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2436" vertical={false} />
                <XAxis dataKey="bin_start" tickFormatter={(v) => v.toFixed(2)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0d131c', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="count" fill="#1a9e96" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
