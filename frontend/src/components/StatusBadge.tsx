type Status = 'passed' | 'warning' | 'failed' | 'success' | 'info'

const STYLES: Record<Status, string> = {
  passed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
  info: 'bg-accent/10 text-accent border-accent/30',
}

export default function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STYLES[status]}`}>
      {label || status}
    </span>
  )
}
