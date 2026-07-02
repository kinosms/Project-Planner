import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'

// ─── 색상 ────────────────────────────────────────────────────────
const SCORE_COLOR = s => s>=90?'#22c55e':s>=70?'#3b82f6':s>=50?'#eab308':s>=30?'#f97316':'#ef4444'
const DIM_COLOR   = '#374151'   // dim 상태 노드 색
const DIM_ALPHA   = 0.18        // dim 상태 투명도

const CLUSTER_COLORS = [
  '#818cf8','#34d399','#f472b6','#fb923c',
  '#38bdf8','#a78bfa','#4ade80','#fb7185',
  '#e879f9','#facc15','#2dd4bf','#60a5fa',
  '#f87171','#c084fc',
]

// hex + alpha → rgba string
const toRgba = (hex, a) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

// ─── 유틸 ────────────────────────────────────────────────────────
const extractFuncNames = (flowArr, knownSet) => {
  const found = new Set()
  flowArr.forEach(step => knownSet.forEach(n => { if (step.includes(n)) found.add(n) }))
  return [...found]
}
const extractFuncNamesOrdered = (flowArr, knownSet) => {
  const result = [], seen = new Set()
  flowArr.forEach(step => knownSet.forEach(n => {
    if (step.includes(n) && !seen.has(n)) { seen.add(n); result.push(n) }
  }))
  return result
}

// ─── buildGraphData ───────────────────────────────────────────────
function buildGraphData(functionList, featureList) {
  const knownSet = new Set(functionList.map(f => f.name))
  const featureColorMap = {}
  featureList.forEach((feat, i) => { featureColorMap[feat.name] = CLUSTER_COLORS[i % CLUSTER_COLORS.length] })
  const nodeFeatureMap = {}
  featureList.forEach(feat => {
    extractFuncNames(feat.flow, knownSet).forEach(name => {
      if (!nodeFeatureMap[name]) nodeFeatureMap[name] = feat.name
    })
  })
  const edgeSet = new Set(), rawLinks = []
  functionList.forEach(f => {
    f.calledBy.forEach(callerStr => {
      knownSet.forEach(callerName => {
        if (callerStr.includes(callerName) && callerName !== f.name) {
          const key = `${callerName}→${f.name}`
          if (!edgeSet.has(key)) { edgeSet.add(key); rawLinks.push({ source: callerName, target: f.name }) }
        }
      })
    })
  })
  const degree = {}
  rawLinks.forEach(({ source, target }) => {
    degree[source] = (degree[source] || 0) + 1
    degree[target] = (degree[target] || 0) + 1
  })
  const nodes = functionList.map(f => ({
    id: f.name, name: f.name, score: f.score, calls: f.calls,
    file: f.file, role: f.role, srp: f.srp, refactor: f.refactor,
    dupRisk: f.dupRisk, deadCode: f.deadCode, unused: f.unused,
    featureGroup: nodeFeatureMap[f.name] || '기타',
    featureColor: featureColorMap[nodeFeatureMap[f.name]] || '#475569',
    degree: degree[f.name] || 0,
  }))
  return { nodes, links: rawLinks, rawLinks }
}

// ─── Tooltip ─────────────────────────────────────────────────────
function Tooltip({ node, pos, visible }) {
  if (!node || !visible) return null
  return (
    <div className="graph-tooltip" style={{ left: pos.x + 18, top: pos.y - 10 }}>
      <div className="graph-tooltip-name">{node.name}</div>
      <div className="graph-tooltip-score" style={{ color: SCORE_COLOR(node.score) }}>무결성 {node.score}점</div>
      <div className="graph-tooltip-row">호출 {node.calls} · 연결 {node.degree}</div>
      <div className="graph-tooltip-row" style={{ color: node.featureColor }}>{node.featureGroup}</div>
      <div className="graph-tooltip-row">{node.file}</div>
    </div>
  )
}

