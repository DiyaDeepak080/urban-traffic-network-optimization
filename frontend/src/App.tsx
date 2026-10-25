import { Routes, Route } from 'react-router-dom'
import { HourProvider } from './hooks/useHour'
import AppShell from './layouts/AppShell'
import Dashboard from './pages/Dashboard'
import DataManagement from './pages/DataManagement'
import TrafficStatistics from './pages/TrafficStatistics'
import NetworkExplorer from './pages/NetworkExplorer'
import ShortestPath from './pages/ShortestPath'
import MaxFlow from './pages/MaxFlow'
import Results from './pages/Results'
import Methodology from './pages/Methodology'
import DatasetAssumptions from './pages/DatasetAssumptions'
import About from './pages/About'

export default function App() {
  return (
    <HourProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/data-management" element={<DataManagement />} />
          <Route path="/traffic-statistics" element={<TrafficStatistics />} />
          <Route path="/network-explorer" element={<NetworkExplorer />} />
          <Route path="/shortest-path" element={<ShortestPath />} />
          <Route path="/max-flow" element={<MaxFlow />} />
          <Route path="/results" element={<Results />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/dataset-assumptions" element={<DatasetAssumptions />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </HourProvider>
  )
}
