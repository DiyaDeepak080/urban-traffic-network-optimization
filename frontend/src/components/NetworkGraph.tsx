import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  RotateCcw,
  X,
  Layers,
  Flame,
  Zap,
  ArrowRight,
  Info,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react'
import type {
  NetworkData,
  NetworkNode,
  ShortestPathResult,
  MaxFlowResult,
} from '../types'

export interface GraphNode {
  id: number
  x: number
  y: number
  traffic?: number
  no_roads?: number
  degree?: number
  label?: string
}

export interface GraphEdge {
  from: number
  to: number
  weight?: number
  capacity?: number
  flow?: number
  utilization?: number
  is_bottleneck?: boolean
  variant?: 'default' | 'path' | 'bottleneck' | 'saturated'
}

export interface NetworkGraphProps {
  // Mode determines specialized styling & metrics
  mode?: 'shortest-path' | 'max-flow' | 'explorer'

  // Full network data (preferred)
  network?: NetworkData | null

  // Selected hour
  hour?: number

  // Specialized optimization results
  sourceNodeId?: number | null
  destinationNodeId?: number | null
  shortestPathResult?: ShortestPathResult | null
  maxFlowResult?: MaxFlowResult | null

  // Fallback / legacy props for backwards-compatibility
  nodes?: GraphNode[]
  edges?: GraphEdge[]
  highlightNodeIds?: number[]
  selectedNodeId?: number | null
  onNodeClick?: (id: number) => void
  showLabels?: boolean
  height?: number
}

// Attractive traffic color interpolation: teal (low traffic) -> amber (medium) -> rose/red (high)
export function trafficColor(t: number, min: number, max: number): string {
  const range = max - min || 1
  const ratio = Math.max(0, Math.min(1, (t - min) / range))
  const r = Math.round(20 + ratio * (244 - 20))
  const g = Math.round(184 + ratio * (63 - 184))
  const b = Math.round(166 + ratio * (94 - 166))
  return `rgb(${r},${g},${b})`
}