// ─── Focus Bar ───────────────────────────────────────────────────
function FocusBar({ selectedNodeId, selectedFeatureId, nodeData, featureList, featureColorMap, onClear }) {
  if (!selectedNodeId && !selectedFeatureId) return null
  if (selectedNodeId) {
    const node = nodeData.find(n => n.id === selectedNodeId)
    if (!node) return null
    return (
      <div className="graph-focus-bar">
        <span className="gfb-type">FUNCTION</span>
        <span className="gfb-dot" style={{ background: SCORE_COLOR(node.score) }} />
        <span className="gfb-name">{node.name}</span>
        <span className="gfb-score" style={{ color: SCORE_COLOR(node.score) }}>{node.score}점</span>
        <span className="gfb-file">{node.file}</span>
        <button className="gfb-clear" onClick={onClear}>✕</button>
      </div>
    )
  }
  const feat = featureList.find(f => f.name === selectedFeatureId)
  if (!feat) return null
  const color = featureColorMap[selectedFeatureId] || '#60a5fa'
  return (
    <div className="graph-focus-bar">
      <span className="gfb-type">FEATURE</span>
      <span className="gfb-dot" style={{ background: color }} />
      <span className="gfb-name">{feat.name}</span>
      <span className="gfb-score" style={{ color: feat.score>=80?'#22c55e':feat.score>=60?'#eab308':'#ef4444' }}>{feat.score}점</span>
      <button className="gfb-clear" onClick={onClear}>✕</button>
    </div>
  )
}

// ─── Legend ──────────────────────────────────────────────────────
const Legend = () => (
  <div className="graph-legend">
    <div className="graph-legend-title">INTEGRITY SCORE</div>
    {[['#22c55e','90–100 안정'],['#3b82f6','70–89 양호'],['#eab308','50–69 주의'],['#f97316','30–49 위험'],['#ef4444','0–29 위기']].map(([c,l]) => (
      <div key={l} className="graph-legend-row">
        <span className="graph-legend-dot" style={{ background:c, boxShadow:`0 0 5px ${c}` }} />{l}
      </div>
    ))}
    <div className="graph-legend-divider" />
    <div className="graph-legend-row" style={{ color:'#334155' }}>
      <span className="graph-legend-line" />엣지 = 함수 호출 방향
    </div>
    <div className="graph-legend-row" style={{ color:'#334155' }}>
      <span className="graph-legend-glow" />클러스터 = Feature
    </div>
  </div>
)

