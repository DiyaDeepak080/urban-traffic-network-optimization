import { LucideIcon } from 'lucide-react'

export default function StatCard({
  label, value, icon: Icon, hint,
}: { label: string; value: string | number; icon?: LucideIcon; hint?: string }) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="section-label">{label}</span>
        {Icon && <Icon size={16} className="text-slate-600" />}
      </div>
      <div className="text-2xl font-semibold text-white tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  )
}
