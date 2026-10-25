import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Eye,
  EyeOff,
  Flame,
  Activity,
  Zap,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react'
import type { MaxFlowResult, NetworkData, NetworkNode } from '../types'

// Deterministic layout with collision resolution and optimal node separation (min dist > 65px)
export const DETERMINISTIC_NODE_COORDS: Record<number, { x: number; y: number }> = {
  0: { x: 670, y: 295 },
  1: { x: 740, y: 290 },
  2: { x: 835, y: 285 },
  3: { x: 925, y: 278 },
  4: { x: 445, y: 320 },
  5: { x: 360, y: 318 },
  6: { x: 265, y: 330 },
  7: { x: 175, y: 340 },
  8: { x: 405, y: 450 },
  9: { x: 365, y: 505 },
  10: { x: 475, y: 440 },
  11: { x: 275, y: 585 },
  12: { x: 340, y: 570 },
  13: { x: 488, y: 372 },
  14: { x: 595, y: 326 },
  15: { x: 75, y: 65 },
  16: { x: 135, y: 98 },
  17: { x: 195, y: 132 },
  18: { x: 255, y: 165 },
  19: { x: 315, y: 198 },
  20: { x: 375, y: 228 },
  21: { x: 435, y: 256 },
  22: { x: 480, y: 202 },
  23: { x: 520, y: 146 },
  24: { x: 572, y: 192 },
  25: { x: 530, y: 248 },
  26: { x: 530, y: 318 },
  27: { x: 760, y: 128 },
  28: { x: 705, y: 168 },
  29: { x: 600, y: 258 },
  30: { x: 785, y: 445 },
  31: { x: 558, y: 385 },
  32: { x: 855, y: 475 },
  33: { x: 710, y: 418 },
  34: { x: 632, y: 388 },
  35: { x: 650, y: 210 },
}

interface EdgeDisplayData {
  id: string
  from: number
  to: number
  flow: number
  capacity: number
  utilization: number
  isBottleneck: boolean
  isFlowCarrying: boolean
  x1: number
  y1: number
  x2: number
  y2: number
  midX: number
  midY: number
}

interface NodeDisplayData {
  id: number
  x: number
  y: number
  traffic: number
  noRoads: number
  degree: number
  isSource: boolean
  isSink: boolean
  isFlowAffected: boolean
}

interface TooltipInfo {
  type: 'node' | 'edge'
  x: number
  y: number
  nodeData?: NodeDisplayData
  edgeData?: EdgeDisplayData
}

interface MaxFlowNetworkGraphProps {
  network: NetworkData
  result: MaxFlowResult
  onNodeClick?: (nodeId: number) => void
}

