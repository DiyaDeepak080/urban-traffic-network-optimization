export default function NodeSelect({
  label, value, onChange, numNodes, excludeValue,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  numNodes: number
  excludeValue?: number
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 mb-1.5 block">{label}</span>
      <select
        className="input-field"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {Array.from({ length: numNodes }, (_, i) => i)
          .filter((n) => n !== excludeValue)
          .map((n) => (
            <option key={n} value={n}>Intersection {n}</option>
          ))}
      </select>
    </label>
  )
}
