import PageHeader from '../components/PageHeader'
import { Route, Waves } from 'lucide-react'

export default function About() {
  return (
    <div>
      <PageHeader title="About" subtitle="Urban Traffic Network Optimization — an Operations Research decision support system." />

      <div className="max-w-2xl space-y-6">
        <div className="card p-5">
          <div className="section-label mb-2">Purpose</div>
          <p className="text-sm text-slate-400 leading-relaxed">
            This application applies Operations Research network optimization techniques to
            analyze an existing 36-intersection urban traffic network, supporting dynamic routing,
            network throughput, and bottleneck identification under time-varying congestion.
          </p>
        </div>

        <div className="card p-5">
          <div className="section-label mb-3">Techniques</div>
          <div className="space-y-3">
            <TechniqueRow icon={Route} title="Time-Dependent Shortest Path" desc="Dijkstra's algorithm over traffic-weighted edge costs to minimize congestion exposure." />
            <TechniqueRow icon={Waves} title="Maximum Flow" desc="Boykov-Kolmogorov algorithm over stored physical edge capacities (veh/hr/dir) with min-cut bottleneck detection." />
          </div>
        </div>

        <div className="card p-5">
          <div className="section-label mb-2">Dataset</div>
          <p className="text-sm text-slate-400 leading-relaxed">
            The traffic dataset comprises traffic observations (train.csv), network connectivity (adj_matrix.csv),
            and physical road throughput limits (edge_capacity.csv).
          </p>
        </div>
      </div>
    </div>
  )
}

function TechniqueRow({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-accent" />
      </div>
      <div>
        <div className="text-sm text-slate-200">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
    </div>
  )
}