export default function NetworkGraph({
  mode = 'explorer',
  network,
  hour = 1,
  sourceNodeId,
  destinationNodeId,
  shortestPathResult,
  maxFlowResult,
  nodes: propNodes,
  edges: propEdges,
  highlightNodeIds = [],
  selectedNodeId: propSelectedNodeId,
  onNodeClick,
  showLabels: propShowLabels = true,
  height,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // User-selected node for the persistent Node Details Panel
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(propSelectedNodeId ?? null)

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<any | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  // Toggles
  const [showNodeLabels, setShowNodeLabels] = useState(propShowLabels)
  const [showFlowValues, setShowFlowValues] = useState(true)
  const [showUnusedFlowEdges, setShowUnusedFlowEdges] = useState(true)
  const [showBottlenecksOnly, setShowBottlenecksOnly] = useState(false)
  const [animateFlow, setAnimateFlow] = useState(true)

  // Keep internal selected node in sync with prop if provided
  useEffect(() => {
    if (propSelectedNodeId !== undefined) {
      setSelectedNodeId(propSelectedNodeId)
    }
  }, [propSelectedNodeId])

  // Coordinate system: center at (300, 300), circle radius 205 inside 600x600 viewBox
  // This provides ~15% visual padding around the outermost nodes and badges, guaranteeing
  // the entire 36-node network auto-fits without clipping or needing manual zoom.
  const size = 600
  const center = size / 2
  const circleRadius = 205

  // Standardize nodes from network or propNodes
  const allNodes: GraphNode[] = useMemo(() => {
    if (network && network.nodes.length > 0) {
      return network.nodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        traffic: n.traffic,
        no_roads: n.no_roads,
        degree: n.degree,
        label: n.label,
      }))
    }
    if (propNodes && propNodes.length > 0) {
      return propNodes
    }
    // Fallback: 36 nodes around a circle
    return Array.from({ length: 36 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 36
      return { id: i, x: Math.cos(angle), y: Math.sin(angle) }
    })
  }, [network, propNodes])

  // Traffic min/max for color scale
  const trafficValues = useMemo(() => {
    return allNodes.map((n) => n.traffic ?? 0)
  }, [allNodes])
  const minTraffic = trafficValues.length > 0 ? Math.min(...trafficValues) : 0
  const maxTraffic = trafficValues.length > 0 ? Math.max(...trafficValues) : 1

  // Position nodes deterministically in circular layout
  const positionedNodes = useMemo(() => {
    return allNodes.map((n) => {
      const cx = center + n.x * circleRadius
      const cy = center + n.y * circleRadius
      return { ...n, cx, cy }
    })
  }, [allNodes, center, circleRadius])

  const nodePosMap = useMemo(() => {
    const map = new Map<number, { cx: number; cy: number; node: GraphNode }>()
    positionedNodes.forEach((n) => map.set(n.id, { cx: n.cx, cy: n.cy, node: n }))
    return map
  }, [positionedNodes])

  // Standardize edges
  const allEdges: GraphEdge[] = useMemo(() => {
    if (network && network.edges.length > 0) {
      return network.edges.map((e) => ({
        from: e.from,
        to: e.to,
        weight: e.weight,
      }))
    }
    if (propEdges && propEdges.length > 0) {
      return propEdges
    }
    return []
  }, [network, propEdges])

  // Adjacency map for instant connected node lookups
  const adjacencyMap = useMemo(() => {
    const map = new Map<number, number[]>()
    allNodes.forEach((n) => map.set(n.id, []))
    allEdges.forEach((e) => {
      const listA = map.get(e.from) || []
      const listB = map.get(e.to) || []
      if (!listA.includes(e.to)) listA.push(e.to)
      if (!listB.includes(e.from)) listB.push(e.from)
      map.set(e.from, listA)
      map.set(e.to, listB)
    })
    map.forEach((list) => list.sort((a, b) => a - b))
    return map
  }, [allNodes, allEdges])

  // Shortest Path lookup
  const shortestPathSet = useMemo(() => {
    const edgeSet = new Set<string>()
    if (shortestPathResult) {
      for (let i = 0; i < shortestPathResult.path.length - 1; i++) {
        const u = shortestPathResult.path[i]
        const v = shortestPathResult.path[i + 1]
        edgeSet.add(`${Math.min(u, v)}-${Math.max(u, v)}`)
      }
    }
    return edgeSet
  }, [shortestPathResult])

  const shortestPathDirectedOrder = useMemo(() => {
    const orderMap = new Map<string, { from: number; to: number }>()
    if (shortestPathResult) {
      for (let i = 0; i < shortestPathResult.path.length - 1; i++) {
        const u = shortestPathResult.path[i]
        const v = shortestPathResult.path[i + 1]
        orderMap.set(`${Math.min(u, v)}-${Math.max(u, v)}`, { from: u, to: v })
      }
    }
    return orderMap
  }, [shortestPathResult])

  // Max Flow lookup
  const maxFlowEdgeMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof maxFlowResult>['edges'][0]>()
    if (maxFlowResult) {
      maxFlowResult.edges.forEach((e) => {
        map.set(`${Math.min(e.from, e.to)}-${Math.max(e.from, e.to)}`, e)
      })
    }
    return map
  }, [maxFlowResult])

  const flowAffectedNodeIds = useMemo(() => {
    const set = new Set<number>()
    if (maxFlowResult) {
      maxFlowResult.edges.forEach((e) => {
        if (e.flow > 1e-4) {
          set.add(e.from)
          set.add(e.to)
        }
      })
    }
    return set
  }, [maxFlowResult])

  // Active source/destination IDs
  const activeSourceId = sourceNodeId ?? shortestPathResult?.source ?? maxFlowResult?.source ?? null
  const activeDestId = destinationNodeId ?? shortestPathResult?.destination ?? maxFlowResult?.destination ?? null

  // Node Click handler
  const handleNodeClick = useCallback(
    (nodeId: number, e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))
      onNodeClick?.(nodeId)
    },
    [onNodeClick]
  )

  // Background Click handler (closes Node Details Panel)
  const handleSvgBackgroundClick = useCallback(() => {
    setSelectedNodeId(null)
    setHoveredEdge(null)
  }, [])

  // Reset Selection / View
  const handleResetSelection = useCallback(() => {
    setSelectedNodeId(null)
    setHoveredEdge(null)
  }, [])

  // Node details info for selected node
  const selectedNodeData = useMemo(() => {
    if (selectedNodeId === null) return null
    const entry = nodePosMap.get(selectedNodeId)
    if (!entry) return null
    const node = entry.node
    const connected = adjacencyMap.get(selectedNodeId) || []
    return {
      id: selectedNodeId,
      traffic: node.traffic ?? 0,
      no_roads: node.no_roads ?? 0,
      degree: connected.length,
      connectedLocations: connected,
      isSource: selectedNodeId === activeSourceId,
      isDestination: selectedNodeId === activeDestId,
      isOnShortestPath: shortestPathResult?.path.includes(selectedNodeId) ?? false,
      participatesInFlow: flowAffectedNodeIds.has(selectedNodeId),
    }
  }, [
    selectedNodeId,
    nodePosMap,
    adjacencyMap,
    activeSourceId,
    activeDestId,
    shortestPathResult,
    flowAffectedNodeIds,
  ])

  // Processed edge items sorted for clean rendering order
  const renderedEdges = useMemo(() => {
    return allEdges.map((baseEdge) => {
      const minN = Math.min(baseEdge.from, baseEdge.to)
      const maxN = Math.max(baseEdge.from, baseEdge.to)
      const key = `${minN}-${maxN}`

      const p1 = nodePosMap.get(baseEdge.from)
      const p2 = nodePosMap.get(baseEdge.to)
      if (!p1 || !p2) return null

      // Geometry calculation
      const dx = p2.cx - p1.cx
      const dy = p2.cy - p1.cy
      const dist = Math.hypot(dx, dy) || 1
      const ux = dx / dist
      const uy = dy / dist

      // Midpoint
      const midX = (p1.cx + p2.cx) / 2
      const midY = (p1.cy + p2.cy) / 2

      // Check mode states
      const isShortestPath = shortestPathSet.has(key)

      const flowData = maxFlowEdgeMap.get(key)
      const isBottleneck = flowData?.is_bottleneck ?? false
      const flow = flowData?.flow ?? 0
      const capacity = flowData?.capacity ?? 0
      const utilization = flowData?.utilization ?? 0
      const isFlowCarrying = flow > 1e-4

      // Direction of flow/path
      let dirFrom = baseEdge.from
      let dirTo = baseEdge.to
      if (mode === 'shortest-path' && isShortestPath) {
        const order = shortestPathDirectedOrder.get(key)
        if (order) {
          dirFrom = order.from
          dirTo = order.to
        }
      } else if (mode === 'max-flow' && flowData && isFlowCarrying) {
        dirFrom = flowData.from
        dirTo = flowData.to
      }

      return {
        key,
        from: baseEdge.from,
        to: baseEdge.to,
        dirFrom,
        dirTo,
        weight: baseEdge.weight,
        p1,
        p2,
        dx,
        dy,
        dist,
        ux,
        uy,
        midX,
        midY,
        isShortestPath,
        isBottleneck,
        isFlowCarrying,
        flow,
        capacity,
        utilization,
      }
    }).filter(Boolean) as NonNullable<typeof allEdges[0] & {
      key: string
      dirFrom: number
      dirTo: number
      p1: { cx: number; cy: number }
      p2: { cx: number; cy: number }
      ux: number
      uy: number
      midX: number
      midY: number
      isShortestPath: boolean
      isBottleneck: boolean
      isFlowCarrying: boolean
      flow: number
      capacity: number
      utilization: number
    }>[]
  }, [
    allEdges,
    nodePosMap,
    mode,
    shortestPathSet,
    shortestPathDirectedOrder,
    maxFlowEdgeMap,
  ])

  // Sort edges so prominent edges render on top of normal edges
  const sortedRenderedEdges = useMemo(() => {
    return [...renderedEdges].sort((a, b) => {
      const rank = (e: typeof a) => {
        if (mode === 'shortest-path') return e.isShortestPath ? 2 : 1
        if (mode === 'max-flow') return e.isBottleneck ? 3 : e.isFlowCarrying ? 2 : 1
        return 1
      }
      return rank(a) - rank(b)
    })
  }, [renderedEdges, mode])

  return (
    <div className="space-y-3">
      {/* 1. Control Bar (Clean, no Zoom buttons) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/70 border border-border/70 rounded-lg px-3.5 py-2 text-xs">
        {/* Reset Selection button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetSelection}
            title="Clear Node Selection"
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={12} />
            <span>Reset Selection</span>
          </button>
          <span className="text-[11px] text-slate-500 font-mono">36 Nodes • Auto-Fitted</span>
        </div>

        {/* Mode-Specific Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
            <input
              type="checkbox"
              checked={showNodeLabels}
              onChange={(e) => setShowNodeLabels(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600 text-teal-400 focus:ring-0 cursor-pointer"
            />
            <span>Node labels</span>
          </label>

          {mode === 'max-flow' && (
            <>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={showFlowValues}
                  onChange={(e) => setShowFlowValues(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600 text-teal-400 focus:ring-0 cursor-pointer"
                />
                <span>Show flow values</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={showUnusedFlowEdges}
                  onChange={(e) => setShowUnusedFlowEdges(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600 text-teal-400 focus:ring-0 cursor-pointer"
                />
                <span>Show unused edges</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={showBottlenecksOnly}
                  onChange={(e) => setShowBottlenecksOnly(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600 text-rose-500 focus:ring-0 cursor-pointer"
                />
                <span>Highlight bottlenecks only</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={animateFlow}
                  onChange={(e) => setAnimateFlow(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600 text-teal-400 focus:ring-0 cursor-pointer"
                />
                <span>Animated flow</span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* 2. Main Visualization Canvas (Auto-fitted, Zero zoom interception) */}
      <div
        ref={containerRef}
        className="relative w-full bg-[#070b12] border border-border rounded-xl overflow-hidden shadow-2xl select-none flex items-center justify-center p-2"
        style={height ? { minHeight: height } : undefined}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-auto max-h-[530px] aspect-square mx-auto block"
          preserveAspectRatio="xMidYMid meet"
          onClick={handleSvgBackgroundClick}
        >
          <defs>
            {/* Radial dark background gradient */}
            <radialGradient id="net-bg-gradient" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#0d1422" />
              <stop offset="70%" stopColor="#070a12" />
              <stop offset="100%" stopColor="#04060a" />
            </radialGradient>

            {/* Subtle grid pattern */}
            <pattern id="net-grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="0.75" fill="#1e293b" opacity="0.45" />
            </pattern>

            {/* Arrowheads for Shortest Path and Max Flow */}
            <marker
              id="arrow-path"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 1 2 L 9 5 L 1 8 z" fill="#22d3c7" />
            </marker>

            <marker
              id="arrow-flow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 1 2 L 9 5 L 1 8 z" fill="#06b6d4" />
            </marker>

            <marker
              id="arrow-bottleneck"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M 1 1.5 L 9.5 5 L 1 8.5 z" fill="#f43f5e" />
            </marker>

            {/* Glow filters */}
            <filter id="glow-source" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-dest" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-highlight" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <style>{`
              @keyframes dashFlow {
                from { stroke-dashoffset: 24; }
                to { stroke-dashoffset: 0; }
              }
              .flow-anim-cyan {
                stroke-dasharray: 6 8;
                animation: dashFlow 1.1s linear infinite;
              }
              .flow-anim-bottleneck {
                stroke-dasharray: 6 6;
                animation: dashFlow 0.75s linear infinite;
              }
            `}</style>
          </defs>

          {/* Background fill & Grid */}
          <rect width={size} height={size} fill="url(#net-bg-gradient)" />
          <rect width={size} height={size} fill="url(#net-grid-dots)" />

          {/* Subtle perimeter circular guide ring */}
          <circle
            cx={center}
            cy={center}
            r={circleRadius}
            fill="none"
            stroke="#162235"
            strokeWidth="1"
            strokeDasharray="4 6"
            opacity="0.35"
          />

          {/* Fixed Scene Graph (No accidental zoom or pan) */}
          <g id="network-scene">
            {/* -------------------- EDGES LAYER -------------------- */}
            <g id="edges-layer">
              {sortedRenderedEdges.map((edge) => {
                const isHovered = hoveredEdge?.key === edge.key
                const isConnectedToSelected =
                  selectedNodeId !== null && (edge.from === selectedNodeId || edge.to === selectedNodeId)
                const isConnectedToHoveredNode =
                  hoveredNodeId !== null && (edge.from === hoveredNodeId || edge.to === hoveredNodeId)

                // Edge trimming to stop cleanly at node boundaries
                const r1 = edge.from === activeSourceId || edge.from === activeDestId ? 15 : 12
                const r2 = edge.to === activeSourceId || edge.to === activeDestId ? 15 : 12

                // Orientation
                let pStart = edge.p1
                let pEnd = edge.p2
                if (edge.dirFrom === edge.to) {
                  pStart = edge.p2
                  pEnd = edge.p1
                }

                const edx = pEnd.cx - pStart.cx
                const edy = pEnd.cy - pStart.cy
                const elen = Math.hypot(edx, edy) || 1
                const eux = edx / elen
                const euy = edy / elen

                const startX = pStart.cx + eux * r1
                const startY = pStart.cy + euy * r1
                const endX = pEnd.cx - eux * (r2 + 2)
                const endY = pEnd.cy - euy * (r2 + 2)

                // --- 1. SHORTEST PATH MODE ---
                if (mode === 'shortest-path') {
                  if (edge.isShortestPath) {
                    return (
                      <g
                        key={`sp-edge-${edge.key}`}
                        className="cursor-pointer"
                        onMouseEnter={(e) => {
                          setHoveredEdge(edge)
                          if (containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect()
                            setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                          }
                        }}
                        onMouseLeave={() => setHoveredEdge(null)}
                      >
                        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="transparent" strokeWidth={16} />
                        {/* Glow */}
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#22d3c7"
                          strokeWidth={isHovered ? 7 : 5}
                          strokeOpacity={0.3}
                          strokeLinecap="round"
                        />
                        {/* Main Path Line with Arrowhead */}
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#22d3c7"
                          strokeWidth={isHovered ? 3.8 : 3}
                          strokeLinecap="round"
                          markerEnd="url(#arrow-path)"
                        />
                      </g>
                    )
                  }

                  // Normal edge in Shortest Path
                  return (
                    <g
                      key={`edge-${edge.key}`}
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        setHoveredEdge(edge)
                        if (containerRef.current) {
                          const rect = containerRef.current.getBoundingClientRect()
                          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                        }
                      }}
                      onMouseLeave={() => setHoveredEdge(null)}
                    >
                      <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="transparent" strokeWidth={10} />
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke={isConnectedToSelected || isConnectedToHoveredNode || isHovered ? '#64748b' : '#1e293b'}
                        strokeWidth={isHovered ? 2 : 1.2}
                        strokeOpacity={isConnectedToSelected || isConnectedToHoveredNode || isHovered ? 0.9 : 0.35}
                      />
                    </g>
                  )
                }

                // --- 2. MAX FLOW MODE ---
                if (mode === 'max-flow') {
                  if (showBottlenecksOnly && !edge.isBottleneck) return null
                  if (!showUnusedFlowEdges && !edge.isFlowCarrying && !edge.isBottleneck) return null

                  // Bottleneck Edge
                  if (edge.isBottleneck) {
                    return (
                      <g
                        key={`mf-bn-${edge.key}`}
                        className="cursor-pointer"
                        onMouseEnter={(e) => {
                          setHoveredEdge(edge)
                          if (containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect()
                            setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                          }
                        }}
                        onMouseLeave={() => setHoveredEdge(null)}
                      >
                        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="transparent" strokeWidth={16} />
                        {/* Halo */}
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#f43f5e"
                          strokeWidth={isHovered ? 8 : 6}
                          strokeOpacity={0.35}
                          strokeLinecap="round"
                        />
                        {/* Main Stroke */}
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#f43f5e"
                          strokeWidth={isHovered ? 4.2 : 3.4}
                          strokeLinecap="round"
                          markerEnd="url(#arrow-bottleneck)"
                        />
                        {/* Animated Dash */}
                        {animateFlow && (
                          <line
                            x1={startX}
                            y1={startY}
                            x2={endX}
                            y2={endY}
                            stroke="#ffe4e6"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            className="flow-anim-bottleneck pointer-events-none"
                          />
                        )}
                        {/* Optional Flow Value Pill */}
                        {(showFlowValues || isHovered) && (
                          <g transform={`translate(${edge.midX}, ${edge.midY})`} className="pointer-events-none">
                            <rect
                              x="-26"
                              y="-9"
                              width="52"
                              height="18"
                              rx="4"
                              fill="#1e0c15"
                              stroke="#f43f5e"
                              strokeWidth="1"
                              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
                            />
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize="8.5"
                              fontFamily="monospace"
                              fill="#fda4af"
                              fontWeight="bold"
                            >
                              {edge.flow.toFixed(1)} / {edge.capacity.toFixed(1)}
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  }

                  // Flow-Carrying Edge
                  if (edge.isFlowCarrying) {
                    return (
                      <g
                        key={`mf-flow-${edge.key}`}
                        className="cursor-pointer"
                        onMouseEnter={(e) => {
                          setHoveredEdge(edge)
                          if (containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect()
                            setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                          }
                        }}
                        onMouseLeave={() => setHoveredEdge(null)}
                      >
                        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="transparent" strokeWidth={14} />
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#06b6d4"
                          strokeWidth={isHovered ? 6 : 4}
                          strokeOpacity={0.25}
                          strokeLinecap="round"
                        />
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#06b6d4"
                          strokeWidth={isHovered ? 3.4 : 2.6}
                          strokeLinecap="round"
                          markerEnd="url(#arrow-flow)"
                        />
                        {animateFlow && (
                          <line
                            x1={startX}
                            y1={startY}
                            x2={endX}
                            y2={endY}
                            stroke="#e0f2fe"
                            strokeWidth={1.6}
                            strokeLinecap="round"
                            className="flow-anim-cyan pointer-events-none"
                          />
                        )}
                        {(showFlowValues || isHovered) && (
                          <g transform={`translate(${edge.midX}, ${edge.midY})`} className="pointer-events-none">
                            <rect
                              x="-26"
                              y="-9"
                              width="52"
                              height="18"
                              rx="4"
                              fill="#081420"
                              stroke="#06b6d4"
                              strokeWidth="1"
                              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
                            />
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize="8.5"
                              fontFamily="monospace"
                              fill="#67e8f9"
                              fontWeight="bold"
                            >
                              {edge.flow.toFixed(1)} / {edge.capacity.toFixed(1)}
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  }

                  // Unused Edge in Max Flow
                  return (
                    <g
                      key={`mf-unused-${edge.key}`}
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        setHoveredEdge(edge)
                        if (containerRef.current) {
                          const rect = containerRef.current.getBoundingClientRect()
                          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                        }
                      }}
                      onMouseLeave={() => setHoveredEdge(null)}
                    >
                      <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="transparent" strokeWidth={10} />
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke={isConnectedToSelected || isConnectedToHoveredNode || isHovered ? '#64748b' : '#1e293b'}
                        strokeWidth={isHovered ? 2 : 1.2}
                        strokeOpacity={isConnectedToSelected || isConnectedToHoveredNode || isHovered ? 0.8 : 0.35}
                      />
                    </g>
                  )
                }

                // --- 3. EXPLORER / DEFAULT MODE ---
                const isVariantPath = edge.variant === 'path'
                return (
                  <g
                    key={`exp-${edge.key}`}
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      setHoveredEdge(edge)
                      if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect()
                        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                      }
                    }}
                    onMouseLeave={() => setHoveredEdge(null)}
                  >
                    <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="transparent" strokeWidth={10} />
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={isVariantPath ? '#22d3c7' : isHovered || isConnectedToSelected ? '#64748b' : '#1e293b'}
                      strokeWidth={isVariantPath ? 2.8 : isHovered ? 2 : 1.2}
                      strokeOpacity={isVariantPath ? 0.95 : isHovered || isConnectedToSelected ? 0.85 : 0.35}
                    />
                  </g>
                )
              })}
            </g>

            {/* -------------------- NODES LAYER -------------------- */}
            <g id="nodes-layer">
              {positionedNodes.map((n) => {
                const isSelected = selectedNodeId === n.id
                const isHovered = hoveredNodeId === n.id
                const isSource = n.id === activeSourceId
                const isDest = n.id === activeDestId
                const isPathNode = shortestPathResult?.path.includes(n.id) ?? false
                const isFlowAffected = flowAffectedNodeIds.has(n.id)

                // Fill color
                const trafficFill = n.traffic !== undefined ? trafficColor(n.traffic, minTraffic, maxTraffic) : '#1e293b'

                // Size
                let radius = isSource || isDest ? 14 : isPathNode || isFlowAffected ? 12.5 : 11
                if (isSelected) radius += 2.5
                else if (isHovered) radius += 1.5

                // Radial angle for outside badge placement
                const angle = Math.atan2(n.y, n.x)
                const badgeDist = circleRadius + 26
                const badgeX = center + Math.cos(angle) * badgeDist
                const badgeY = center + Math.sin(angle) * badgeDist

                return (
                  <g
                    key={`node-${n.id}`}
                    transform={`translate(${n.cx}, ${n.cy})`}
                    className="cursor-pointer"
                    onClick={(e) => handleNodeClick(n.id, e)}
                    onMouseEnter={() => setHoveredNodeId(n.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                  >
                    {/* Selected Node Ring */}
                    {isSelected && (
                      <circle
                        r={radius + 5}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                      />
                    )}

                    {/* SOURCE NODE */}
                    {isSource ? (
                      <>
                        <circle r={radius + 6} fill="none" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.35" />
                        <circle
                          r={radius}
                          fill="#064e3b"
                          stroke="#10b981"
                          strokeWidth={isSelected ? 3.5 : 2.5}
                          filter="url(#glow-source)"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={9.5}
                          fontWeight="800"
                          fill="#ffffff"
                          fontFamily="monospace"
                          className="pointer-events-none"
                        >
                          {n.id}
                        </text>
                        {/* Outside SOURCE badge */}
                        <g transform={`translate(${badgeX - n.cx}, ${badgeY - n.cy})`} className="pointer-events-none">
                          <rect
                            x="-20"
                            y="-7"
                            width="40"
                            height="14"
                            rx="3.5"
                            fill="#10b981"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.7))"
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="8"
                            fontWeight="900"
                            fill="#022c22"
                            letterSpacing="0.05em"
                          >
                            SOURCE
                          </text>
                        </g>
                      </>
                    ) : isDest ? (
                      /* DESTINATION / SINK NODE */
                      <>
                        <circle r={radius + 6} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeOpacity="0.35" />
                        <circle
                          r={radius}
                          fill="#4c1d95"
                          stroke="#a855f7"
                          strokeWidth={isSelected ? 3.5 : 2.5}
                          filter="url(#glow-dest)"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={9.5}
                          fontWeight="800"
                          fill="#ffffff"
                          fontFamily="monospace"
                          className="pointer-events-none"
                        >
                          {n.id}
                        </text>
                        {/* Outside SINK / DEST badge */}
                        <g transform={`translate(${badgeX - n.cx}, ${badgeY - n.cy})`} className="pointer-events-none">
                          <rect
                            x="-18"
                            y="-7"
                            width="36"
                            height="14"
                            rx="3.5"
                            fill="#a855f7"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.7))"
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="8"
                            fontWeight="900"
                            fill="#2e1065"
                            letterSpacing="0.05em"
                          >
                            {mode === 'max-flow' ? 'SINK' : 'DEST'}
                          </text>
                        </g>
                      </>
                    ) : isPathNode ? (
                      /* SHORTEST PATH NODE */
                      <>
                        <circle r={radius + 4} fill="none" stroke="#22d3c7" strokeWidth="1.5" strokeOpacity="0.4" />
                        <circle
                          r={radius}
                          fill={trafficFill}
                          stroke="#22d3c7"
                          strokeWidth={isSelected ? 3 : 2.2}
                          filter="url(#glow-highlight)"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={8.5}
                          fontWeight="800"
                          fill="#05080c"
                          fontFamily="monospace"
                          className="pointer-events-none"
                        >
                          {n.id}
                        </text>
                      </>
                    ) : isFlowAffected ? (
                      /* FLOW TRANSIT NODE */
                      <>
                        <circle r={radius + 3.5} fill="none" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.35" />
                        <circle
                          r={radius}
                          fill={trafficFill}
                          stroke="#06b6d4"
                          strokeWidth={isSelected ? 3 : 2}
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={8.5}
                          fontWeight="700"
                          fill="#05080c"
                          fontFamily="monospace"
                          className="pointer-events-none"
                        >
                          {n.id}
                        </text>
                      </>
                    ) : (
                      /* NORMAL NODE */
                      <>
                        <circle
                          r={radius}
                          fill={trafficFill}
                          stroke={isSelected ? '#38bdf8' : isHovered ? '#cbd5e1' : '#05080c'}
                          strokeWidth={isSelected ? 2.5 : 1.2}
                        />
                        {(showNodeLabels || isHovered || isSelected) && (
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={8}
                            fontWeight="700"
                            fill="#05080c"
                            fontFamily="monospace"
                            className="pointer-events-none"
                          >
                            {n.id}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                )
              })}
            </g>
          </g>
        </svg>

        {/* 3. PERSISTENT NODE DETAILS PANEL (Shown on Node Click) */}
        {selectedNodeData && mode !== 'explorer' && (
          <div
            className="absolute top-3.5 right-3.5 z-30 w-72 bg-slate-950/95 border border-slate-700/90 rounded-xl p-4 shadow-2xl backdrop-blur-md text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-border/80 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: trafficColor(selectedNodeData.traffic, minTraffic, maxTraffic) }}
                />
                <div>
                  <div className="text-[10px] text-teal-400 uppercase tracking-wider font-semibold">Node Details</div>
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    Intersection {selectedNodeData.id}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close Details Panel"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-slate-400">Node ID:</span>
                <span className="font-mono font-semibold text-white">{selectedNodeData.id}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-slate-400">Traffic (Hour {hour}):</span>
                <span className="font-mono font-bold text-teal-300">{selectedNodeData.traffic.toFixed(3)}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-slate-400">Selected Hour:</span>
                <span className="font-mono text-slate-300">{hour}:00</span>
              </div>

              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-slate-400">Network Degree:</span>
                <span className="font-mono font-semibold text-white">{selectedNodeData.degree} adjacent</span>
              </div>

              {selectedNodeData.no_roads !== undefined && selectedNodeData.no_roads > 0 && (
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-slate-400">No. of Roads:</span>
                  <span className="font-mono font-semibold text-white">{selectedNodeData.no_roads}</span>
                </div>
              )}

              {mode === 'shortest-path' && (
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-slate-400">Optimal Path Role:</span>
                  <span className="font-medium text-slate-200">
                    {selectedNodeData.isSource
                      ? 'Source (Origin)'
                      : selectedNodeData.isDestination
                      ? 'Destination (Target)'
                      : selectedNodeData.isOnShortestPath
                      ? 'On Shortest Path'
                      : 'Off-path node'}
                  </span>
                </div>
              )}

              {mode === 'max-flow' && (
                <>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-slate-400">Network Role:</span>
                    <span className="font-medium text-slate-200">
                      {selectedNodeData.isSource
                        ? 'Source Node'
                        : selectedNodeData.isDestination
                        ? 'Sink Node'
                        : selectedNodeData.participatesInFlow
                        ? 'Intermediate Flow Transit'
                        : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-slate-400">Flow Participation:</span>
                    <span
                      className={`font-semibold ${
                        selectedNodeData.participatesInFlow ? 'text-teal-300' : 'text-slate-400'
                      }`}
                    >
                      {selectedNodeData.participatesInFlow ? 'Yes' : 'No'}
                    </span>
                  </div>
                </>
              )}

              <div className="pt-1.5">
                <span className="text-slate-400 block mb-1">Connected Locations:</span>
                <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                  {selectedNodeData.connectedLocations.length > 0 ? (
                    selectedNodeData.connectedLocations.map((cid) => (
                      <button
                        key={cid}
                        onClick={() => setSelectedNodeId(cid)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                      >
                        {cid}
                      </button>
                    ))
                  ) : (
                    <span className="text-slate-500">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. HOVER TOOLTIP FOR EDGES */}
        {hoveredEdge && tooltipPos && (
          <div
            className="absolute z-40 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-md rounded-lg p-3 text-xs min-w-[180px] text-slate-200"
            style={{
              left: Math.max(90, Math.min(tooltipPos.x, (containerRef.current?.clientWidth ?? 600) - 90)),
              top: Math.max(50, tooltipPos.y),
            }}
          >
            <div className="flex items-center justify-between border-b border-border/80 pb-1.5 mb-1.5">
              <span className="font-mono font-bold text-white flex items-center gap-1.5">
                Node {hoveredEdge.dirFrom ?? hoveredEdge.from}{' '}
                <ArrowRight size={11} className="text-slate-400" /> Node {hoveredEdge.dirTo ?? hoveredEdge.to}
              </span>
              {mode === 'shortest-path' && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    hoveredEdge.isShortestPath
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {hoveredEdge.isShortestPath ? 'SHORTEST PATH' : 'NETWORK LINK'}
                </span>
              )}
              {mode === 'max-flow' && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    hoveredEdge.isBottleneck
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50'
                      : hoveredEdge.isFlowCarrying
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {hoveredEdge.isBottleneck
                    ? 'BOTTLENECK'
                    : hoveredEdge.isFlowCarrying
                    ? 'FLOW CARRYING'
                    : 'UNUSED'}
                </span>
              )}
            </div>

            {/* Edge properties */}
            {mode === 'shortest-path' && (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Traffic-based Cost:</span>
                  <span className="font-mono text-teal-300 font-bold">{hoveredEdge.weight?.toFixed(4) ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-medium text-slate-300">
                    {hoveredEdge.isShortestPath ? 'Shortest Path' : 'Normal Network Edge'}
                  </span>
                </div>
              </div>
            )}

            {mode === 'max-flow' && (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Modeled Flow:</span>
                  <span className="font-mono font-bold text-teal-300">{hoveredEdge.flow.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Modeled Edge Capacity:</span>
                  <span className="font-mono text-slate-300">{hoveredEdge.capacity.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Utilization:</span>
                  <span
                    className={`font-mono font-bold ${
                      hoveredEdge.isBottleneck ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {(hoveredEdge.utilization * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-[10px] pt-1 border-t border-border/50">
                  <span className="text-slate-400">Status:</span>
                  <span
                    className={
                      hoveredEdge.isBottleneck
                        ? 'text-rose-400 font-bold'
                        : hoveredEdge.isFlowCarrying
                        ? 'text-cyan-300 font-medium'
                        : 'text-slate-400'
                    }
                  >
                    {hoveredEdge.isBottleneck
                      ? 'MODELED BOTTLENECK'
                      : hoveredEdge.isFlowCarrying
                      ? 'Flow Carrying'
                      : 'Unused'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Clean Legend */}
      <div className="bg-slate-900/60 border border-border/70 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-6 text-xs text-slate-300">
        {/* Node types */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="font-medium text-slate-200">Source</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500 border border-purple-300 shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
            <span className="font-medium text-slate-200">
              {mode === 'max-flow' ? 'Sink (Destination)' : 'Destination'}
            </span>
          </div>
          {(mode === 'shortest-path' || mode === 'max-flow') && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-teal-500 border border-teal-300 shadow-[0_0_6px_rgba(34,211,199,0.5)]" />
              <span className="text-slate-300">
                {mode === 'shortest-path' ? 'Optimal Route Node' : 'Flow Transit Node'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-300/50" />
            <span className="text-slate-400">Traffic-Scaled Node</span>
          </div>
        </div>

        {/* Edge types */}
        <div className="flex flex-wrap items-center gap-4 pt-1 lg:pt-0 border-t lg:border-t-0 border-border/40">
          {mode === 'shortest-path' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-1 bg-teal-400 rounded-full inline-block shadow-[0_0_6px_rgba(34,211,199,0.6)]" />
                <span className="font-semibold text-teal-300">Optimal Shortest Path</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-slate-700 inline-block" />
                <span className="text-slate-400">Network Edge</span>
              </div>
            </>
          )}

          {mode === 'max-flow' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-1 bg-cyan-400 rounded-full inline-block shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                <span className="font-medium text-cyan-300">Flow-Carrying Edge</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-1 bg-rose-500 rounded-full inline-block shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                <span className="font-semibold text-rose-400">Modeled Bottleneck</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-slate-700 inline-block" />
                <span className="text-slate-400">Unused Edge</span>
              </div>
            </>
          )}

          {mode === 'explorer' && (
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 bg-slate-600 inline-block" />
              <span className="text-slate-400">Bidirectional Road Link</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
