export default function PageHeader({
  eyebrow, title, subtitle,
}: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-7">
      {eyebrow && <div className="section-label mb-2">{eyebrow}</div>}
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">{subtitle}</p>}
    </div>
  )
}
