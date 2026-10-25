import { useLocation } from 'react-router-dom'
import { Bell, User, CircleDot } from 'lucide-react'
import { useHour, formatHour } from '../hooks/useHour'
import { useDatasetStatus } from '../hooks/useDatasetStatus'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/data-management': 'Data Management',
  '/traffic-statistics': 'Traffic Statistics',
  '/network-explorer': 'Network Explorer',
  '/shortest-path': 'Shortest Path',
  '/max-flow': 'Maximum Flow',
  '/results': 'Results',
  '/methodology': 'Methodology',
  '/dataset-assumptions': 'Dataset & Assumptions',
  '/about': 'About',
}

const HOUR_SHARED_PAGES = ['/traffic-statistics', '/network-explorer', '/shortest-path', '/max-flow']

export default function TopBar() {
  const location = useLocation()
  const { hour, setHour } = useHour()
  const { status } = useDatasetStatus()
  const title = PAGE_TITLES[location.pathname] || 'Urban Traffic Network Optimization'
  const showHourSelector = HOUR_SHARED_PAGES.includes(location.pathname)

  return (
    <header className="h-16 shrink-0 border-b border-border bg-base-900/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="text-sm text-slate-500">
        <span>Operations Research</span>
        <span className="mx-2 text-slate-700">/</span>
        <span className="text-slate-200">{title}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-base-850">
          <CircleDot size={12} className={status?.loaded ? 'text-accent' : 'text-amber-500'} />
          <span className="text-slate-400">
            {status?.loaded ? '36-Node Network' : 'Dataset not loaded'}
          </span>
        </div>

        {showHourSelector && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Hour</span>
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="input-field w-28 py-1.5"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
          </div>
        )}

        <button className="text-slate-500 hover:text-slate-300 transition-colors">
          <Bell size={17} />
        </button>
        <div className="w-8 h-8 rounded-full bg-base-800 border border-border flex items-center justify-center text-slate-400">
          <User size={15} />
        </div>
      </div>
    </header>
  )
}
