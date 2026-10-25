import { LucideIcon, Inbox } from 'lucide-react'

export default function EmptyState({
  title, description, icon: Icon = Inbox,
}: { title: string; description?: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-11 h-11 rounded-full bg-base-800 border border-border flex items-center justify-center mb-4">
        <Icon size={18} className="text-slate-600" />
      </div>
      <div className="text-sm font-medium text-slate-300">{title}</div>
      {description && <div className="text-xs text-slate-500 mt-1.5 max-w-sm">{description}</div>}
    </div>
  )
}
