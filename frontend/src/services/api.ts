import axios from 'axios'
import type {
  DatasetStatus, DatasetSummary, Statistics, NetworkData, NodeDetail,
  ShortestPathResult, MaxFlowResult, ResultRecord, DatasetPreview,
} from '../types'

const client = axios.create({ baseURL: '/api' })

function extractErrorMessage(err: any): string {
  const detail = err?.response?.data?.detail
  if (!detail) return err?.message || 'An unexpected error occurred.'
  if (typeof detail === 'string') return detail
  if (detail.message) return `${detail.message}${detail.issues ? ': ' + detail.issues.join('; ') : ''}`
  return JSON.stringify(detail)
}

export class ApiClientError extends Error {}

async function handle<T>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    const res = await promise
    return res.data
  } catch (err) {
    throw new ApiClientError(extractErrorMessage(err))
  }
}

export const api = {
  health: () => handle(client.get('/health')),

  datasetStatus: () => handle<DatasetStatus>(client.get('/dataset/status')),
  datasetSummary: () => handle<DatasetSummary>(client.get('/dataset/summary')),
  datasetProcess: () => handle<DatasetStatus>(client.post('/dataset/process')),
  datasetValidation: () => handle(client.get('/dataset/validation')),
  datasetPreview: (n_rows = 10) => handle<DatasetPreview>(client.get('/dataset/preview', { params: { n_rows } })),
  uploadDatasetFile: (fileType: 'train' | 'adjacency' | 'capacity', file: File) => {
    const form = new FormData()
    form.append('file', file)
    return handle(client.post(`/dataset/upload?file_type=${fileType}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }))
  },

  statistics: () => handle<Statistics>(client.get('/statistics')),

  network: (hour: number) => handle<NetworkData>(client.get('/network', { params: { hour } })),
  nodeDetail: (nodeId: number, hour: number) => handle<NodeDetail>(client.get(`/network/${nodeId}`, { params: { hour } })),

  shortestPath: (source: number, destination: number, hour: number) =>
    handle<ShortestPathResult>(client.post('/shortest-path', { source, destination, hour })),

  maxFlow: (source: number, destination: number, hour: number) =>
    handle<MaxFlowResult>(client.post('/max-flow', { source, destination, hour })),

  results: (technique = 'all') => handle<{ results: ResultRecord[] }>(client.get('/results', { params: { technique } })),
  result: (id: number) => handle<ResultRecord>(client.get(`/results/${id}`)),
}
