import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'

// ─── 상수 ────────────────────────────────────────────────────────
const SCORE_COLOR = s => s>=90?'#22c55e':s>=70?'#3b82f6':s>=50?'#eab308':s>=30?'#f97316':'#ef4444'
const GRAY = '#2a3040'          // dim 상태 노드 색상
const GRAY_THREE = new THREE.Color(GRAY)

const CLUSTER_COLORS = [
  '#818cf8','#34d399','#f472b6','#fb923c',
  '#38bdf8','#a78bfa','#4ade80','#fb7185',
  '#e879f9','#facc15','#2dd4bf','#60a5fa',
  '#f87171','#c084fc',
]

// lerp util
const lerp = (a, b, t) => a + (b - a) * t

// ─── 유틸 ────────────────────────────────────────────────────────
const extractFuncNames = (flowArr, knownSet) => {
  const found = new Set()
  flowArr.forEach(step => knownSet.forEach(n => { if (step.includes(n)) found.add(n) }))
  return [...found]
}

// Feature flow 순서대로 함수 추출 (순서 보존)
const extractFuncNamesOrdered = (flowArr, knownSet) => {
  const result = [], seen = new Set()
  flowArr.forEach(step => {
    knownSet.forEach(n => {
      if (step.includes(n) && !seen.has(n)) { seen.add(n); result.push(n) }
    })
  })
  return result
}

// ─── 텍스처 팩토리 (캐시) ────────────────────────────────────────
const texCache = {}
function makeLabelTex(name, scoreColor, featColor) {
  const key = `${name}|${scoreColor}|${featColor}`
  if (texCache[key]) return texCache[key]
  const c = document.createElement('canvas')
  c.width = 400; c.height = 64
  const ctx = c.getContext('2d')
  // dark bg
  ctx.fillStyle = 'rgba(3,7,18,0.93)'
  ctx.beginPath(); ctx.roundRect(0, 4, 400, 56, 9); ctx.fill()
  // score accent left bar
  ctx.fillStyle = scoreColor; ctx.fillRect(0, 4, 4, 56)
  // feature dot
  ctx.fillStyle = featColor
  ctx.beginPath(); ctx.arc(18, 32, 5, 0, Math.PI*2); ctx.fill()
  // name text
  ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#e2e8f0'
  ctx.textAlign = 'left'; ctx.fillText(name, 30, 42)
  const t = new THREE.CanvasTexture(c)
  texCache[key] = t
  return t
}