// ─── Side Panel ───────────────────────────────────────────────────
function SidePanel({
  functionList, fullFunctionList, featureList, scenarioList,
  selectedNodeId, selectedFeatureId, selectedScenarioId,
  onSelectNode, onSelectFeature, onSelectScenario,
  searchTerm, setSearchTerm, filter, setFilter,
}) {
  const fnRef   = useRef(null)
  const featRef = useRef(null)
  const scRef   = useRef(null)
  const [sideTab, setSideTab] = useState('fn')

  useEffect(() => {
    if (!selectedNodeId || !fnRef.current) return
    setSideTab('fn')
    fnRef.current.querySelector(`[data-id="${CSS.escape(selectedNodeId)}"]`)
      ?.scrollIntoView({ behavior:'smooth', block:'nearest' })
  }, [selectedNodeId])

  useEffect(() => {
    if (!selectedFeatureId || !featRef.current) return
    setSideTab('feat')
    featRef.current.querySelector(`[data-id="${CSS.escape(selectedFeatureId)}"]`)
      ?.scrollIntoView({ behavior:'smooth', block:'nearest' })
  }, [selectedFeatureId])

  useEffect(() => {
    if (!selectedScenarioId || !scRef.current) return
    setSideTab('sc')
    scRef.current.querySelector(`[data-id="${CSS.escape(selectedScenarioId)}"]`)
      ?.scrollIntoView({ behavior:'smooth', block:'nearest' })
  }, [selectedScenarioId])

  return (
    <div className="graph-side-panel">
      <div className="gsp-tabs">
        {[{id:'fn',label:'FN',count:fullFunctionList.length},{id:'feat',label:'FEAT',count:featureList.length},{id:'sc',label:'SC',count:scenarioList?.length||0}].map(t => (
          <button key={t.id} className={['gsp-tab-btn', sideTab===t.id?'active':''].join(' ')} onClick={() => setSideTab(t.id)}>
            {t.label} <span className="gsp-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {sideTab === 'fn' && (
        <div className="gsp-controls">
          <input className="gsp-search" placeholder="함수명 / ID 검색..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <div className="gsp-filter-row">
            {[{id:'all',label:'ALL'},{id:'critical',label:'<60'},{id:'refactor',label:'REFAC'}].map(f => (
              <button key={f.id}
                className={['gsp-filter-btn', filter===f.id?'active':''].join(' ')}
                onClick={() => setFilter(f.id)}>{f.label}</button>
            ))}
          </div>
        </div>
      )}

      {sideTab === 'fn' && (
        <div className="gsp-section" style={{ flex:1 }}>
          <div className="gsp-section-title">
            FUNCTIONS <span className="gsp-count">{functionList.length}
            {functionList.length < fullFunctionList.length && ` / ${fullFunctionList.length}`}</span>
          </div>
          <div className="gsp-list" ref={fnRef}>
            {functionList.map((f, i) => (
              <div key={f.name} data-id={f.name}
                className={['gsp-item', selectedNodeId===f.name?'selected':''].join(' ')}
                onClick={() => onSelectNode(f.name)}
              >
                <span className="gsp-id">FN-{String(i+1).padStart(3,'0')}</span>
                <span className="gsp-dot" style={{ background:SCORE_COLOR(f.score), boxShadow:`0 0 4px ${SCORE_COLOR(f.score)}` }} />
                <span className="gsp-name">{f.name}</span>
                <span className="gsp-score" style={{ color:SCORE_COLOR(f.score) }}>{f.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sideTab === 'feat' && (
        <div className="gsp-section" style={{ flex:1 }}>
          <div className="gsp-section-title">FEATURES <span className="gsp-count">{featureList.length}</span></div>
          <div className="gsp-list" ref={featRef}>
            {featureList.map((f, i) => {
              const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length]
              return (
                <div key={f.name} data-id={f.name}
                  className={['gsp-item gsp-feat-item', selectedFeatureId===f.name?'selected':''].join(' ')}
                  onClick={() => onSelectFeature(f.name)}
                >
                  <span className="gsp-id">F-{String(101+i)}</span>
                  <span className="gsp-dot" style={{ background:color, boxShadow:`0 0 5px ${color}` }} />
                  <span className="gsp-name">{f.name}</span>
                  <span className="gsp-score" style={{ color:f.score>=80?'#22c55e':f.score>=60?'#eab308':'#ef4444' }}>{f.score}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sideTab === 'sc' && (
        <div className="gsp-section" style={{ flex:1 }}>
          <div className="gsp-section-title">SCENARIOS <span className="gsp-count">{scenarioList?.length||0}</span></div>
          <div className="gsp-list" ref={scRef}>
            {(scenarioList||[]).map(sc => (
              <div key={sc.id} data-id={sc.id}
                className={['gsp-item', selectedScenarioId===sc.id?'selected':''].join(' ')}
                onClick={() => onSelectScenario?.(sc.id)}
              >
                <span className="gsp-id">{sc.id}</span>
                <span className={['gsp-risk-dot', sc.riskLevel==='높음'?'risk-h':sc.riskLevel==='중간'?'risk-m':'risk-l'].join(' ')} />
                <span className="gsp-name">{sc.name}</span>
                <span className="gsp-score" style={{ color:sc.score>=80?'#22c55e':sc.score>=60?'#eab308':'#ef4444' }}>{sc.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────
export default function IntegrityGraph({
  functionList, featureList, scenarioList,
  highlightNodeName, highlightFeatureName,
  highlightScenarioFeatures,
  onNodeSelect, onFeatureSelect, onScenarioSelect,
  onNavigate,
  // 엣지 flow 마커: active edge source/target (ref sync으로 리렌더 방지)
  animSourceFnId,
  animTargetFnId,
}) {
  const canvasAreaRef = useRef(null)
  const graphRef      = useRef(null)
  const [canvasWidth, setCanvasWidth] = useState(960)
  const [graphReady,  setGraphReady]  = useState(false)

  // ── Selection state ────────────────────────────────────────────
  const [selectedNodeId,     setSelectedNodeId]     = useState(null)
  const [selectedFeatureId,  setSelectedFeatureId]  = useState(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState(null)
  const [hoveredNode,        setHoveredNode]        = useState(null)
  const [hoveredVisible,     setHoveredVisible]     = useState(false)
  const [mousePos,           setMousePos]           = useState({ x:0, y:0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [filter,     setFilter]     = useState('all')

  // ── Refs for callback isolation (변경 시 리렌더 없이 최신값 읽기) ──
  const animSrcRef    = useRef(null)
  const animTgtRef    = useRef(null)
  const activeSetRef  = useRef(null)
  const selNodeRef    = useRef(null)
  const hasSelRef     = useRef(false)

  // props → ref sync (렌더 때마다 동기화, 콜백 deps 불필요)
  animSrcRef.current   = animSourceFnId
  animTgtRef.current   = animTargetFnId

  // ── activeSet: 현재 선택과 관련된 함수 ID Set ─────────────────
  const graphData = useMemo(() => buildGraphData(functionList, featureList), [functionList, featureList])

  const adjacency = useMemo(() => {
    const map = {}
    graphData.rawLinks.forEach(({ source, target }) => {
      if (!map[source]) map[source] = new Set()
      if (!map[target]) map[target] = new Set()
      map[source].add(target); map[target].add(source)
    })
    return map
  }, [graphData.rawLinks])

  const knownSet = useMemo(() => new Set(functionList.map(f => f.name)), [functionList])

  const featureColorMap = useMemo(() => {
    const m = {}
    featureList.forEach((f, i) => { m[f.name] = CLUSTER_COLORS[i % CLUSTER_COLORS.length] })
    return m
  }, [featureList])

  // activeSet 계산: 선택 타입에 따라 활성화할 노드 ID 집합
  const activeSet = useMemo(() => {
    if (selectedNodeId) {
      // function 선택: 선택 노드 + 직접 연결 노드
      const s = new Set([selectedNodeId])
      ;(adjacency[selectedNodeId] || new Set()).forEach(id => s.add(id))
      return s
    }
    if (selectedFeatureId) {
      const feat = featureList.find(f => f.name === selectedFeatureId)
      if (!feat) return null
      return new Set(extractFuncNamesOrdered(feat.flow, knownSet))
    }
    if (selectedScenarioId) {
      const sc = scenarioList?.find(s => s.id === selectedScenarioId)
      if (!sc) return null
      const all = new Set()
      sc.featureFlow.forEach(featName => {
        const feat = featureList.find(f => f.name === featName)
        if (feat) extractFuncNamesOrdered(feat.flow, knownSet).forEach(id => all.add(id))
      })
      return all
    }
    return null  // 선택 없음 → 전체 컬러
  }, [selectedNodeId, selectedFeatureId, selectedScenarioId, adjacency, featureList, knownSet, scenarioList])

  const hasSelection = activeSet !== null

  // ref 동기화 (콜백 deps 없이 최신값 접근)
  activeSetRef.current = activeSet
  selNodeRef.current   = selectedNodeId
  hasSelRef.current    = hasSelection

  // ── 안정 콜백 (deps = [] — 절대 재생성 안 함) ────────────────
  // ForceGraph3D는 매 프레임 이 함수들을 호출하므로 ref로 최신값을 읽음
  const getNodeId = useCallback(v => (typeof v === 'object' ? v.id : v), [])

  const getNodeColor = useCallback(node => {
    const as = activeSetRef.current
    if (!as) return SCORE_COLOR(node.score)
    if (as.has(node.id)) return SCORE_COLOR(node.score)
    return toRgba(DIM_COLOR, DIM_ALPHA)
  }, [])

  const getNodeVal = useCallback(node => {
    const base = Math.max(8, Math.min(28, 8 + node.calls * 0.7 + node.degree * 0.9))
    const as  = activeSetRef.current
    const sel = selNodeRef.current
    if (!as) return base
    if (node.id === sel) return base * 2.0
    if (as.has(node.id)) return base * 1.3
    return base * 0.4
  }, [])

  const getLinkColor = useCallback(link => {
    const s = getNodeId(link.source), t = getNodeId(link.target)
    // flow 마커 (ref로 최신값 읽음 — deps 불필요)
    if (animSrcRef.current && s === animSrcRef.current && t === animTgtRef.current)
      return 'rgba(99,220,255,0.95)'
    const as  = activeSetRef.current
    const sel = selNodeRef.current
    const hs  = hasSelRef.current
    if (!hs) return 'rgba(96,165,250,0.22)'
    if (as.has(s) && as.has(t)) {
      if (sel && (s === sel || t === sel)) return 'rgba(147,197,253,0.90)'
      return 'rgba(147,197,253,0.55)'
    }
    return 'rgba(55,65,81,0.08)'
  }, [getNodeId])

  const getLinkWidth = useCallback(link => {
    const s = getNodeId(link.source), t = getNodeId(link.target)
    if (animSrcRef.current && s === animSrcRef.current && t === animTgtRef.current) return 3.5
    const as  = activeSetRef.current
    const sel = selNodeRef.current
    const hs  = hasSelRef.current
    if (!hs) return 0.8
    if (as.has(s) && as.has(t)) {
      if (sel && (s === sel || t === sel)) return 3.0
      return 1.5
    }
    return 0.0
  }, [getNodeId])

  const getLinkParticles = useCallback(link => {
    const s = getNodeId(link.source), t = getNodeId(link.target)
    if (animSrcRef.current && s === animSrcRef.current && t === animTgtRef.current) return 14
    const as  = activeSetRef.current
    const sel = selNodeRef.current
    const hs  = hasSelRef.current
    if (!hs) return 2
    if (as.has(s) && as.has(t)) {
      if (sel && (s === sel || t === sel)) return 8
      return 4
    }
    return 0
  }, [getNodeId])

  const getLinkParticleSpeed = useCallback(link => {
    const s = getNodeId(link.source), t = getNodeId(link.target)
    if (animSrcRef.current && s === animSrcRef.current && t === animTgtRef.current) return 0.014
    return 0.005
  }, [getNodeId])

  const getLinkParticleColor = useCallback(link => {
    const s = getNodeId(link.source), t = getNodeId(link.target)
    if (animSrcRef.current && s === animSrcRef.current && t === animTgtRef.current) return '#63dcff'
    return '#93c5fd'
  }, [getNodeId])

  const getLinkArrowColor = useCallback(link => {
    const s = getNodeId(link.source), t = getNodeId(link.target)
    if (animSrcRef.current && s === animSrcRef.current && t === animTgtRef.current)
      return 'rgba(99,220,255,1.0)'
    const as = activeSetRef.current
    const hs = hasSelRef.current
    if (!hs) return 'rgba(96,165,250,0.35)'
    if (as.has(s) && as.has(t)) return 'rgba(147,197,253,0.8)'
    return 'rgba(0,0,0,0)'
  }, [getNodeId])

  // ── Canvas width ──────────────────────────────────────────────
  useEffect(() => {
    const el = canvasAreaRef.current; if (!el) return
    const ro = new ResizeObserver(e => setCanvasWidth(e[0].contentRect.width || 960))
    ro.observe(el); setCanvasWidth(el.offsetWidth || 960)
    return () => ro.disconnect()
  }, [])

  // ── External highlight from parent ────────────────────────────
  useEffect(() => { if (highlightNodeName) handleSelectNode(highlightNodeName) }, [highlightNodeName])     // eslint-disable-line
  useEffect(() => { if (highlightFeatureName) handleSelectFeature(highlightFeatureName) }, [highlightFeatureName]) // eslint-disable-line
  useEffect(() => {
    if (!highlightScenarioFeatures?.length) return
    // scenario features → fake scenario selection
    setSelectedScenarioId('__hl__')
    setSelectedNodeId(null); setSelectedFeatureId(null)
  }, [highlightScenarioFeatures])

  // ── Engine stop ───────────────────────────────────────────────
  const handleEngineStop = useCallback(() => {
    if (!graphRef.current) return
    const scene = graphRef.current.scene()
    if (scene && !scene.__lit) {
      scene.__lit = true
      scene.add(Object.assign(new THREE.AmbientLight(0x182438, 5)))
      const p1 = new THREE.PointLight(0x3355cc, 12, 800); p1.position.set(0, 180, 0); scene.add(p1)
      const p2 = new THREE.PointLight(0x6611cc, 6, 500); p2.position.set(-220, -100, 140); scene.add(p2)
      const p3 = new THREE.PointLight(0x0088cc, 5, 400); p3.position.set(180, 60, -130); scene.add(p3)
    }
    // 노드 위치 고정
    graphData.nodes.forEach(node => {
      if (node.x != null) { node.fx = node.x; node.fy = node.y; node.fz = node.z }
    })
    setGraphReady(true)
    // 렌더 루프 유지 — 링 회전 애니메이션
    graphRef.current.resumeAnimation?.()
  }, [graphData.nodes])

  // ── Cluster force ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (!graphRef.current) return
      clearInterval(timer)
      const groups = [...new Set(graphData.nodes.map(n => n.featureGroup))]
      const N = groups.length, R = 95, centers = {}
      groups.forEach((g, i) => {
        const phi = Math.acos(1 - (2*(i+0.5))/N)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i
        centers[g] = { x: R*Math.sin(phi)*Math.cos(theta), y: R*Math.cos(phi)*0.5, z: R*Math.sin(phi)*Math.sin(theta) }
      })
      graphRef.current.d3Force('cluster', alpha => {
        graphData.nodes.forEach(node => {
          const c = centers[node.featureGroup]; if (!c) return
          const s = 0.12 * alpha
          node.vx = (node.vx||0) + (c.x-(node.x||0))*s
          node.vy = (node.vy||0) + (c.y-(node.y||0))*s*0.4
          node.vz = (node.vz||0) + (c.z-(node.z||0))*s
        })
      })
    }, 80)
    return () => clearInterval(timer)
  }, [graphData.nodes])

  // ── flyTo ─────────────────────────────────────────────────────
  const flyTo = useCallback((tx, ty, tz, lookAt, ms = 1100) => {
    graphRef.current?.cameraPosition({ x:tx, y:ty, z:tz }, lookAt, ms)
  }, [])

  const scrollToGraph = useCallback(() => {
    setTimeout(() => {
      const container = canvasAreaRef.current?.closest('.integrity-page')
      if (container) container.scrollTo({ top: 0, behavior: 'smooth' })
    }, 60)
  }, [])

  // ── Select handlers ───────────────────────────────────────────
  const handleSelectNode = useCallback(name => {
    const next = name === selectedNodeId ? null : name
    setSelectedNodeId(next)
    setSelectedFeatureId(null)
    setSelectedScenarioId(null)
    if (next && graphRef.current) {
      const node = graphData.nodes.find(n => n.id === next)
      const nx = node?.fx ?? node?.x ?? 0
      const ny = node?.fy ?? node?.y ?? 0
      const nz = node?.fz ?? node?.z ?? 0
      flyTo(nx/2 + 160, ny/2 + 80, nz/2 + 160, { x:0, y:0, z:0 }, 1000)
      scrollToGraph()
    }
    onNodeSelect?.(next)
  }, [selectedNodeId, graphData.nodes, flyTo, onNodeSelect, scrollToGraph])

  const handleSelectFeature = useCallback(name => {
    const next = name === selectedFeatureId ? null : name
    setSelectedFeatureId(next)
    setSelectedNodeId(null)
    setSelectedScenarioId(null)
    if (next) {
      flyTo(0, 120, 280, { x:0, y:0, z:0 }, 1200)
      scrollToGraph()
    }
    onFeatureSelect?.(next)
  }, [selectedFeatureId, flyTo, onFeatureSelect, scrollToGraph])

  const handleSelectScenario = useCallback(id => {
    const next = id === selectedScenarioId ? null : id
    setSelectedScenarioId(next)
    setSelectedNodeId(null)
    setSelectedFeatureId(null)
    if (next) {
      flyTo(0, 120, 280, { x:0, y:0, z:0 }, 1200)
      scrollToGraph()
    }
    onScenarioSelect?.(next)
  }, [selectedScenarioId, flyTo, onScenarioSelect, scrollToGraph])

  const handleClearSelection = useCallback(() => {
    setSelectedNodeId(null); setSelectedFeatureId(null); setSelectedScenarioId(null)
    onNodeSelect?.(null); onFeatureSelect?.(null)
  }, [onNodeSelect, onFeatureSelect])

  // ── Hover ─────────────────────────────────────────────────────
  const handleNodeHover = useCallback(node => {
    setHoveredNode(node || null)
    setHoveredVisible(!!node)
  }, [])

  // ── Filtered list for side panel ──────────────────────────────
  const filteredFns = useMemo(() => {
    let list = functionList
    if (filter === 'critical') list = list.filter(f => f.score < 60)
    else if (filter === 'refactor') list = list.filter(f => f.refactor)
    const q = searchTerm.toLowerCase()
    if (q) list = list.filter(f => f.name.toLowerCase().includes(q))
    return list
  }, [functionList, filter, searchTerm])

  // ── 고해상도 라벨 텍스처 생성 ────────────────────────────────
  const makeLabelTexture = useCallback((node, isSel, isActive) => {
    const PR   = 3          // pixel ratio (3배 = 고해상도)
    const W    = 520, H = 80
    const c    = document.createElement('canvas')
    c.width    = W * PR; c.height = H * PR
    const ctx  = c.getContext('2d')
    ctx.scale(PR, PR)

    const scoreCol = SCORE_COLOR(node.score)

    // 배경 — 반투명 다크 패널
    ctx.fillStyle = 'rgba(3,7,20,0.88)'
    ctx.beginPath(); ctx.roundRect(0, 6, W, H - 8, 12); ctx.fill()

    // 좌측 accent bar (무결성 점수 색)
    const grad = ctx.createLinearGradient(0, 6, 0, H - 2)
    grad.addColorStop(0, scoreCol)
    grad.addColorStop(1, scoreCol + '88')
    ctx.fillStyle = grad
    ctx.fillRect(0, 6, 4, H - 8)

    // feature color dot
    ctx.fillStyle = node.featureColor
    ctx.shadowColor = node.featureColor; ctx.shadowBlur = 8
    ctx.beginPath(); ctx.arc(20, H/2 + 2, 5, 0, Math.PI*2); ctx.fill()
    ctx.shadowBlur = 0

    // 함수명 (메인 텍스트)
    ctx.font = `bold ${isSel ? 22 : 19}px "SF Mono", "Fira Code", monospace`
    ctx.fillStyle = isSel ? '#f1f5f9' : '#cbd5e1'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = scoreCol; ctx.shadowBlur = isSel ? 12 : 0
    ctx.fillText(node.name, 34, H/2 + 1)
    ctx.shadowBlur = 0

    // 점수 뱃지 (우측)
    const scoreText = `${node.score}`
    ctx.font = 'bold 16px monospace'
    ctx.fillStyle = scoreCol
    ctx.textAlign = 'right'
    ctx.shadowColor = scoreCol; ctx.shadowBlur = 6
    ctx.fillText(scoreText, W - 12, H/2 + 2)
    ctx.shadowBlur = 0

    const tex = new THREE.CanvasTexture(c)
    tex.anisotropy = 16   // 고품질 필터링
    return tex
  }, [])

  // ── 완전 커스텀 노드 오브젝트 ────────────────────────────────
  const nodeThreeObject = useCallback(node => {
    // refs로 읽어 deps 제거 — nodeThreeObject가 재생성되지 않음
    const as       = activeSetRef.current
    const isActive = as ? as.has(node.id) : false
    const isSel    = node.id === selNodeRef.current
    const isDim    = hasSelRef.current && !isActive

    const r        = Math.max(3.5, Math.min(12, 3.5 + node.calls * 0.28 + node.degree * 0.38))
    const scoreCol = SCORE_COLOR(node.score)
    const sc       = new THREE.Color(scoreCol)
    const cc       = new THREE.Color(node.featureColor)
    const group    = new THREE.Group()

    // ─ Core sphere (고폴리곤 구형) ─────────────────────────
    const coreMat = new THREE.MeshPhongMaterial({
      color:            isDim ? new THREE.Color('#1e2533') : sc,
      emissive:         isDim ? new THREE.Color('#0a0f1a') : sc,
      emissiveIntensity: isDim ? 0.05 : (isSel ? 0.9 : isActive ? 0.6 : 0.45),
      shininess:        120,
      transparent:      isDim,
      opacity:          isDim ? 0.22 : 0.97,
    })
    const core = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 48), coreMat)
    group.add(core)

    if (!isDim) {
      // ─ 내부 glow shell (cluster color) ─────────────────
      const innerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.5, 20, 20),
        new THREE.MeshBasicMaterial({
          color: cc, transparent: true,
          opacity: isSel ? 0.18 : isActive ? 0.10 : 0.06,
          side: THREE.BackSide,
        })
      )
      group.add(innerGlow)

      // ─ 외부 score glow ──────────────────────────────────
      const outerGlow = new THREE.Mesh(
        new THREE.SphereGeometry(r * 2.6, 16, 16),
        new THREE.MeshBasicMaterial({
          color: sc, transparent: true,
          opacity: isSel ? 0.12 : isActive ? 0.06 : 0.025,
          side: THREE.BackSide,
        })
      )
      group.add(outerGlow)

      // ─ 홀로그램 링 1 (수평, score color) ─────────────────
      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(r * 1.65, 0.35, 8, 64),
        new THREE.MeshBasicMaterial({
          color: sc, transparent: true,
          opacity: isSel ? 0.80 : isActive ? 0.45 : 0.22,
        })
      )
      ring1.rotation.x = Math.PI / 2
      group.add(ring1)

      // ─ 홀로그램 링 2 (기울어진, cluster color) ────────────
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(r * 2.1, 0.22, 8, 64),
        new THREE.MeshBasicMaterial({
          color: cc, transparent: true,
          opacity: isSel ? 0.55 : isActive ? 0.28 : 0.10,
        })
      )
      ring2.rotation.z = Math.PI / 5
      ring2.rotation.x = Math.PI / 6
      group.add(ring2)

      // ─ 선택 노드 전용: 스캔 링 ──────────────────────────
      if (isSel) {
        const scanRing = new THREE.Mesh(
          new THREE.TorusGeometry(r * 3.2, 0.18, 8, 72),
          new THREE.MeshBasicMaterial({ color: sc, transparent: true, opacity: 0.40 })
        )
        scanRing.rotation.x = Math.PI / 2
        group.add(scanRing)

        const scanRing2 = new THREE.Mesh(
          new THREE.TorusGeometry(r * 3.8, 0.12, 8, 72),
          new THREE.MeshBasicMaterial({ color: cc, transparent: true, opacity: 0.25 })
        )
        scanRing2.rotation.z = -Math.PI / 4
        group.add(scanRing2)
      }
    }

    // ─ 고해상도 라벨 (선택 or 활성 노드만) ──────────────────
    if (!isDim) {
      const tex    = makeLabelTexture(node, isSel, isActive)
      const lw     = (isSel ? 44 : 36), lh = lw * (80/520)
      const label  = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: isSel ? 1.0 : 0.82, depthTest: false })
      )
      label.scale.set(lw, lh, 1)
      label.position.set(r + lw * 0.5 + 1.5, r * 0.25, 0)
      group.add(label)
    }

    return group
  }, [makeLabelTexture])  // deps 최소화 — selection은 refs로 읽음

  // nodeThreeObjectExtend=false → 기본 구체 완전 교체
  const nodeThreeObjectExtend = false

  // ── 링 회전 애니메이션 (onRenderFramePre) ─────────────────────
  const pulseRef = useRef(0)
  const handleRenderFrame = useCallback(() => {
    if (!graphRef.current) return
    pulseRef.current += 0.018   // 천천히 증가

    const scene = graphRef.current.scene?.()
    if (!scene) return

    scene.traverse(obj => {
      if (!obj.isMesh || !obj.geometry?.type?.startsWith('Torus')) return
      const parent = obj.parent   // THREE.Group (노드)
      if (!parent) return

      // 상위 그룹의 자식 중 SphereGeometry가 있으면 회전 적용
      const r1Idx = parent.children.findIndex(c => c.geometry?.type === 'TorusGeometry')
      const idx   = parent.children.indexOf(obj)
      const speed = 0.004 + idx * 0.003   // 링마다 다른 속도

      // ring1: y축 회전, ring2: z축 회전 (홀로그램 느낌)
      if (idx % 2 === 0) obj.rotation.y += speed
      else               obj.rotation.z += speed * 0.7
    })
  }, [])

  return (
    <div className="graph-workspace" onMouseMove={e => setMousePos({ x:e.clientX, y:e.clientY })}>
      <div
        ref={canvasAreaRef}
        className="graph-canvas-area"
        onMouseLeave={() => { setHoveredNode(null); setHoveredVisible(false) }}
      >
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          width={canvasWidth}
          height={450}
          backgroundColor="#050b18"
          // Physics
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.60}
          cooldownTicks={0}
          // Node
          nodeColor={getNodeColor}
          nodeVal={getNodeVal}
          nodeOpacity={0.9}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={nodeThreeObjectExtend}
          nodeLabel={null}
          // Link
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          linkDirectionalParticles={getLinkParticles}
          linkDirectionalParticleSpeed={getLinkParticleSpeed}
          linkDirectionalParticleColor={getLinkParticleColor}
          linkDirectionalParticleWidth={1.8}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={0.85}
          linkDirectionalArrowColor={getLinkArrowColor}
          // Callbacks
          onEngineStop={handleEngineStop}
          onRenderFramePre={handleRenderFrame}
          onNodeClick={node => handleSelectNode(node.id)}
          onNodeDoubleClick={node => {
            const nx = node.fx??node.x??0, ny = node.fy??node.y??0, nz = node.fz??node.z??0
            flyTo(nx+32, ny+16, nz+32, { x:nx, y:ny, z:nz }, 600)
          }}
          onNodeHover={handleNodeHover}
          enableNodeDrag={false}
        />

        <FocusBar
          selectedNodeId={selectedNodeId}
          selectedFeatureId={selectedFeatureId}
          nodeData={graphData.nodes}
          featureList={featureList}
          featureColorMap={featureColorMap}
          onClear={handleClearSelection}
        />

        <Legend />
        <Tooltip node={hoveredNode} pos={mousePos} visible={hoveredVisible} />

        {!graphReady && (
          <div className="graph-loading">
            <div className="graph-loading-pulse" />
            <span>신경망 구조 분석 중...</span>
          </div>
        )}
        {graphReady && !hasSelection && (
          <div className="graph-hint">
            드래그: 회전 · 스크롤: 줌 · 우측 리스트에서 함수/기능/시나리오 선택
          </div>
        )}
      </div>

      <SidePanel
        functionList={filteredFns}
        fullFunctionList={functionList}
        featureList={featureList}
        scenarioList={scenarioList}
        selectedNodeId={selectedNodeId}
        selectedFeatureId={selectedFeatureId}
        selectedScenarioId={selectedScenarioId}
        onSelectNode={handleSelectNode}
        onSelectFeature={handleSelectFeature}
        onSelectScenario={handleSelectScenario}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filter={filter}
        setFilter={setFilter}
      />
    </div>
  )
}
