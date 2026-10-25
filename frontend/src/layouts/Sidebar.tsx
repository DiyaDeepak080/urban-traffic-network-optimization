import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Database, BarChart3, Share2, Route,
  Waves, ListChecks, BookOpen, FileText, Info,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/data-management', label: 'Data Management', icon: Database },
  { to: '/traffic-statistics', label: 'Traffic Statistics', icon: BarChart3 },
  { to: '/network-explorer', label: 'Network Explorer', icon: Share2 },
  { to: '/shortest-path', label: 'Shortest Path', icon: Route },
  { to: '/max-flow', label: 'Maximum Flow', icon: Waves },
  { to: '/results', label: 'Results', icon: ListChecks },
  { to: '/methodology', label: 'Methodology', icon: BookOpen },
  { to: '/dataset-assumptions', label: 'Dataset & Assumptions', icon: FileText },
  { to: '/about', label: 'About', icon: Info },
]

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-base-900 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 border-b border-border">
        <div className="text-white font-semibold text-lg leading-tight">Urban Traffic</div>
        <div className="section-label mt-1">OR Decision Lab</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-base-800 text-accent border border-border'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-base-850 border border-transparent'
              }`
            }
          >
            <Icon size={16} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-border">
        <div className="text-xs text-slate-500">36-Node Network</div>
        <div className="text-xs text-slate-600 mt-0.5">Shortest Path · Max Flow</div>
      </div>
    </aside>
  )
}