export default function MaxFlowNetworkGraph({ network, result, onNodeClick }: MaxFlowNetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Interactive controls state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  // Toggles
  const [showFlowValues, setShowFlowValues] = useState(true)
  const [showUnusedEdges, setShowUnusedEdges] = useState(true)
  const [showBottlenecksOnly, setShowBottlenecksOnly] = useState(false)
  const [animateFlow, setAnimateFlow] = useState(true)

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const sourceId = result.source
  const destinationId = result.destination

  // Map result edges by standardized edge key
  const edgeResultMap = useMemo(() => {
    const map = new Map<string, typeof result.edges[0]>()
    result.edges.forEach((e) => {
      const minN = Math.min(e.from, e.to)
      const maxN = Math.max(e.from, e.to)
      map.set(`${minN}-${maxN}`, e)
    })
    return map
  }, [result.edges])

  // Identify nodes participating in positive flow
  const flowAffectedNodeIds = useMemo(() => {
    const set = new Set<number>()
    result.edges.forEach((e) => {
      if (e.flow > 1e-4) {
        set.add(e.from)
        set.add(e.to)
      }
    })
    return set
  }, [result.edges])

  // Build processed nodes data
  const nodes = useMemo<NodeDisplayData[]>(() => {
    const nodeMap = new Map<number, NetworkNode>()
    network.nodes.forEach((n) => nodeMap.set(n.id, n))

    const list: NodeDisplayData[] = []
    for (let id = 0; id < 36; id++) {
      const netNode = nodeMap.get(id)
      const coords = DETERMINISTIC_NODE_COORDS[id] || { x: 500, y: 350 }
      list.push({
        id,
        x: coords.x,
        y: coords.y,
        traffic: netNode?.traffic ?? 0,
        noRoads: netNode?.no_roads ?? 0,
        degree: netNode?.degree ?? 0,
        isSource: id === sourceId,
        isSink: id === destinationId,
        isFlowAffected: flowAffectedNodeIds.has(id),
      })
    }
    return list
  }, [network.nodes, sourceId, destinationId, flowAffectedNodeIds])

  const nodeMap = useMemo(() => {
    const map = new Map<number, NodeDisplayData>()
    nodes.forEach((n) => map.set(n.id, n))
    return map
  }, [nodes])

  // Build processed edges data with geometry & flow orientation
  const edges = useMemo<EdgeDisplayData[]>(() => {
    return network.edges.map((baseEdge) => {
      const minN = Math.min(baseEdge.from, baseEdge.to)
      const maxN = Math.max(baseEdge.from, baseEdge.to)
      const key = `${minN}-${maxN}`
      const res = edgeResultMap.get(key)

      const flow = res?.flow ?? 0
      const capacity = res?.capacity ?? 0
      const utilization = res?.utilization ?? 0
      const isBottleneck = res?.is_bottleneck ?? false
      const isFlowCarrying = flow > 1e-4

      // Direction: orient from active source to target if positive flow exists
      let u = baseEdge.from
      let v = baseEdge.to
      if (res && isFlowCarrying) {
        u = res.from
        v = res.to
      }

      const p1 = nodeMap.get(u) || { x: 0, y: 0 }
      const p2 = nodeMap.get(v) || { x: 0, y: 0 }

      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2

      return {
        id: key,
        from: u,
        to: v,
        flow,
        capacity,
        utilization,
        isBottleneck,
        isFlowCarrying,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        midX,
        midY,
      }
    })
  }, [network.edges, edgeResultMap, nodeMap])

  // Mouse pan & zoom handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      })
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    setZoom((prev) => Math.min(3.0, Math.max(0.55, prev * zoomFactor)))
  }, [])

  const handleResetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Node hover handler
  const handleNodeMouseEnter = (e: React.MouseEvent, node: NodeDisplayData) => {
    setHoveredNodeId(node.id)
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setTooltip({
        type: 'node',
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        nodeData: node,
      })
    }
  }

  // Edge hover handler
  const handleEdgeMouseEnter = (e: React.MouseEvent, edge: EdgeDisplayData) => {
    setHoveredEdgeId(edge.id)
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setTooltip({
        type: 'edge',
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        edgeData: edge,
      })
    }
  }

  const handleMouseLeaveTarget = () => {
    setHoveredNodeId(null)
    setHoveredEdgeId(null)
    setTooltip(null)
  }

  // Sort edges so normal edges render first, flow edges on top, and bottlenecks on the very top
  const sortedEdges = useMemo(() => {
    return [...edges].sort((a, b) => {
      const rank = (e: EdgeDisplayData) => (e.isBottleneck ? 3 : e.isFlowCarrying ? 2 : 1)
      return rank(a) - rank(b)
    })
  }, [edges])

  return (
    <div className="space-y-3">
      {/* 1. Header Bar Display */}
      <div className="bg-slate-900/90 border border-border/80 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div>
          <div className="text-xs uppercase tracking-wider font-semibold text-teal-400 flex items-center gap-2">
            <Zap size={14} className="text-teal-400" />
            Maximum Flow Network Architecture
          </div>
          <div className="text-sm font-medium text-slate-200 mt-0.5">
            Abstract 36-Location Traffic Capacity Optimization
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 font-sans">Source:</span> Node {sourceId}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-slate-400 font-sans">Destination:</span> Node {destinationId}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
            <span className="text-slate-400 font-sans">Hour:</span> {result.hour}:00
          </div>
          <div className="px-3.5 py-1.5 rounded-lg bg-teal-950/70 border border-teal-500/50 text-teal-300 font-mono font-bold">
            <span className="text-slate-400 font-sans font-normal">Max Modeled Flow:</span> {result.max_flow.toFixed(3)}
          </div>
        </div>
      </div>

      {/* 2. Interactive Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/60 border border-border/60 rounded-lg px-3.5 py-2 text-xs">
        {/* Navigation & Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.min(3.0, z * 1.2))}
            title="Zoom In"
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.55, z / 1.2))}
            title="Zoom Out"
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleResetView}
            title="Reset View / Fit Network"
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={13} />
            <span>Reset View</span>
          </button>
          <span className="text-slate-500 font-mono ml-1">{Math.round(zoom * 100)}%</span>
        </div>

        {/* View toggles */}
        <div className="flex flex-wrap items-center gap-3">
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
              checked={showUnusedEdges}
              onChange={(e) => setShowUnusedEdges(e.target.checked)}
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
        </div>
      </div>

      {/* 3. Main SVG Visualization Panel */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`relative w-full h-[580px] bg-[#070b12] border border-border rounded-xl overflow-hidden shadow-2xl select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <svg
          viewBox="0 0 1020 680"
          className="w-full h-full block"
          style={{
            transformOrigin: '50% 50%',
          }}
        >
          <defs>
            {/* Subtle technical background grid */}
            <pattern id="mf-grid-dots" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="0.8" fill="#1e293b" opacity="0.6" />
            </pattern>
            <pattern id="mf-grid-lines" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#172233" strokeWidth="0.5" opacity="0.45" />
            </pattern>

            {/* Subtle radial background gradient */}
            <radialGradient id="mf-canvas-gradient" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stopColor="#0c1320" />
              <stop offset="65%" stopColor="#070a12" />
              <stop offset="100%" stopColor="#04060a" />
            </radialGradient>

            {/* Directional Arrowheads */}
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

            {/* Glow filters for Source, Sink, and Bottlenecks */}
            <filter id="glow-source" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-sink" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-bottleneck" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* CSS Animation Keyframes */}
            <style>{`
              @keyframes dashFlow {
                from { stroke-dashoffset: 28; }
                to { stroke-dashoffset: 0; }
              }
              .mf-flowing-cyan {
                stroke-dasharray: 6 10;
                animation: dashFlow 1.1s linear infinite;
              }
              .mf-flowing-bottleneck {
                stroke-dasharray: 7 8;
                animation: dashFlow 0.75s linear infinite;
              }
            `}</style>
          </defs>

          {/* Background fill & Grid */}
          <rect width="1020" height="680" fill="url(#mf-canvas-gradient)" />
          <rect width="1020" height="680" fill="url(#mf-grid-dots)" />
          <rect width="1020" height="680" fill="url(#mf-grid-lines)" />

          {/* Pannable & Zoomable Scene Graph */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            transform-origin="510 340"
          >
            {/* -------------------- EDGES LAYER -------------------- */}
            <g id="edges-layer">
              {sortedEdges.map((edge) => {
                const isHovered = hoveredEdgeId === edge.id
                const isConnectedToHoveredNode =
                  hoveredNodeId !== null && (edge.from === hoveredNodeId || edge.to === hoveredNodeId)

                // Edge geometry calculation with node boundaries
                const dx = edge.x2 - edge.x1
                const dy = edge.y2 - edge.y1
                const dist = Math.hypot(dx, dy) || 1
                const ux = dx / dist
                const uy = dy / dist

                const r1 = edge.from === sourceId || edge.from === destinationId ? 22 : 17
                const r2 = edge.to === sourceId || edge.to === destinationId ? 22 : 17

                // Trim line to stop precisely at node perimeter (plus small gap for arrow)
                const startX = edge.x1 + ux * r1
                const startY = edge.y1 + uy * r1
                const endX = edge.x2 - ux * (r2 + 3)
                const endY = edge.y2 - uy * (r2 + 3)

                // Perpendicular offset for edge label to prevent line crossing
                const perpX = -uy * 14
                const perpY = ux * 14
                const labelX = edge.midX + perpX
                const labelY = edge.midY + perpY

                // Render conditions
                if (!showUnusedEdges && !edge.isFlowCarrying && !edge.isBottleneck) {
                  return null
                }
                if (showBottlenecksOnly && !edge.isBottleneck) {
                  return null
                }

                // Bottleneck Edge
                if (edge.isBottleneck) {
                  return (
                    <g
                      key={`edge-${edge.id}`}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleEdgeMouseEnter(e, edge)}
                      onMouseLeave={handleMouseLeaveTarget}
                    >
                      {/* Thick transparent hit-area */}
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="transparent"
                        strokeWidth={18}
                      />
                      {/* Ambient Glow */}
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="#f43f5e"
                        strokeWidth={isHovered ? 8 : 6}
                        strokeOpacity={0.35}
                        strokeLinecap="round"
                        filter="url(#glow-bottleneck)"
                      />
                      {/* Base Bottleneck Stroke */}
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="#f43f5e"
                        strokeWidth={isHovered ? 4.5 : 3.5}
                        strokeLinecap="round"
                        markerEnd="url(#arrow-bottleneck)"
                      />
                      {/* Animated Flow Dashes */}
                      {animateFlow && (
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#ffe4e6"
                          strokeWidth={2}
                          strokeLinecap="round"
                          className="mf-flowing-bottleneck pointer-events-none"
                        />
                      )}
                      {/* Edge Flow Label Pill */}
                      {(showFlowValues || isHovered) && (
                        <g
                          transform={`translate(${labelX}, ${labelY})`}
                          className="pointer-events-none transition-all duration-150"
                        >
                          <rect
                            x="-28"
                            y="-10"
                            width="56"
                            height="20"
                            rx="5"
                            fill="#1e0c15"
                            stroke="#f43f5e"
                            strokeWidth="1.2"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="9"
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
                      key={`edge-${edge.id}`}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleEdgeMouseEnter(e, edge)}
                      onMouseLeave={handleMouseLeaveTarget}
                    >
                      {/* Thick transparent hit-area */}
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="transparent"
                        strokeWidth={16}
                      />
                      {/* Flow Glow */}
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
                      {/* Base Flow Stroke */}
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="#06b6d4"
                        strokeWidth={isHovered ? 3.5 : 2.6}
                        strokeLinecap="round"
                        markerEnd="url(#arrow-flow)"
                      />
                      {/* Animated Flow Dashes */}
                      {animateFlow && (
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#e0f2fe"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          className="mf-flowing-cyan pointer-events-none"
                        />
                      )}
                      {/* Edge Flow Label Pill */}
                      {(showFlowValues || isHovered) && (
                        <g
                          transform={`translate(${labelX}, ${labelY})`}
                          className="pointer-events-none transition-all duration-150"
                        >
                          <rect
                            x="-28"
                            y="-10"
                            width="56"
                            height="20"
                            rx="5"
                            fill="#081420"
                            stroke="#06b6d4"
                            strokeWidth="1.2"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize="9"
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

                // Unused Edge
                return (
                  <g
                    key={`edge-${edge.id}`}
                    className="cursor-pointer"
                    onMouseEnter={(e) => handleEdgeMouseEnter(e, edge)}
                    onMouseLeave={handleMouseLeaveTarget}
                  >
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="transparent"
                      strokeWidth={12}
                    />
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke={isConnectedToHoveredNode || isHovered ? '#64748b' : '#1e293b'}
                      strokeWidth={isHovered ? 2 : 1.2}
                      strokeOpacity={isConnectedToHoveredNode || isHovered ? 0.9 : 0.45}
                      strokeDasharray={isHovered ? '4 3' : undefined}
                    />
                    {isHovered && (
                      <g transform={`translate(${labelX}, ${labelY})`} className="pointer-events-none">
                        <rect
                          x="-26"
                          y="-9"
                          width="52"
                          height="18"
                          rx="4"
                          fill="#0f172a"
                          stroke="#334155"
                          strokeWidth="1"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="8.5"
                          fontFamily="monospace"
                          fill="#94a3b8"
                        >
                          0 / {edge.capacity.toFixed(1)}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
            </g>

            {/* -------------------- NODES LAYER -------------------- */}
            <g id="nodes-layer">
              {nodes.map((node) => {
                const isHovered = hoveredNodeId === node.id

                // 1. SOURCE NODE
                if (node.isSource) {
                  return (
                    <g
                      key={`node-${node.id}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      className="cursor-pointer"
                      onClick={() => onNodeClick?.(node.id)}
                      onMouseEnter={(e) => handleNodeMouseEnter(e, node)}
                      onMouseLeave={handleMouseLeaveTarget}
                    >
                      {/* Pulse halo */}
                      <circle
                        r={30}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeOpacity="0.3"
                        strokeDasharray="4 4"
                      />
                      <circle
                        r={24}
                        fill="#064e3b"
                        stroke="#10b981"
                        strokeWidth="3"
                        filter="url(#glow-source)"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="13"
                        fontWeight="800"
                        fill="#ffffff"
                        fontFamily="monospace"
                        className="pointer-events-none"
                      >
                        {node.id}
                      </text>
                      {/* Source Badge Pill */}
                      <g transform="translate(0, -32)" className="pointer-events-none">
                        <rect
                          x="-24"
                          y="-8"
                          width="48"
                          height="16"
                          rx="4"
                          fill="#10b981"
                          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="9"
                          fontWeight="900"
                          fill="#022c22"
                          letterSpacing="0.05em"
                        >
                          SOURCE
                        </text>
                      </g>
                    </g>
                  )
                }

                // 2. SINK / DESTINATION NODE
                if (node.isSink) {
                  return (
                    <g
                      key={`node-${node.id}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      className="cursor-pointer"
                      onClick={() => onNodeClick?.(node.id)}
                      onMouseEnter={(e) => handleNodeMouseEnter(e, node)}
                      onMouseLeave={handleMouseLeaveTarget}
                    >
                      {/* Pulse halo */}
                      <circle
                        r={30}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="1.5"
                        strokeOpacity="0.3"
                        strokeDasharray="4 4"
                      />
                      <circle
                        r={24}
                        fill="#4c1d95"
                        stroke="#a855f7"
                        strokeWidth="3"
                        filter="url(#glow-sink)"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="13"
                        fontWeight="800"
                        fill="#ffffff"
                        fontFamily="monospace"
                        className="pointer-events-none"
                      >
                        {node.id}
                      </text>
                      {/* Sink Badge Pill */}
                      <g transform="translate(0, -32)" className="pointer-events-none">
                        <rect
                          x="-20"
                          y="-8"
                          width="40"
                          height="16"
                          rx="4"
                          fill="#a855f7"
                          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="9"
                          fontWeight="900"
                          fill="#2e1065"
                          letterSpacing="0.05em"
                        >
                          SINK
                        </text>
                      </g>
                    </g>
                  )
                }

                // 3. FLOW-AFFECTED INTERMEDIATE NODE
                if (node.isFlowAffected) {
                  return (
                    <g
                      key={`node-${node.id}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      className="cursor-pointer"
                      onClick={() => onNodeClick?.(node.id)}
                      onMouseEnter={(e) => handleNodeMouseEnter(e, node)}
                      onMouseLeave={handleMouseLeaveTarget}
                    >
                      {/* Subtle cyan ring */}
                      <circle
                        r={22}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="1"
                        strokeOpacity={isHovered ? 0.7 : 0.25}
                      />
                      <circle
                        r={17}
                        fill="#0b2434"
                        stroke="#06b6d4"
                        strokeWidth={isHovered ? 2.5 : 1.8}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="10.5"
                        fontWeight="700"
                        fill="#e0f2fe"
                        fontFamily="monospace"
                        className="pointer-events-none"
                      >
                        {node.id}
                      </text>
                    </g>
                  )
                }

                // 4. NORMAL NETWORK NODE
                return (
                  <g
                    key={`node-${node.id}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer"
                    onClick={() => onNodeClick?.(node.id)}
                    onMouseEnter={(e) => handleNodeMouseEnter(e, node)}
                    onMouseLeave={handleMouseLeaveTarget}
                  >
                    <circle
                      r={isHovered ? 18 : 15}
                      fill="#0f172a"
                      stroke={isHovered ? '#64748b' : '#334155'}
                      strokeWidth={isHovered ? 2 : 1.2}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="10"
                      fontWeight="600"
                      fill={isHovered ? '#f1f5f9' : '#94a3b8'}
                      fontFamily="monospace"
                      className="pointer-events-none"
                    >
                      {node.id}
                    </text>
                  </g>
                )
              })}
            </g>
          </g>
        </svg>

        {/* 4. Professional Tooltip Overlay */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-md rounded-lg p-3 text-xs min-w-[190px] text-slate-200"
            style={{
              left: Math.max(100, Math.min(tooltip.x, (containerRef.current?.clientWidth ?? 900) - 100)),
              top: Math.max(70, tooltip.y),
            }}
          >
            {tooltip.type === 'node' && tooltip.nodeData && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-border/80 pb-1.5">
                  <span className="font-bold text-white text-sm">Location {tooltip.nodeData.id}</span>
                  {tooltip.nodeData.isSource ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                      SOURCE
                    </span>
                  ) : tooltip.nodeData.isSink ? (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px]">
                      SINK
                    </span>
                  ) : tooltip.nodeData.isFlowAffected ? (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold text-[10px]">
                      FLOW NODE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">INACTIVE</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Traffic (Hr {result.hour}):</span>
                  <span className="font-mono font-medium text-slate-200">{tooltip.nodeData.traffic.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Connected Roads:</span>
                  <span className="font-mono text-slate-300">{tooltip.nodeData.noRoads}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Network Degree:</span>
                  <span className="font-mono text-slate-300">{tooltip.nodeData.degree} links</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-border/50">
                  Role:{' '}
                  {tooltip.nodeData.isSource
                    ? 'Flow Origin'
                    : tooltip.nodeData.isSink
                    ? 'Flow Destination'
                    : tooltip.nodeData.isFlowAffected
                    ? 'Intermediate Transit Node'
                    : 'Unused in Optimal Flow'}
                </div>
              </div>
            )}

            {tooltip.type === 'edge' && tooltip.edgeData && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-border/80 pb-1.5">
                  <span className="font-mono font-bold text-white text-sm flex items-center gap-1.5">
                    Node {tooltip.edgeData.from} <ArrowRight size={12} className="text-slate-400" /> Node{' '}
                    {tooltip.edgeData.to}
                  </span>
                  {tooltip.edgeData.isBottleneck ? (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-500/50 text-rose-300 font-bold text-[9px]">
                      BOTTLENECK
                    </span>
                  ) : tooltip.edgeData.isFlowCarrying ? (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[9px]">
                      ACTIVE FLOW
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px]">UNUSED</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Modeled Flow:</span>
                  <span className="font-mono font-bold text-teal-300">{tooltip.edgeData.flow.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Modeled Edge Capacity:</span>
                  <span className="font-mono text-slate-300">{tooltip.edgeData.capacity.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Capacity Utilization:</span>
                  <span
                    className={`font-mono font-bold ${
                      tooltip.edgeData.isBottleneck
                        ? 'text-rose-400'
                        : tooltip.edgeData.utilization > 0.7
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {(tooltip.edgeData.utilization * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="pt-1 border-t border-border/50 text-[10px]">
                  <span className="text-slate-500">Status: </span>
                  <span
                    className={
                      tooltip.edgeData.isBottleneck
                        ? 'text-rose-400 font-bold'
                        : tooltip.edgeData.isFlowCarrying
                        ? 'text-cyan-300 font-medium'
                        : 'text-slate-400'
                    }
                  >
                    {tooltip.edgeData.isBottleneck
                      ? 'MODELED BOTTLENECK'
                      : tooltip.edgeData.isFlowCarrying
                      ? 'Flow Carrying'
                      : 'Unused in Solution'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Clean Legend */}
      <div className="bg-slate-900/60 border border-border/70 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-6 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="font-medium text-slate-200">Source (Origin)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-purple-500 border border-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
            <span className="font-medium text-slate-200">Destination (Sink)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-900 border border-cyan-400" />
            <span className="text-slate-300">Flow Transit Node</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-600" />
            <span className="text-slate-400">Normal Node</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 pt-1 lg:pt-0 border-t lg:border-t-0 border-border/40">
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 bg-slate-700 inline-block" />
            <span className="text-slate-400">Unused Edge</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 bg-cyan-400 rounded-full inline-block shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
            <span className="font-medium text-cyan-300">Flow-Carrying Edge</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 bg-rose-500 rounded-full inline-block shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            <span className="font-semibold text-rose-400">Modeled Bottleneck</span>
          </div>
        </div>
      </div>
    </div>
  )
}