function makeFeatureTitleTex(name, color) {
  const c = document.createElement('canvas')
  const tw = Math.max(480, name.length * 20 + 80)
  c.width = tw; c.height = 88
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'rgba(3,7,18,0.96)'
  ctx.beginPath(); ctx.roundRect(2, 4, tw-4, 80, 14); ctx.fill()
  ctx.strokeStyle = color; ctx.lineWidth = 1.8
  ctx.beginPath(); ctx.roundRect(2, 4, tw-4, 80, 14); ctx.stroke()
  // glow line at top
  ctx.fillStyle = color; ctx.fillRect(2, 4, tw-4, 3)
  ctx.font = 'bold 28px monospace'; ctx.fillStyle = '#f1f5f9'
  ctx.textAlign = 'center'; ctx.fillText(name, tw/2, 55)
  return new THREE.CanvasTexture(c)
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
function Tooltip({ node, pos }) {
  if (!node) return null
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

// ─── Focus Bar (현재 선택 표시) ───────────────────────────────────
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
      {/* Tab switcher */}
      <div className="gsp-tabs">
        {[{id:'fn',label:'FN',count:fullFunctionList.length},{id:'feat',label:'FEAT',count:featureList.length},{id:'sc',label:'SC',count:scenarioList?.length||0}].map(t => (
          <button key={t.id} className={['gsp-tab-btn', sideTab===t.id?'active':''].join(' ')} onClick={() => setSideTab(t.id)}>
            {t.label} <span className="gsp-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search + filter — only for fn */}
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

      {/* Function list */}
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

      {/* Feature list */}
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

      {/* Scenario list */}
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
  // cross-navigation callbacks from parent
  onNavigate,   // ({ type, id }) => void
}) {
  const canvasAreaRef = useRef(null)
  const graphRef      = useRef(null)
  const [canvasWidth, setCanvasWidth] = useState(960)
  const [graphReady,  setGraphReady]  = useState(false)

  const [selectedNodeId,     setSelectedNodeId]     = useState(null)
  const [selectedFeatureId,  setSelectedFeatureId]  = useState(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState(null)
  const [hoveredNode,        setHoveredNode]        = useState(null)
  const [mousePos,           setMousePos]           = useState({ x:0, y:0 })

  const [searchTerm, setSearchTerm] = useState('')
  const [filter,     setFilter]     = useState('all')

  // ── Mutable refs for render loop ──────────────────────────────
  const selNodeRef    = useRef(null)
  const selFeatRef    = useRef(null)
  const hovNodeRef    = useRef(null)
  const connectedRef  = useRef(null)        // Set<id> currently highlighted
  const pathOrderRef  = useRef([])          // ordered func names for feature path
  const scenarioRef   = useRef(null)        // Set<id> for scenario highlight (all feature members)
  const nodeObjsRef   = useRef({})          // id → { group, core, glow1, glow2, ring1, ring2, label }
  const pulseRef      = useRef(0)
  const featTitleRef  = useRef(null)        // THREE.Sprite feature title in scene

  useEffect(() => { selNodeRef.current = selectedNodeId }, [selectedNodeId])
  useEffect(() => { selFeatRef.current = selectedFeatureId }, [selectedFeatureId])
  useEffect(() => { hovNodeRef.current = hoveredNode?.id ?? null }, [hoveredNode])

  // ── Stable data ───────────────────────────────────────────────
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

  // ── Rebuild connected set + path order ────────────────────────
  useEffect(() => {
    if (selectedNodeId) {
      const s = new Set([selectedNodeId])
      ;(adjacency[selectedNodeId] || new Set()).forEach(id => s.add(id))
      connectedRef.current = s
      pathOrderRef.current = []
    } else if (selectedFeatureId) {
      const feat = featureList.find(f => f.name === selectedFeatureId)
      if (feat) {
        const ordered = extractFuncNamesOrdered(feat.flow, knownSet)
        pathOrderRef.current = ordered
        connectedRef.current = new Set(ordered)
      } else {
        connectedRef.current = null
        pathOrderRef.current = []
      }
    } else {
      connectedRef.current = null
      pathOrderRef.current = []
    }
  }, [selectedNodeId, selectedFeatureId, adjacency, featureList, knownSet])

  // ── Canvas width ──────────────────────────────────────────────
  useEffect(() => {
    const el = canvasAreaRef.current; if (!el) return
    const ro = new ResizeObserver(e => setCanvasWidth(e[0].contentRect.width || 960))
    ro.observe(el); setCanvasWidth(el.offsetWidth || 960)
    return () => ro.disconnect()
  }, [])

  // ── External highlight ────────────────────────────────────────
  useEffect(() => { if (highlightNodeName) handleSelectNode(highlightNodeName) }, [highlightNodeName])     // eslint-disable-line
  useEffect(() => { if (highlightFeatureName) handleSelectFeature(highlightFeatureName) }, [highlightFeatureName]) // eslint-disable-line

  // ── Scenario highlight: union of all member function IDs ──────
  useEffect(() => {
    if (!highlightScenarioFeatures?.length) {
      scenarioRef.current = null
      return
    }
    const all = new Set()
    highlightScenarioFeatures.forEach(featName => {
      const feat = featureList.find(f => f.name === featName)
      if (feat) extractFuncNamesOrdered(feat.flow, knownSet).forEach(id => all.add(id))
    })
    scenarioRef.current = all
    // Clear node/feature selection so scenario takes precedence
    setSelectedNodeId(null)
    setSelectedFeatureId(null)
    // Move camera to overview
    if (graphRef.current && graphReady) {
      graphRef.current.cameraPosition({ x:0, y:130, z:300 }, { x:0, y:0, z:0 }, 1200)
    }
  }, [highlightScenarioFeatures, featureList, knownSet, graphReady]) // eslint-disable-line

  // ── flyTo ─────────────────────────────────────────────────────
  const flyTo = useCallback((tx, ty, tz, lookAt, ms = 1100) => {
    graphRef.current?.cameraPosition({ x:tx, y:ty, z:tz }, lookAt, ms)
  }, [])

  // ── Inject cluster force ONCE after graph mounts ──────────────
  // We do this in a useEffect so it runs before the first engine stop
  useEffect(() => {
    // Poll until graphRef is ready
    const timer = setInterval(() => {
      if (!graphRef.current) return
      clearInterval(timer)

      // Fibonacci sphere: spread clusters across a brain-shaped sphere
      const groups = [...new Set(graphData.nodes.map(n => n.featureGroup))]
      const N = groups.length
      const R = 95
      const centers = {}
      groups.forEach((g, i) => {
        const phi   = Math.acos(1 - (2 * (i + 0.5)) / N)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i
        centers[g] = {
          x: R * Math.sin(phi) * Math.cos(theta),
          y: R * Math.cos(phi) * 0.5,          // flatten Y → oblate sphere
          z: R * Math.sin(phi) * Math.sin(theta),
        }
      })

      graphRef.current.d3Force('cluster', alpha => {
        graphData.nodes.forEach(node => {
          const c = centers[node.featureGroup]; if (!c) return
          const s = 0.12 * alpha
          node.vx = (node.vx || 0) + (c.x - (node.x || 0)) * s
          node.vy = (node.vy || 0) + (c.y - (node.y || 0)) * s * 0.4
          node.vz = (node.vz || 0) + (c.z - (node.z || 0)) * s
        })
      })
    }, 80)
    return () => clearInterval(timer)
  }, [graphData.nodes])

  // ── handleEngineStop: add lights, freeze positions ────────────
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
    // Hard-fix ALL node positions — prevents ANY further simulation movement
    graphData.nodes.forEach(node => {
      if (node.x != null) { node.fx = node.x; node.fy = node.y; node.fz = node.z }
    })
    setGraphReady(true)
  }, [graphData.nodes])

  // ── nodeThreeObject (built once per node) ─────────────────────
  const nodeThreeObject = useCallback(node => {
    const base = Math.max(4, Math.min(14, 4 + node.calls * 0.34 + node.degree * 0.46))
    const scoreHex = SCORE_COLOR(node.score)
    const sc = new THREE.Color(scoreHex)
    const cc = new THREE.Color(node.featureColor)
    const group = new THREE.Group()

    // Core
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(base, 32, 32),
      new THREE.MeshPhongMaterial({
        color: sc, emissive: sc, emissiveIntensity: 0.65,
        shininess: 90, transparent: true, opacity: 1,
      })
    )
    group.add(core)

    // Inner glow (feature cluster)
    const glow1 = new THREE.Mesh(
      new THREE.SphereGeometry(base * 1.85, 16, 16),
      new THREE.MeshBasicMaterial({ color: cc, transparent: true, opacity: 0.08, side: THREE.BackSide })
    )
    group.add(glow1)

    // Outer score glow
    const glow2 = new THREE.Mesh(
      new THREE.SphereGeometry(base * 3.4, 14, 14),
      new THREE.MeshBasicMaterial({ color: sc, transparent: true, opacity: 0.03, side: THREE.BackSide })
    )
    group.add(glow2)

    // Pulse ring (score color, horizontal)
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(base * 3.0, 0.6, 8, 56),
      new THREE.MeshBasicMaterial({ color: sc, transparent: true, opacity: 0 })
    )
    ring1.rotation.x = Math.PI / 2; group.add(ring1)

    // Secondary ring (feature color, tilted)
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(base * 4.2, 0.35, 8, 56),
      new THREE.MeshBasicMaterial({ color: cc, transparent: true, opacity: 0 })
    )
    ring2.rotation.z = Math.PI / 5; group.add(ring2)

    // Label sprite — positioned to the RIGHT of the node
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeLabelTex(node.name, scoreHex, node.featureColor),
        transparent: true, opacity: 0, depthTest: false,
      })
    )
    const lw = base * 6.8, lh = base * 1.8
    label.scale.set(lw, lh, 1)
    // offset: right side + slight upward
    label.position.set(base + lw * 0.5 + 3, base * 0.4, 0)
    group.add(label)

    nodeObjsRef.current[node.id] = { group, core, glow1, glow2, ring1, ring2, label, base, scoreHex, featColor: node.featureColor }
    return group
  }, [])

  // ── Feature title in 3D scene ─────────────────────────────────
  const updateFeatureTitle = useCallback(featName => {
    const scene = graphRef.current?.scene()
    if (!scene) return
    if (featTitleRef.current) {
      scene.remove(featTitleRef.current)
      featTitleRef.current.material?.map?.dispose()
      featTitleRef.current.material?.dispose()
      featTitleRef.current = null
    }
    if (!featName) return
    const feat = featureList.find(f => f.name === featName)
    if (!feat) return
    const color = featureColorMap[featName] || '#60a5fa'
    const ordered = extractFuncNamesOrdered(feat.flow, knownSet)
    const fnodes = graphData.nodes.filter(n => ordered.includes(n.id) && n.x != null)
    if (!fnodes.length) return
    const cx = fnodes.reduce((s,n) => s+(n.x||0),0)/fnodes.length
    const cy = fnodes.reduce((s,n) => s+(n.y||0),0)/fnodes.length
    const cz = fnodes.reduce((s,n) => s+(n.z||0),0)/fnodes.length
    const maxR = Math.max(30, ...fnodes.map(n => {
      const dx=(n.x||0)-cx, dy=(n.y||0)-cy, dz=(n.z||0)-cz
      return Math.sqrt(dx*dx+dy*dy+dz*dz)
    }))
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeFeatureTitleTex(featName, color), transparent: true, opacity: 0.97, depthTest: false })
    )
    const sw = Math.max(70, maxR * 1.1 + 40)
    sprite.scale.set(sw, sw * 0.18, 1)
    sprite.position.set(cx, cy + maxR + 20, cz)
    scene.add(sprite)
    featTitleRef.current = sprite
  }, [featureList, featureColorMap, knownSet, graphData.nodes])

  useEffect(() => { if (graphReady) updateFeatureTitle(selectedFeatureId) }, [selectedFeatureId, graphReady, updateFeatureTitle])

  // ── onRenderFramePre: per-frame visuals ───────────────────────
  const handleRenderFrame = useCallback(() => {
    if (!graphRef.current) return
    pulseRef.current += 0.04

    const selId     = selNodeRef.current
    const selFeat   = selFeatRef.current
    const hovId     = hovNodeRef.current
    const connected  = connectedRef.current
    const scenario   = scenarioRef.current
    const pathOrder  = pathOrderRef.current
    // scenario takes precedence over individual node/feature selection
    const activeSet  = scenario || connected
    const hasSelection = !!(selId || selFeat || scenario)

    Object.entries(nodeObjsRef.current).forEach(([id, obj]) => {
      const { group, core, glow1, glow2, ring1, ring2, label, base, scoreHex, featColor } = obj
      const isSel  = id === selId
      const isHov  = id === hovId
      const isConn = activeSet ? activeSet.has(id) : false
      const isDim  = hasSelection && !isConn && !isHov

      // ── Scale ──────────────────────────────────────────────
      const ts = isSel ? 1.9 : isConn && !selId ? 1.2 : isHov ? 1.35 : isConn ? 1.22 : 1.0
      group.scale.x = lerp(group.scale.x, ts, 0.13)
      group.scale.y = group.scale.z = group.scale.x

      // ── Core color: grayscale when dim ──────────────────────
      const tColor = isDim ? GRAY_THREE : new THREE.Color(scoreHex)
      core.material.color.lerp(tColor, 0.12)
      core.material.emissive.lerp(isDim ? GRAY_THREE : new THREE.Color(scoreHex), 0.12)

      // ── Core opacity ────────────────────────────────────────
      const tOp = isDim ? 0.18 : 1.0
      core.material.opacity = lerp(core.material.opacity, tOp, 0.13)
      core.material.transparent = isDim || core.material.opacity < 0.99
      const tEm = isDim ? 0.0 : isSel ? 1.1 : isConn ? 0.78 : isHov ? 0.88 : 0.62
      core.material.emissiveIntensity = lerp(core.material.emissiveIntensity, tEm, 0.11)

      // ── Cluster glow ────────────────────────────────────────
      const tG1 = isDim ? 0.0 : isSel ? 0.55 : isConn && selFeat ? 0.32 : isHov ? 0.24 : 0.07
      glow1.material.opacity = lerp(glow1.material.opacity, tG1, 0.10)
      glow1.material.color.lerp(isDim ? GRAY_THREE : new THREE.Color(featColor), 0.12)

      // ── Score glow ──────────────────────────────────────────
      const tG2 = isDim ? 0.0 : isSel ? 0.34 : isConn ? 0.16 : isHov ? 0.10 : 0.03
      glow2.material.opacity = lerp(glow2.material.opacity, tG2, 0.10)

      // ── Pulse ring 1 ────────────────────────────────────────
      if (isSel) {
        ring1.material.opacity = 0.55 + 0.32 * Math.sin(pulseRef.current * 2.1)
        ring1.scale.x = ring1.scale.y = 1 + 0.14 * Math.sin(pulseRef.current * 1.7)
      } else if (isConn && selFeat) {
        // Feature path member: each node pulses with slight offset by path index
        const idx = pathOrder.indexOf(id)
        const offset = idx >= 0 ? idx * 0.55 : 0
        ring1.material.opacity = 0.24 + 0.18 * Math.sin(pulseRef.current * 1.5 + offset)
      } else {
        ring1.material.opacity = lerp(ring1.material.opacity, 0, 0.12)
      }

      // ── Pulse ring 2 ────────────────────────────────────────
      if (isSel) {
        ring2.material.opacity = 0.30 + 0.22 * Math.sin(pulseRef.current * 1.4 + 1.2)
        ring2.rotation.z += 0.009
      } else {
        ring2.material.opacity = lerp(ring2.material.opacity, 0, 0.12)
      }

      // ── Label visibility ────────────────────────────────────
      // Show always for: selected, feature members (selFeat), direct neighbors (selId), hovered
      const showLabel = isSel || isHov || (isConn && hasSelection)
      const tL = showLabel ? (isSel ? 1.0 : 0.88) : 0.0
      label.material.opacity = lerp(label.material.opacity, tL, 0.14)
    })
  }, [])

  // ── Link callbacks ────────────────────────────────────────────
  const getId = useCallback(v => (typeof v === 'object' ? v.id : v), [])

  const getActiveSet = useCallback(() => scenarioRef.current || connectedRef.current, [])

  const linkColor = useCallback(link => {
    const s = getId(link.source), t = getId(link.target)
    const active = getActiveSet()
    const selId = selNodeRef.current
    const hasSelection = !!(selId || selFeatRef.current || scenarioRef.current)
    if (hasSelection && active && !(active.has(s) && active.has(t))) return 'rgba(30,40,60,0.0)'
    if (scenarioRef.current) return 'rgba(168,120,255,0.65)'   // scenario = purple path
    if (selId && (s === selId || t === selId)) return 'rgba(147,197,253,0.90)'
    if (active) return 'rgba(147,197,253,0.50)'
    return 'rgba(96,165,250,0.18)'
  }, [getId, getActiveSet])

  const linkWidth = useCallback(link => {
    const s = getId(link.source), t = getId(link.target)
    const active = getActiveSet()
    const selId = selNodeRef.current
    const hasSelection = !!(selId || selFeatRef.current || scenarioRef.current)
    if (hasSelection && active && !(active.has(s) && active.has(t))) return 0.0
    if (scenarioRef.current) return 2.0
    if (selId && (s === selId || t === selId)) return 3.2
    if (active) return 1.6
    return 0.8
  }, [getId, getActiveSet])

  const linkParticles = useCallback(link => {
    const s = getId(link.source), t = getId(link.target)
    const active = getActiveSet()
    const selId = selNodeRef.current
    const hasSelection = !!(selId || selFeatRef.current || scenarioRef.current)
    if (hasSelection && active && !(active.has(s) && active.has(t))) return 0
    if (scenarioRef.current) return 5    // flowing light along scenario path
    if (selId && (s === selId || t === selId)) return 10
    if (active) return 6
    return 2
  }, [getId, getActiveSet])

  const linkParticleSpeed = useCallback(link => {
    const s = getId(link.source), t = getId(link.target)
    const selId = selNodeRef.current
    if (scenarioRef.current) return 0.007
    if (selId && (s === selId || t === selId)) return 0.008
    return 0.005
  }, [getId])

  const linkArrowColor = useCallback(link => {
    const s = getId(link.source), t = getId(link.target)
    const active = getActiveSet()
    const selId = selNodeRef.current
    const hasSelection = !!(selId || selFeatRef.current || scenarioRef.current)
    if (hasSelection && active && !(active.has(s) && active.has(t))) return 'rgba(0,0,0,0)'
    if (scenarioRef.current) return 'rgba(168,120,255,0.8)'
    if (selId && (s === selId || t === selId)) return 'rgba(147,197,253,0.9)'
    if (active) return 'rgba(147,197,253,0.6)'
    return 'rgba(96,165,250,0.35)'
  }, [getId, getActiveSet])

  // ── Select handlers ───────────────────────────────────────────
  const scrollToGraph = useCallback(() => {
    setTimeout(() => {
      const container = canvasAreaRef.current?.closest('.integrity-page')
      if (container) container.scrollTo({ top: 0, behavior: 'smooth' })
    }, 60)
  }, [])

  const handleSelectNode = useCallback(name => {
    const next = name === selNodeRef.current ? null : name
    setSelectedNodeId(next); setSelectedFeatureId(null)
    if (next) {
      const node = graphData.nodes.find(n => n.id === next)
      const nx = node?.fx ?? node?.x, ny = node?.fy ?? node?.y, nz = node?.fz ?? node?.z
      if (nx != null) flyTo(nx + 68, ny + 34, nz + 68, { x:nx, y:ny, z:nz }, 1000)
      scrollToGraph()
    }
    onNodeSelect?.(next)
  }, [graphData.nodes, flyTo, onNodeSelect, scrollToGraph])

  const handleSelectFeature = useCallback(name => {
    const next = name === selFeatRef.current ? null : name
    setSelectedFeatureId(next); setSelectedNodeId(null)
    if (next) {
      // Feature 선택: 전체 그래프가 보이는 Overview 위치로 이동
      // (개별 Feature 멤버가 여러 cluster에 흩어져 있으므로 Overview가 더 유효)
      flyTo(0, 120, 280, { x:0, y:0, z:0 }, 1200)
      scrollToGraph()
    }
    onFeatureSelect?.(next)
  }, [featureList, knownSet, graphData.nodes, flyTo, onFeatureSelect, scrollToGraph])

  const handleClearSelection = useCallback(() => {
    setSelectedNodeId(null); setSelectedFeatureId(null)
    onNodeSelect?.(null); onFeatureSelect?.(null)
  }, [onNodeSelect, onFeatureSelect])

  // Filtered list for side panel
  const filteredFns = useMemo(() => {
    let list = functionList
    if (filter === 'critical') list = list.filter(f => f.score < 60)
    else if (filter === 'refactor') list = list.filter(f => f.refactor)
    const q = searchTerm.toLowerCase()
    if (q) list = list.filter(f => f.name.toLowerCase().includes(q))
    return list
  }, [functionList, filter, searchTerm])

  return (
    <div className="graph-workspace" onMouseMove={e => setMousePos({ x:e.clientX, y:e.clientY })}>

      {/* ── Canvas ─────────────────────────────────── */}
      <div ref={canvasAreaRef} className="graph-canvas-area">
        <ForceGraph3D
          ref={graphRef}
          graphData={graphData}
          width={canvasWidth}
          height={450}
          backgroundColor="#050b18"
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.60}
          cooldownTicks={180}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          nodeLabel={null}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkDirectionalParticles={linkParticles}
          linkDirectionalParticleSpeed={linkParticleSpeed}
          linkDirectionalParticleColor={() => '#93c5fd'}
          linkDirectionalParticleWidth={2.0}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={0.85}
          linkDirectionalArrowColor={linkArrowColor}
          onEngineStop={handleEngineStop}
          onRenderFramePre={handleRenderFrame}
          onNodeClick={node => handleSelectNode(node.id)}
          onNodeDoubleClick={node => {
            const nx = node.fx??node.x??0, ny = node.fy??node.y??0, nz = node.fz??node.z??0
            flyTo(nx+32, ny+16, nz+32, { x:nx, y:ny, z:nz }, 600)
          }}
          onNodeHover={n => setHoveredNode(n||null)}
          enableNodeDrag={false}
        />

        {/* Focus bar — 상단 오버레이 */}
        <FocusBar
          selectedNodeId={selectedNodeId}
          selectedFeatureId={selectedFeatureId}
          nodeData={graphData.nodes}
          featureList={featureList}
          featureColorMap={featureColorMap}
          onClear={handleClearSelection}
        />

        <Legend />
        <Tooltip node={hoveredNode} pos={mousePos} />

        {!graphReady && (
          <div className="graph-loading">
            <div className="graph-loading-pulse" />
            <span>신경망 구조 분석 중...</span>
          </div>
        )}
        {graphReady && !selectedNodeId && !selectedFeatureId && (
          <div className="graph-hint">
            드래그: 회전 · 스크롤: 줌 · 우측 리스트에서 함수/기능 선택
          </div>
        )}
      </div>

      {/* ── Side Panel ─────────────────────────────── */}
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
        onSelectScenario={name => {
          setSelectedScenarioId(name)
          // scenario 선택 시 해당 feature들 하이라이트
          const sc = scenarioList?.find(s => s.id === name)
          if (sc) {
            scenarioRef.current = (() => {
              const all = new Set()
              sc.featureFlow.forEach(featName => {
                const feat = featureList.find(f => f.name === featName)
                if (feat) extractFuncNamesOrdered(feat.flow, knownSet).forEach(id => all.add(id))
              })
              return all
            })()
            setSelectedNodeId(null); setSelectedFeatureId(null)
            if (graphRef.current && graphReady) {
              graphRef.current.cameraPosition({ x:0, y:130, z:300 }, { x:0, y:0, z:0 }, 1200)
            }
          }
          onScenarioSelect?.(name)
        }}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filter={filter}
        setFilter={setFilter}
      />
    </div>
  )
}
