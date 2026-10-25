import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Clock, Share2, Database, Activity, Network, Route, Waves } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { api } from '../services/api'
import type { DatasetSummary, Statistics } from '../types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function Dashboard() {
  const [summary, setSummary] = useState<DatasetSummary | null>(null)
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const s = await api.datasetSummary()
        setSummary(s)
        setLoaded(true)
        const st = await api.statistics()
        setStats(st)
      } catch (e: any) {
        setError(e.message)
        setLoaded(false)
      }
    })()
  }, [])

  return (
    <div>
      <PageHeader
        title="Urban Traffic Network Optimization"
        subtitle="Operations Research decision-support system for a 36-intersection urban traffic network."
      />

      {!loaded ? (
        <div className="card">
          <EmptyState
            icon={Database}
            title="Dataset not loaded"
            description={error || 'Load the traffic and network files from the Data Management page to populate the dashboard.'}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard label="Intersections" value={summary!.num_intersections} icon={MapPin} />
            <StatCard label="Hours" value={summary!.num_hours} icon={Clock} />
            <StatCard label="Network Edges" value={summary!.num_edges} icon={Share2} />
            <StatCard label="Traffic Records" value={summary!.num_records.toLocaleString()} icon={Database} />
            <StatCard label="Average Traffic" value={summary!.avg_traffic.toFixed(3)} icon={Activity} />
            <StatCard
              label="Network Connectivity"
              value={summary!.is_fully_connected ? 'Connected' : `${summary!.num_connected_components} components`}
              icon={Network}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            <div className="card p-5 lg:col-span-2">
              <div className="section-label mb-4">Traffic Overview</div>
              {stats ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.traffic_by_hour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2436" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#1f2937' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0d131c', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                      cursor={{ fill: '#111927' }}
                    />
                    <Bar dataKey="avg_traffic" fill="#22d3c7" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-sm text-slate-600">Loading…</div>
              )}
            </div>

            <div className="card p-5">
              <div className="section-label mb-4">Network Summary</div>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Dataset</dt>
                  <dd className="text-slate-200">Urban Traffic Network</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Nodes</dt>
                  <dd className="text-slate-200">{summary!.num_intersections}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Edges</dt>
                  <dd className="text-slate-200">{summary!.num_edges}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Hourly Periods</dt>
                  <dd className="text-slate-200">{summary!.num_hours}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Topology</dt>
                  <dd className="text-slate-200">{summary!.is_fully_connected ? 'Fully connected' : 'Disconnected'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Techniques</dt>
                  <dd className="text-slate-200">Shortest Path · Max Flow</dd>
                </div>
              </dl>
            </div>
          </div>
        </>
      )}

      <div className="section-label mb-3">Optimization Techniques</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <TechniqueCard
          to="/shortest-path"
          icon={Route}
          title="Time-Dependent Shortest Path"
          description="Finds the minimum-cost route between a source and destination under the traffic conditions of a selected hour, using Dijkstra's algorithm with modeled traffic-related edge costs."
        />
        <TechniqueCard
          to="/max-flow"
          icon={Waves}
          title="Maximum Flow"
          description="Computes the maximum throughput between a source and destination using stored road capacities (veh/hr/dir) from the dataset, via the Boykov-Kolmogorov algorithm with min-cut analysis."
        />
      </div>
    </div>
  )
}

function TechniqueCard({ to, icon: Icon, title, description }: { to: string; icon: any; title: string; description: string }) {
  return (
    <Link to={to} className="card card-hover p-5 block">
      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
        <Icon size={17} className="text-accent" />
      </div>
      <div className="text-sm font-medium text-slate-100 mb-1.5">{title}</div>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
    </Link>
  )
}
