export interface DatasetStatus {
  loaded: boolean
  message?: string
  train_csv?: { filename: string; size_bytes: number }
  adj_matrix_csv?: { filename: string; size_bytes: number }
  edge_capacity_csv?: { filename: string; size_bytes: number }
  num_nodes?: number
  num_hours?: number
  hours?: number[]
  num_edges?: number
  num_connected_components?: number
  num_records?: number
  validation?: ValidationReport
  capacity_info?: CapacityInfo
}

export interface CapacityInfo {
  has_capacity: boolean
  capacity_unit?: string
  capacity_encoding?: string
  capacity_min?: number
  capacity_max?: number
  capacity_mean?: number
}

export interface ValidationSection {
  status: 'passed' | 'warning' | 'failed'
  issues: string[]
  warnings: string[]
  [key: string]: any
}

export interface ValidationReport {
  train_csv: ValidationSection
  adj_matrix: ValidationSection
  edge_capacity?: ValidationSection
}

export interface DatasetSummary {
  num_intersections: number
  num_hours: number
  num_edges: number
  num_records: number
  avg_traffic: number
  num_connected_components: number
  is_fully_connected: boolean
}

export interface Statistics {
  total_observations: number
  num_intersections: number
  num_hours: number
  mean_traffic: number
  min_traffic: number
  max_traffic: number
  std_traffic: number
  traffic_by_hour: { hour: number; avg_traffic: number }[]
  traffic_by_intersection: { location: number; avg_traffic: number }[]
  traffic_distribution: { bin_start: number; bin_end: number; count: number }[]
}

export interface NetworkNode {
  id: number
  label: string
  traffic: number
  no_roads: number
  degree: number
  x: number
  y: number
}

export interface NetworkEdge {
  from: number
  to: number
  weight: number
}

export interface NetworkData {
  hour: number
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  num_nodes: number
  num_edges: number
  num_connected_components: number
}

export interface NodeDetail {
  id: number
  label: string
  hour: number
  traffic: number
  no_roads: number
  degree: number
  connected_nodes: number[]
  traffic_all_hours: { hour: number; traffic: number }[]
}

export interface ShortestPathResult {
  source: number
  destination: number
  hour: number
  path: number[]
  edges: { from: number; to: number; weight: number }[]
  hops: number
  total_cost: number
  weight_formula?: string
  weight_description?: string
}

export interface MaxFlowEdge {
  from: number
  to: number
  capacity: number
  flow: number
  utilization: number
  is_bottleneck: boolean
  status: string
}

export interface MinCutEdge {
  from: number
  to: number
  capacity: number
}

export interface MaxFlowResult {
  source: number
  sink: number
  destination: number
  hour: number
  max_flow: number
  maximum_flow: number
  flow_unit: string
  num_bottlenecks: number
  bottlenecks: number[][]
  bottleneck_edges: MaxFlowEdge[]
  edges: MaxFlowEdge[]
  flow_edges: MaxFlowEdge[]
  min_cut_value: number
  min_cut_edges: MinCutEdge[]
  min_cut_capacity: number
  flow_equals_min_cut: boolean
  conservation_violations: any[]
  num_conservation_violations: number
  capacity_model: string
  algorithm: string
  algorithm_detail: string
  status: string
}

export interface ResultRecord {
  id: number
  timestamp: string
  technique: string
  hour: number
  source: number | null
  destination: number | null
  result: string
  status: string
  parameters: Record<string, any>
  payload: Record<string, any>
}

export interface DatasetPreview {
  columns: string[]
  rows: Record<string, any>[]
  total_rows: number
  capacity_column_present: boolean
}

export interface ApiError {
  detail: string | { message: string; issues: string[] }
}
