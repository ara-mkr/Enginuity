import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'
import { parse3MF, parse3MFFlat } from './parsers/parse3MF'
import { parseSTL } from './parsers/parseSTL'
import { parseOBJ } from './parsers/parseOBJ'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useFocusMode } from '../../context/FocusModeContext'
import { logEvent } from '../../engine/eventLog'
import { moduleStateStore } from '../../store/moduleState'
import {
  Layers, RotateCcw, AlertTriangle, Eye, EyeOff, Sparkles, Loader2,
  Copy, X, Maximize2, Minimize2
} from 'lucide-react'

// Dev-only diagnostics for the CAD load pipeline; stripped from production output.
const cadDebug = (...args: unknown[]) => { if (import.meta.env.DEV) console.debug(...args) }

// Three.js scene-graph traversal callbacks below (obj.geometry/obj.material)
// operate on heterogeneous Object3D subtypes (Mesh, Group, Line, etc.) whose
// exact shape isn't known until runtime — one localized disable instead of
// suppressing every call site individually. Parsed-model metadata is
// similarly format-dependent (STL/OBJ/3MF/PLY each expose different fields).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CadAny = any

// ── Interfaces ─────────────────────────────────────────────────────────────

interface LoadState {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  filename?: string
  message?: string
  progress?: number
  rawFile?: File
}

interface ModelStats {
  filename: string
  format: string
  vertices: string
  faces: string
  dimensions: {
    x: string
    y: string
    z: string
  }
  unit: string
  partCount: number
  thumbnail: string | null
  extraMeta: CadAny
}

interface PartItem {
  id: string
  name: string
  color: string
  visible: boolean
  mesh: THREE.Mesh
}

// Persists across navigation (survives component unmount within same page session)
let _persistedFile: File | null = null

export function CadViewer() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isFocusMode, toggleFocusMode } = useFocusMode()

  const { makeRequest, isConnected } = useAIProvider()
  const { tags: brainTags, setTags: setBrainTags } = useProjectContext()

  // React state
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' })
  const [modelStats, setModelStats] = useState<ModelStats | null>(null)
  
  // Toolbar states
  const [shadingMode, setShadingMode] = useState<'solid' | 'wireframe'>('solid')
  const [doubleSided, setDoubleSided] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  
  // Multi-part lists
  const [parts, setParts] = useState<PartItem[]>([])
  
  // Drop & Drag overlay
  const [isDragging, setIsDragging] = useState(false)
  const [unsupportedError, setUnsupportedError] = useState<string | null>(null)

  // AI analysis panel
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Three.js instances held in refs to prevent unnecessary re-renders
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const modelGroupRef = useRef<THREE.Group | null>(null)
  const gridHelperRef = useRef<THREE.GridHelper | null>(null)
  const animIdRef = useRef<number | null>(null)

  // ── Cleanup function ───────────────────────────────────────────────────────
  // NOTE: intentionally does NOT cancel the animation frame — only the model
  // group is removed. The render loop must stay alive between file loads.
  const cleanupScene = useCallback(() => {
    if (modelGroupRef.current && sceneRef.current) {
      sceneRef.current.remove(modelGroupRef.current)
    }

    // Traverse and dispose geometries and materials
    if (modelGroupRef.current) {
      modelGroupRef.current.traverse((obj: CadAny) => {
        if (obj.geometry) {
          obj.geometry.dispose()
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
    }

    modelGroupRef.current = null
    setParts([])
  }, [])

  // Initialize WebGL Scene
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // 1. Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#080808')
    sceneRef.current = scene

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 10000)
    camera.position.set(100, 100, 150)
    cameraRef.current = camera

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    rendererRef.current = renderer

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 0.1
    controls.maxDistance = 5000
    controls.enablePan = true
    controls.panSpeed = 0.8
    controlsRef.current = controls

    // 5. Lighting Setup
    const setupLights = () => {
      // Ambient Light
      const ambient = new THREE.AmbientLight(0xffffff, 0.4)
      scene.add(ambient)

      // Directional Light 1 (key)
      const dir1 = new THREE.DirectionalLight(0xffffff, 0.8)
      dir1.position.set(100, 200, 150)
      dir1.castShadow = true
      dir1.shadow.mapSize.width = 2048
      dir1.shadow.mapSize.height = 2048
      dir1.shadow.bias = -0.001
      scene.add(dir1)

      // Directional Light 2 (fill)
      const dir2 = new THREE.DirectionalLight(0xc8e8ff, 0.3)
      dir2.position.set(-100, 60, -100)
      scene.add(dir2)

      // Directional Light 3 (rim)
      const dir3 = new THREE.DirectionalLight(0xffffff, 0.2)
      dir3.position.set(0, -100, -100)
      scene.add(dir3)
    }
    setupLights()

    // 6. Grid Helper (Default scaled grid)
    const gridHelper = new THREE.GridHelper(200, 50, 0x2a2a45, 0x1f1f35)
    gridHelper.position.y = -0.01
    scene.add(gridHelper)
    gridHelperRef.current = gridHelper

    // 7. Animation loop
    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // 8. Resize listener
    const handleResize = () => {
      if (!container || !camera || !renderer) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
      cleanupScene()
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
      if (controlsRef.current) {
        controlsRef.current.dispose()
      }
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      controlsRef.current = null
      gridHelperRef.current = null
    }
  }, [cleanupScene])


  // ── Camera Fit Function ────────────────────────────────────────────────────
  const fitCameraToObject = useCallback((object: THREE.Object3D) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    const box = new THREE.Box3().setFromObject(object)

    if (box.isEmpty() || !isFinite(box.min.x) || !isFinite(box.max.x)) {
      console.error('[CAD] fitCameraToObject: bounding box is empty or infinite', box)
      return
    }

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    if (maxDim === 0) {
      console.error('[CAD] fitCameraToObject: model has zero size')
      return
    }

    const fov = camera.fov * (Math.PI / 180)
    const cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.0

    camera.position.set(
      center.x + cameraDistance * 0.5,
      center.y + cameraDistance * 0.5,
      center.z + cameraDistance
    )
    camera.near = maxDim * 0.001
    camera.far = maxDim * 1000
    camera.updateProjectionMatrix()

    controls.target.copy(center)
    controls.minDistance = maxDim * 0.1
    controls.maxDistance = maxDim * 20
    controls.update()

    if (gridHelperRef.current) {
      gridHelperRef.current.position.y = box.min.y - 0.01
    }

    cadDebug('[CAD] camera fitted:', { center, size, maxDim, cameraDistance, near: camera.near, far: camera.far })
  }, [])

  // ── Shading Control Updates ────────────────────────────────────────────────
  useEffect(() => {
    if (!modelGroupRef.current) return
    modelGroupRef.current.traverse((child: CadAny) => {
      if (child.isMesh) {
        child.material.wireframe = shadingMode === 'wireframe'
        child.material.side = doubleSided ? THREE.DoubleSide : THREE.FrontSide
        child.material.needsUpdate = true
      }
    })
  }, [shadingMode, doubleSided])

  // Toggle grid
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid
    }
  }, [showGrid])

  // ── Load File Dispatcher ───────────────────────────────────────────────────
  const loadFile = async (file: File, fallbackParser = false) => {
    cadDebug('[CAD] loadFile called', file.name, file.size, file.type)

    if (!sceneRef.current || !cameraRef.current) {
      console.error('[CAD] Scene not ready — Three.js init has not completed yet')
      return
    }

    if (file.size > 200 * 1024 * 1024) {
      setLoadState({
        status: 'error',
        filename: file.name,
        message: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 200MB maximum buffer limit.`
      })
      return
    }

    setLoadState({ status: 'loading', filename: file.name, progress: 0, rawFile: file })
    setAiAnalysis(null)
    setUnsupportedError(null)

    // Dispose old geometries and models
    cleanupScene()

    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    try {
      let object3D: THREE.Object3D | THREE.Group
      let metadata: CadAny = {}

      const arrayBuffer = await file.arrayBuffer()
      cadDebug('[CAD] arrayBuffer read', arrayBuffer.byteLength, 'bytes')

      switch (ext) {
        case 'stl': {
          const geometry = parseSTL(arrayBuffer)
          cadDebug('[CAD] STL geometry', geometry)
          cadDebug('[CAD] position attribute', geometry?.attributes?.position)
          cadDebug('[CAD] position count', geometry?.attributes?.position?.count)
          const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color('#c8d0d8'),
            specular: new THREE.Color(0x222222),
            shininess: 30,
            side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            wireframe: shadingMode === 'wireframe'
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.castShadow = true
          mesh.receiveShadow = true
          object3D = mesh
          break
        }
        
        case '3mf': {
          if (fallbackParser) {
            const flatGroup = await parse3MFFlat(arrayBuffer)
            cadDebug('[CAD] flat 3MF fallback children:', flatGroup.children.length)
            if (flatGroup.children.length === 0) {
              throw new Error('Flat 3MF fallback found no renderable geometry in this file.')
            }
            object3D = flatGroup
          } else {
            const result = await parse3MF(arrayBuffer)
            cadDebug('[CAD] parse3MF returned group children:', result.group.children.length)
            // If primary parser returned empty group, auto-fall through to flat
            if (result.group.children.length === 0) {
              console.warn('[CAD] primary 3MF parser returned empty group, trying flat fallback')
              const flatGroup = await parse3MFFlat(arrayBuffer)
              cadDebug('[CAD] flat fallback children:', flatGroup.children.length)
              if (flatGroup.children.length === 0) {
                throw new Error('3MF parsed but contains no renderable geometry (tried primary + flat parsers).')
              }
              object3D = flatGroup
            } else {
              object3D = result.group
              metadata = result.metadata
            }
          }
          break
        }
        
        case 'obj': {
          const text = new TextDecoder().decode(arrayBuffer)
          const geometry = parseOBJ(text)
          const material = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color('#c8d0d8'),
            specular: new THREE.Color(0x222222),
            shininess: 30,
            side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            wireframe: shadingMode === 'wireframe'
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.castShadow = true
          mesh.receiveShadow = true
          object3D = mesh
          break
        }
        
        case 'ply': {
          const loader = new PLYLoader()
          const geometry = loader.parse(arrayBuffer)
          geometry.computeVertexNormals()
          geometry.computeBoundingBox()
          
          const hasColors = !!geometry.attributes.color
          const material = new THREE.MeshPhongMaterial({ 
            color: hasColors ? 0xffffff : 0xc8d0d8,
            vertexColors: hasColors,
            specular: new THREE.Color(0x222222),
            shininess: 30,
            side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            wireframe: shadingMode === 'wireframe'
          })
          const mesh = new THREE.Mesh(geometry, material)
          mesh.castShadow = true
          mesh.receiveShadow = true
          object3D = mesh
          break
        }
        
        case 'glb':
        case 'gltf': {
          const loader = new GLTFLoader()
          const blob = new Blob([arrayBuffer])
          const url = URL.createObjectURL(blob)
          const gltf = await loader.loadAsync(url)
          URL.revokeObjectURL(url)
          object3D = gltf.scene
          
          object3D.traverse((child: CadAny) => {
            if (child.isMesh) {
              child.castShadow = true
              child.receiveShadow = true
              if (!child.geometry.attributes.normal) {
                child.geometry.computeVertexNormals()
              }
            }
          })
          break
        }
        
        default:
          throw new Error(`Unsupported format: .${ext}`)
      }

      cadDebug('[CAD] parser returned object3D type:', object3D?.type, 'children:', (object3D as THREE.Group)?.children?.length)

      // Add Model group to scene
      const mainGroup = new THREE.Group()
      mainGroup.add(object3D)
      sceneRef.current.add(mainGroup)
      modelGroupRef.current = mainGroup
      cadDebug('[CAD] scene children after add:', sceneRef.current.children.length)

      // Traverse to gather stats, fit camera and setup parts list
      let vertexCount = 0
      let faceCount = 0
      const boundingBox = new THREE.Box3()
      const partsAccumulator: PartItem[] = []

      object3D.traverse((child: CadAny) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
          const geo = child.geometry
          if (geo.attributes.position) {
            vertexCount += geo.attributes.position.count
            faceCount += geo.index 
              ? geo.index.count / 3 
              : geo.attributes.position.count / 3
          }
          boundingBox.expandByObject(child)

          // Collect child mesh as a toggleable part
          partsAccumulator.push({
            id: child.uuid,
            name: child.name || `Part ${partsAccumulator.length + 1}`,
            color: '#' + (child.material.color?.getHexString() || '888888'),
            visible: true,
            mesh: child
          })
        }
      })

      const size = boundingBox.getSize(new THREE.Vector3())
      const center = boundingBox.getCenter(new THREE.Vector3())

      // Translate model so its bottom sits on Y=0 and it's centered on XZ
      mainGroup.position.set(
        -center.x,
        -boundingBox.min.y,
        -center.z
      )

      // Recompute bounding box after repositioning for camera fit
      boundingBox.setFromObject(mainGroup)

      // Center camera
      fitCameraToObject(mainGroup)

      // Auto-scale grid helper to size
      const maxDimension = Math.max(size.x, size.y, size.z)
      if (gridHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(gridHelperRef.current)
        const newGrid = new THREE.GridHelper(maxDimension * 2.5, 50, 0x2a2a45, 0x1f1f35)
        newGrid.position.y = -0.01
        sceneRef.current.add(newGrid)
        gridHelperRef.current = newGrid
      }

      // Save Model stats
      setLoadState({ status: 'loaded' })
      logEvent('FILE_LOADED', { filename: file.name, format: ext.toLowerCase(), module: 'cad-viewer' })
      setParts(partsAccumulator)
      setModelStats({
        filename: file.name,
        format: ext.toUpperCase(),
        vertices: vertexCount.toLocaleString(),
        faces: Math.round(faceCount).toLocaleString(),
        dimensions: {
          x: size.x.toFixed(1),
          y: size.y.toFixed(1),
          z: size.z.toFixed(1)
        },
        unit: metadata.unit || 'mm',
        partCount: metadata.objectCount || partsAccumulator.length || 1,
        thumbnail: metadata.thumbnail || null,
        extraMeta: metadata
      })

      _persistedFile = file

      moduleStateStore.publish('cad', {
        filename: file.name,
        stats: { vertices: vertexCount, faces: Math.round(faceCount) },
        boundingBox: { x: size.x, y: size.y, z: size.z },
        unit: metadata.unit || 'mm'
      })

      // Try appending name to context tags
      if (brainTags && !brainTags.includes(file.name)) {
        setBrainTags([...brainTags, file.name])
      }

    } catch (err) {
      console.error('CAD Loader failure:', err)
      setLoadState({
        status: 'error',
        filename: file.name,
        message: err instanceof Error ? err.message : String(err),
        rawFile: file
      })
    }
  }

  // Auto-restore persisted file when navigating back to CAD viewer.
  // Placed after loadFile's declaration (used inside) to avoid a
  // temporal-dead-zone access-before-declared reference.
  useEffect(() => {
    if (!_persistedFile) return
    // Defer until after Three.js init effect has run and set up the scene
    const id = setTimeout(() => {
      if (_persistedFile) loadFile(_persistedFile)
    }, 50)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers for Drag and Drop ──────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const accepted = ['stl', 'obj', '3mf', 'ply', 'glb', 'gltf']
    
    if (!accepted.includes(ext)) {
      setUnsupportedError(
        `.${ext} files are not supported in the CAD viewer. Supported formats: STL, OBJ, 3MF, PLY, GLB, glTF`
      )
      return
    }

    loadFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      loadFile(file)
    }
    e.target.value = '' // reset so the same file can be reloaded
  }

  // Part toggles
  const handleTogglePart = (partId: string) => {
    setParts(prev =>
      prev.map(p => {
        if (p.id === partId) {
          const nextVal = !p.visible
          p.mesh.visible = nextVal
          return { ...p, visible: nextVal }
        }
        return p
      })
    )
  }

  const handleToggleAllParts = (visible: boolean) => {
    setParts(prev =>
      prev.map(p => {
        p.mesh.visible = visible
        return { ...p, visible }
      })
    )
  }

  // ── Camera presets ─────────────────────────────────────────────────────────
  const setCameraPreset = (preset: 'top' | 'front' | 'side') => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls || !modelGroupRef.current) return

    const box = new THREE.Box3().setFromObject(modelGroupRef.current)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    const distance = maxDim * 2.0

    controls.target.copy(center)
    
    if (preset === 'top') {
      camera.position.set(center.x, center.y + distance, center.z)
    } else if (preset === 'front') {
      camera.position.set(center.x, center.y, center.z + distance)
    } else if (preset === 'side') {
      camera.position.set(center.x + distance, center.y, center.z)
    }

    controls.update()
  }

  // Re-run camera fitting
  const handleResetView = () => {
    if (modelGroupRef.current) {
      fitCameraToObject(modelGroupRef.current)
    }
  }

  // Copy debug format report
  const handleCopyDebugReport = () => {
    if (loadState.status !== 'error') return
    const file = loadState.rawFile
    const report = [
      `File: ${file?.name || 'unknown'}`,
      `Size: ${file ? (file.size / 1024).toFixed(1) + ' KB' : 'unknown'}`,
      `Extension: ${file?.name.split('.').pop() || 'unknown'}`,
      `Error: ${loadState.message}`,
      `UA: ${navigator.userAgent}`
    ].join('\n')

    navigator.clipboard.writeText(report)
    setToast('Debug report copied to clipboard')
  }

  // Trigger fallback loader
  const handleTryFallback = () => {
    if (loadState.rawFile) {
      loadFile(loadState.rawFile, true)
    }
  }

  // AI Insights
  const handleAiAnalysis = async () => {
    if (!modelStats || !isConnected) return
    setAiLoading(true)
    setAiAnalysis(null)

    const promptText = `Analyze this 3D model:
File: ${modelStats.filename}
Format: ${modelStats.format}
Vertices: ${modelStats.vertices}
Faces: ${modelStats.faces}
Dimensions: ${modelStats.dimensions.x} x ${modelStats.dimensions.y} x ${modelStats.dimensions.z} mm
Units: ${modelStats.unit}
Parts count: ${modelStats.partCount}

Provide detailed engineering feedback, manufacturing advisories (3D printing slicer parameters, printability risks, draft angles for casting/molding if applicable), structural load estimations, and optimization advice (reducing polygons or thickness). Keep the feedback structured, engineering-focused, and concise.`

    try {
      const response = await makeRequest([{ role: 'user', content: promptText }], 'You are a professional mechanical manufacturing engineer and CAD checker. Speak concisely.', { module: 'cad-viewer' })
      setAiAnalysis(response)
    } catch (e) {
      setAiAnalysis(`AI analysis failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setAiLoading(false)
    }
  }

  const fileInputClick = () => {
    fileInputRef.current?.click()
  }

  // Dev-only test: if the cube renders but files don't, the problem is in the parsers
  const loadTestCube = () => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return
    cleanupScene()
    const scene = sceneRef.current
    const geo = new THREE.BoxGeometry(10, 10, 10)
    const mat = new THREE.MeshPhongMaterial({ color: 0x00c8ff })
    const cube = new THREE.Mesh(geo, mat)
    cube.name = 'Test Cube'
    const group = new THREE.Group()
    group.add(cube)
    scene.add(group)
    modelGroupRef.current = group
    fitCameraToObject(group)

    // Update grid to match cube size
    if (gridHelperRef.current) {
      scene.remove(gridHelperRef.current)
      const newGrid = new THREE.GridHelper(50, 50, 0x2a2a45, 0x1f1f35)
      newGrid.position.y = -5.01
      scene.add(newGrid)
      gridHelperRef.current = newGrid
    }

    setLoadState({ status: 'loaded', filename: 'test-cube' })
    setParts([{ id: cube.uuid, name: 'Test Cube', color: '#7ab4c4', visible: true, mesh: cube }])
    setModelStats({
      filename: 'test-cube.stl',
      format: 'TEST',
      vertices: '8',
      faces: '12',
      dimensions: { x: '10.0', y: '10.0', z: '10.0' },
      unit: 'mm',
      partCount: 1,
      thumbnail: null,
      extraMeta: {}
    })
    cadDebug('[CAD] test cube added, scene children:', scene.children.length)
  }

  const handleCloseToast = () => setToast(null)

  const [toastStr, setToast] = useState<string | null>(null)

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#080808]" style={{ color: 'var(--text)' }}>
      
      {/* Module Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0 module-header" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-base font-bold font-mono tracking-tight" style={{ color: 'var(--text)' }}>
            CAD Viewer
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Manually parse and inspect 3D models with high-fidelity WebGL shading.
          </p>
        </div>
        <button
          onClick={toggleFocusMode}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          title={isFocusMode ? "Exit Focus Mode (Esc)" : "Focus Mode (Cmd+Shift+F)"}
        >
          {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </header>

      {/* Toolbar strip */}
      <div className="flex items-center justify-between px-6 py-2 border-b shrink-0 bg-[#0e0e0e]" style={{ borderColor: 'var(--border)' }}>
        
        {/* Left Toolbar Shading controls */}
        <div className="flex gap-1">
          <button
            onClick={() => setShadingMode('wireframe')}
            className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer"
            style={{
              borderColor: shadingMode === 'wireframe' ? 'var(--accent)' : 'var(--border)',
              color: shadingMode === 'wireframe' ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent'
            }}
          >
            Wireframe
          </button>
          <button
            onClick={() => setShadingMode('solid')}
            className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer"
            style={{
              borderColor: shadingMode === 'solid' ? 'var(--accent)' : 'var(--border)',
              color: shadingMode === 'solid' ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent'
            }}
          >
            Solid
          </button>
          <button
            onClick={() => setDoubleSided(!doubleSided)}
            className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer"
            style={{
              borderColor: doubleSided ? 'var(--accent)' : 'var(--border)',
              color: doubleSided ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent'
            }}
          >
            Double-sided
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer"
            style={{
              borderColor: showGrid ? 'var(--accent)' : 'var(--border)',
              color: showGrid ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent'
            }}
          >
            Grid
          </button>
        </div>

        {/* Right Toolbar View Presets */}
        <div className="flex gap-1">
          {modelStats && (
            <>
              <button
                onClick={handleResetView}
                className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <RotateCcw size={12} className="inline mr-1" />
                Reset view
              </button>
              <button
                onClick={() => setCameraPreset('top')}
                className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Top
              </button>
              <button
                onClick={() => setCameraPreset('front')}
                className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Front
              </button>
              <button
                onClick={() => setCameraPreset('side')}
                className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Side
              </button>
              <button
                onClick={handleAiAnalysis}
                disabled={aiLoading || !isConnected}
                className="h-[30px] px-2.5 text-xs font-sans rounded border transition-colors cursor-pointer bg-transparent flex items-center gap-1.5"
                style={{
                  borderColor: aiAnalysis ? 'var(--accent)' : 'var(--border)',
                  color: aiAnalysis ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                {aiLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                AI Analysis
              </button>
            </>
          )}
        </div>

      </div>

      {/* Dynamic Model Stats Panel Strip */}
      {modelStats && (
        <div className="bg-[#0e0e0e] border-b px-6 py-2 flex items-center justify-between gap-6 shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <span className="text-xs font-sans text-[var(--text-dim)]">
              Vertices <strong className="font-mono text-[var(--text)] ml-1">{modelStats.vertices}</strong>
            </span>
            <span className="text-xs font-sans text-[var(--text-dim)]">
              Faces <strong className="font-mono text-[var(--text)] ml-1">{modelStats.faces}</strong>
            </span>
            <span className="text-xs font-sans text-[var(--text-dim)]">
              Parts <strong className="font-mono text-[var(--text)] ml-1">{modelStats.partCount}</strong>
            </span>
            <span className="text-xs font-sans text-[var(--text-dim)]">
              W × H × D <strong className="font-mono text-[var(--text)] ml-1">{modelStats.dimensions.x} × {modelStats.dimensions.y} × {modelStats.dimensions.z} mm</strong>
            </span>
            <span className="text-xs font-sans text-[var(--text-dim)]">
              Format <strong className="font-mono text-[var(--text)] ml-1">{modelStats.format}</strong>
            </span>
            <span className="text-xs font-sans text-[var(--text-dim)]">
              Unit <strong className="font-mono text-[var(--text)] ml-1">{modelStats.unit}</strong>
            </span>
          </div>

          {modelStats.thumbnail && (
            <img src={modelStats.thumbnail} alt="Model Thumbnail" className="w-8 h-8 rounded bg-[#131313] border border-[var(--border)] shrink-0 object-contain" />
          )}
        </div>
      )}

      {/* Multi-part visibility scrollable row */}
      {modelStats && modelStats.partCount > 1 && parts.length > 0 && (
        <div className="bg-[#0e0e0e] border-b px-6 py-2 flex items-center justify-between gap-4 shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex-1 overflow-x-auto flex items-center gap-2 pr-4 scrollbar-none" style={{ maskImage: 'linear-gradient(to right, black 85%, transparent 100%)' }}>
            {parts.map(part => (
              <button
                key={part.id}
                onClick={() => handleTogglePart(part.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-sans font-normal transition-opacity duration-150 cursor-pointer shrink-0"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: part.visible ? 'var(--border-bright)' : 'var(--border)',
                  color: part.visible ? 'var(--text)' : 'var(--text-muted)',
                  opacity: part.visible ? 1 : 0.4
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: part.color }} />
                <span className="truncate max-w-[100px]">{part.name}</span>
                {part.visible ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
            ))}
          </div>

          <div className="flex gap-3 text-[10px] font-sans font-normal text-[var(--text-dim)] whitespace-nowrap shrink-0">
            <button onClick={() => handleToggleAllParts(true)} className="hover:text-[var(--text)]">Show all</button>
            <span className="text-[var(--border)]">|</span>
            <button onClick={() => handleToggleAllParts(false)} className="hover:text-[var(--text)]">Hide all</button>
          </div>
        </div>
      )}

      {/* Viewport Canvas wrapper */}
      <div
        ref={containerRef}
        className="flex-1 relative min-h-0 overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Drag and Drop Zone Overlay */}
        {loadState.status === 'idle' && (
          <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-8 bg-[#080808]/70 select-none">
            <div className="max-w-md p-8 rounded-lg border border-dashed border-[var(--border-bright)] bg-[var(--surface)]/90 backdrop-blur-sm">
              <Layers size={40} className="mx-auto mb-4 text-[var(--text-muted)]" />
              <h3 className="font-sans font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>Open CAD File</h3>
              <p className="text-xs text-[var(--text-muted)] mb-5">
                Drag and drop your 3D engineering file here, or click to browse.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={fileInputClick}
                  className="py-2 px-4 rounded text-xs font-sans font-bold bg-[#0e0e0e] hover:bg-[#131313] border border-[var(--border-bright)] cursor-pointer text-white transition-colors"
                >
                  Select File
                </button>
                {import.meta.env.DEV && (
                  <button
                    onClick={loadTestCube}
                    className="py-2 px-4 rounded text-xs font-sans font-bold bg-[#0e0e0e] hover:bg-[#131313] border border-[var(--border)] cursor-pointer text-[var(--text-muted)] transition-colors"
                    title="If this cube renders but files don't, the bug is in the parsers"
                  >
                    Test Cube
                  </button>
                )}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-dim)] mt-4">
                Supported formats: STL · OBJ · 3MF · PLY · GLB · glTF
              </div>
            </div>
          </div>
        )}

        {/* Loading progress Overlay */}
        {loadState.status === 'loading' && (
          <div className="absolute inset-0 flex flex-col justify-center items-center bg-[#080808]/80">
            <Loader2 size={32} className="animate-spin mb-3 text-[var(--accent)]" />
            <div className="text-xs font-sans text-white">Loading {loadState.filename}...</div>
          </div>
        )}

        {/* Error State Card Overlay */}
        {loadState.status === 'error' && (
          <div className="absolute inset-0 flex justify-center items-center p-8 bg-[#080808]/95">
            <div className="w-full max-w-[480px] p-6 rounded-lg border border-[var(--border-bright)] bg-[var(--surface)] text-left flex flex-col gap-4">
              <div className="flex items-center gap-2 font-sans font-medium text-sm text-[var(--text)]">
                <AlertTriangle size={18} className="text-red-400 shrink-0" />
                <span>Failed to load {loadState.filename}</span>
              </div>
              
              <div className="text-xs font-sans text-[var(--text-muted)] leading-relaxed">
                {loadState.message}
              </div>

              {loadState.filename?.toLowerCase().endsWith('.3mf') && (
                <div className="text-[10px] font-sans text-[var(--text-dim)] leading-relaxed bg-[#0e0e0e] p-3 rounded border border-[var(--border)]">
                  <span style={{ color: '#b8d4f0' }}>◈</span> This 3MF file may use extensions not yet supported. Try exporting as STL from your slicer for maximum compatibility.
                </div>
              )}

              <div className="flex gap-2 border-t pt-4 mt-2" style={{ borderColor: 'var(--border)' }}>
                {loadState.filename?.toLowerCase().endsWith('.3mf') && (
                  <button
                    onClick={handleTryFallback}
                    className="h-8 px-3 rounded text-xs font-sans font-bold bg-[#0e0e0e] hover:bg-[#131313] border border-[var(--border-bright)] cursor-pointer text-white"
                  >
                    Try anyway with fallback parser
                  </button>
                )}
                <button
                  onClick={handleCopyDebugReport}
                  className="h-8 px-3 rounded text-xs font-sans font-bold bg-[#0e0e0e] hover:bg-[#131313] border border-[var(--border-bright)] cursor-pointer text-[var(--text-muted)] hover:text-white"
                >
                  <Copy size={12} className="inline mr-1" />
                  Report format issue
                </button>
                <button
                  onClick={() => { _persistedFile = null; cleanupScene(); setLoadState({ status: 'idle' }) }}
                  className="h-8 px-3 rounded text-xs font-sans font-bold bg-transparent border border-[var(--border)] hover:bg-[#111111] cursor-pointer text-white ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drag Over Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-[var(--accent)]/5 border-2 border-dashed border-[var(--accent)] flex justify-center items-center pointer-events-none select-none">
            <span className="text-sm font-sans font-bold text-[var(--accent)]">
              Drop 3D CAD File here
            </span>
          </div>
        )}

        {/* Unsupported Format Card Overlay */}
        {unsupportedError && (
          <div className="absolute inset-0 flex justify-center items-center p-8 bg-[#080808]/95">
            <div className="w-full max-w-[480px] p-6 rounded-lg border border-[var(--border-bright)] bg-[var(--surface)] text-left flex flex-col gap-4">
              <div className="flex items-center gap-2 font-sans font-medium text-sm text-[var(--text)]">
                <AlertTriangle size={18} className="text-red-400 shrink-0" />
                <span>Unsupported File Format</span>
              </div>
              <div className="text-xs font-sans text-[var(--text-muted)] leading-relaxed">
                {unsupportedError}
              </div>
              <div className="flex gap-2 border-t pt-4 mt-2" style={{ borderColor: 'var(--border)' }}>
                <a
                  href="/?dropzone=open"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/')
                  }}
                  className="h-8 px-3 rounded text-xs font-sans font-bold bg-[#0e0e0e] hover:bg-[#131313] border border-[var(--border-bright)] flex items-center text-white"
                >
                  Try Universal Drop Zone
                </a>
                <button
                  onClick={() => setUnsupportedError(null)}
                  className="h-8 px-3 rounded text-xs font-sans font-bold bg-transparent border border-[var(--border)] hover:bg-[#111111] cursor-pointer text-white ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis Overlay panel */}
        {aiAnalysis && (
          <div className="absolute top-4 right-4 bottom-4 w-[360px] z-[50] bg-[var(--surface)]/95 border border-[var(--border-bright)] rounded-lg p-5 flex flex-col gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b pb-2 shrink-0" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <Sparkles size={13} color="var(--accent)" />
                AI CAD Analysis
              </span>
              <button
                onClick={() => setAiAnalysis(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="text-xs leading-relaxed text-[var(--text-muted)] font-mono whitespace-pre-line">
                {aiAnalysis}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Hidden File Picker Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl,.obj,.3mf,.ply,.glb,.gltf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Toast Notification */}
      {toastStr && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-md border border-[var(--border-bright)] bg-[var(--surface-2)] text-xs text-white shadow-lg font-sans font-normal"
        >
          {toastStr}
          <button onClick={handleCloseToast} className="ml-2 font-bold text-white">×</button>
        </div>
      )}

    </div>
  )
}
