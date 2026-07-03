/**
 * Universal File Engine
 * Detects format → parses with the right strategy → returns a normalised FileResult.
 */

import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import JSZip from 'jszip'
import Papa from 'papaparse'
import * as pdfjsLib from 'pdfjs-dist'
import { detectFormat } from '../config/fileFormats.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function bufferToThreeGeometry(loader, buffer) {
  return new Promise((resolve, reject) => {
    try {
      const geo = loader.parse(buffer)
      resolve(geo)
    } catch (e) {
      reject(e)
    }
  })
}

function computeGeometryStats(geo) {
  const position = geo.attributes?.position
  const vertexCount = position ? position.count : 0
  const faceCount = geo.index ? geo.index.count / 3 : vertexCount / 3

  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const size = new THREE.Vector3()
  bb.getSize(size)

  return {
    vertexCount,
    faceCount: Math.round(faceCount),
    boundingBox: {
      x: parseFloat(size.x.toFixed(2)),
      y: parseFloat(size.y.toFixed(2)),
      z: parseFloat(size.z.toFixed(2)),
    },
  }
}

function wrapGeometry(geo, color = 0x00c8ff) {
  geo.computeVertexNormals()
  const mat = new THREE.MeshPhongMaterial({ color, side: THREE.DoubleSide })
  return new THREE.Mesh(geo, mat)
}

// ─── Format-specific parsers ──────────────────────────────────────────────────

async function parseSTL(file) {
  const buffer = await readAsArrayBuffer(file)
  const loader = new STLLoader()
  const geo = await bufferToThreeGeometry(loader, buffer)
  const stats = computeGeometryStats(geo)
  const mesh = wrapGeometry(geo)
  const v = stats.vertexCount
  const f = stats.faceCount
  const bb = stats.boundingBox
  return {
    geometry: mesh,
    metadata: stats,
    viewMode: '3d',
    aiContext: `STL file '${file.name}', ${v.toLocaleString()} vertices, ${f.toLocaleString()} faces, bounding box ${bb.x}×${bb.y}×${bb.z}mm`,
  }
}

async function parseOBJ(file) {
  const text = await readAsText(file)
  const loader = new OBJLoader()
  const group = loader.parse(text)
  // Compute combined stats across all meshes
  let totalVerts = 0, totalFaces = 0
  const box = new THREE.Box3()
  group.traverse((child) => {
    if (child.isMesh) {
      const geo = child.geometry
      geo.computeBoundingBox()
      box.expandByObject(child)
      totalVerts += geo.attributes.position?.count ?? 0
      totalFaces += geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3
    }
  })
  const size = new THREE.Vector3()
  box.getSize(size)
  const bb = { x: +size.x.toFixed(2), y: +size.y.toFixed(2), z: +size.z.toFixed(2) }
  return {
    geometry: group,
    metadata: { vertexCount: totalVerts, faceCount: Math.round(totalFaces), boundingBox: bb },
    viewMode: '3d',
    aiContext: `OBJ file '${file.name}', ${totalVerts.toLocaleString()} vertices, ${Math.round(totalFaces).toLocaleString()} faces, bounding box ${bb.x}×${bb.y}×${bb.z}mm`,
  }
}

async function parseGLTF(file) {
  const buffer = await readAsArrayBuffer(file)
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.parse(buffer, '', (gltf) => {
      const scene = gltf.scene
      let totalVerts = 0, totalFaces = 0
      const box = new THREE.Box3().setFromObject(scene)
      scene.traverse((child) => {
        if (child.isMesh) {
          totalVerts += child.geometry.attributes.position?.count ?? 0
          const g = child.geometry
          totalFaces += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3
        }
      })
      const size = new THREE.Vector3()
      box.getSize(size)
      const bb = { x: +size.x.toFixed(2), y: +size.y.toFixed(2), z: +size.z.toFixed(2) }
      resolve({
        geometry: scene,
        metadata: { vertexCount: totalVerts, faceCount: Math.round(totalFaces), boundingBox: bb },
        viewMode: '3d',
        aiContext: `glTF/GLB file '${file.name}', ${totalVerts.toLocaleString()} vertices, bounding box ${bb.x}×${bb.y}×${bb.z}mm`,
      })
    }, reject)
  })
}

async function parsePLY(file) {
  const buffer = await readAsArrayBuffer(file)
  const loader = new PLYLoader()
  const geo = loader.parse(buffer)
  const stats = computeGeometryStats(geo)
  const mesh = wrapGeometry(geo)
  const bb = stats.boundingBox
  return {
    geometry: mesh,
    metadata: stats,
    viewMode: '3d',
    aiContext: `PLY file '${file.name}', ${stats.vertexCount.toLocaleString()} vertices, ${stats.faceCount.toLocaleString()} faces, bounding box ${bb.x}×${bb.y}×${bb.z}mm`,
  }
}

async function parse3MF(file) {
  const buffer = await readAsArrayBuffer(file)
  const zip = await JSZip.loadAsync(buffer)

  // Find the 3D model XML
  let modelXml = null
  for (const [path, zipFile] of Object.entries(zip.files)) {
    if (path.endsWith('.model') || path.includes('3D/')) {
      if (!zipFile.dir) {
        modelXml = await zipFile.async('text')
        break
      }
    }
  }
  if (!modelXml) throw new Error('No .model file found inside 3MF archive')

  const parser = new DOMParser()
  const doc = parser.parseFromString(modelXml, 'application/xml')

  // Extract metadata
  const metaNodes = doc.querySelectorAll('metadata')
  const meta = {}
  metaNodes.forEach((n) => { meta[n.getAttribute('name')] = n.textContent })

  // Extract unit from model element
  const modelEl = doc.querySelector('model')
  const unit = modelEl?.getAttribute('unit') ?? 'millimeter'
  const unitScale = unit === 'meter' ? 1000 : unit === 'centimeter' ? 10 : unit === 'inch' ? 25.4 : 1

  // Build geometry from all <mesh> elements
  const vertices = []
  const indices = []
  let vertOffset = 0

  doc.querySelectorAll('mesh').forEach((meshEl) => {
    const vNodes = meshEl.querySelectorAll('vertices vertex')
    const localVerts = []
    vNodes.forEach((v) => {
      localVerts.push(
        parseFloat(v.getAttribute('x')) * unitScale,
        parseFloat(v.getAttribute('y')) * unitScale,
        parseFloat(v.getAttribute('z')) * unitScale
      )
    })
    vertices.push(...localVerts)

    meshEl.querySelectorAll('triangles triangle').forEach((t) => {
      indices.push(
        parseInt(t.getAttribute('v1')) + vertOffset,
        parseInt(t.getAttribute('v2')) + vertOffset,
        parseInt(t.getAttribute('v3')) + vertOffset
      )
    })
    vertOffset += localVerts.length / 3
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setIndex(indices)
  const stats = computeGeometryStats(geo)
  const mesh = wrapGeometry(geo)
  const bb = stats.boundingBox

  return {
    geometry: mesh,
    metadata: { ...stats, threeMetadata: meta, unit },
    viewMode: '3d',
    aiContext: `3MF file '${file.name}', ${stats.vertexCount.toLocaleString()} vertices, ${stats.faceCount.toLocaleString()} faces, bounding box ${bb.x}×${bb.y}×${bb.z}mm${meta.Title ? `, title: "${meta.Title}"` : ''}`,
  }
}

async function parseAMF(file) {
  const text = await readAsText(file)
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')

  const vertices = []
  const indices = []
  let vertOffset = 0

  doc.querySelectorAll('object').forEach((obj) => {
    const vNodes = obj.querySelectorAll('vertices vertex coordinates')
    vNodes.forEach((c) => {
      vertices.push(
        parseFloat(c.querySelector('x')?.textContent ?? '0'),
        parseFloat(c.querySelector('y')?.textContent ?? '0'),
        parseFloat(c.querySelector('z')?.textContent ?? '0')
      )
    })
    obj.querySelectorAll('volume triangle').forEach((t) => {
      indices.push(
        parseInt(t.querySelector('v1')?.textContent ?? '0') + vertOffset,
        parseInt(t.querySelector('v2')?.textContent ?? '0') + vertOffset,
        parseInt(t.querySelector('v3')?.textContent ?? '0') + vertOffset
      )
    })
    vertOffset += vNodes.length
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setIndex(indices)
  const stats = computeGeometryStats(geo)
  const mesh = wrapGeometry(geo)
  const bb = stats.boundingBox

  return {
    geometry: mesh,
    metadata: stats,
    viewMode: '3d',
    aiContext: `AMF file '${file.name}', ${stats.vertexCount.toLocaleString()} vertices, ${stats.faceCount.toLocaleString()} faces, bounding box ${bb.x}×${bb.y}×${bb.z}mm`,
  }
}

async function parseOFF(file) {
  const text = await readAsText(file)
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

  let i = 0
  if (lines[i].toUpperCase().startsWith('OFF')) i++
  const [numVerts, numFaces] = lines[i++].split(/\s+/).map(Number)

  const verts = []
  for (let v = 0; v < numVerts; v++) {
    const parts = lines[i++].split(/\s+/).map(Number)
    verts.push(parts[0], parts[1], parts[2])
  }

  const idx = []
  for (let f = 0; f < numFaces; f++) {
    const parts = lines[i++].split(/\s+/).map(Number)
    const n = parts[0]
    for (let k = 1; k < n - 1; k++) idx.push(parts[1], parts[k + 1], parts[k + 2])
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(idx)
  const stats = computeGeometryStats(geo)
  const mesh = wrapGeometry(geo)

  return {
    geometry: mesh,
    metadata: stats,
    viewMode: '3d',
    aiContext: `OFF file '${file.name}', ${stats.vertexCount.toLocaleString()} vertices, ${stats.faceCount.toLocaleString()} faces`,
  }
}

async function parseXYZ(file) {
  const text = await readAsText(file)
  const positions = []
  const lines = text.trim().split('\n')
  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 3) {
      const x = parseFloat(parts[0])
      const y = parseFloat(parts[1])
      const z = parseFloat(parts[2])
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) positions.push(x, y, z)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({ color: 0x00c8ff, size: 0.5 })
  const points = new THREE.Points(geo, mat)
  const pointCount = positions.length / 3

  return {
    geometry: points,
    metadata: { pointCount },
    viewMode: 'pointcloud',
    aiContext: `XYZ point cloud '${file.name}', ${pointCount.toLocaleString()} points`,
  }
}

async function parsePCD(file) {
  const buffer = await readAsArrayBuffer(file)
  return new Promise((resolve, reject) => {
    const loader = new PCDLoader()
    try {
      const points = loader.parse(buffer)
      const count = points.geometry.attributes.position?.count ?? 0
      resolve({
        geometry: points,
        metadata: { pointCount: count },
        viewMode: 'pointcloud',
        aiContext: `PCD point cloud '${file.name}', ${count.toLocaleString()} points`,
      })
    } catch (e) { reject(e) }
  })
}

async function parseDAE(file) {
  const text = await readAsText(file)
  return new Promise((resolve, reject) => {
    const loader = new ColladaLoader()
    try {
      const collada = loader.parse(text, '')
      const scene = collada.scene
      let totalVerts = 0
      scene.traverse((child) => {
        if (child.isMesh) totalVerts += child.geometry.attributes.position?.count ?? 0
      })
      resolve({
        geometry: scene,
        metadata: { vertexCount: totalVerts },
        viewMode: '3d',
        aiContext: `COLLADA file '${file.name}', ${totalVerts.toLocaleString()} vertices`,
      })
    } catch (e) { reject(e) }
  })
}

async function parseDXF(file) {
  const text = await readAsText(file)
  let DxfParser
  try {
    const mod = await import('dxf-parser')
    DxfParser = mod.default ?? mod
  } catch {
    // Fallback: show raw text
    return {
      geometry: null,
      metadata: { raw: text.slice(0, 2000) },
      viewMode: 'text',
      aiContext: `DXF drawing '${file.name}'`,
    }
  }

  const parser = new DxfParser()
  const dxf = parser.parseSync(text)

  // Build Three.js scene from entities
  const group = new THREE.Group()
  const entities = dxf?.entities ?? []
  let lineCount = 0, circleCount = 0

  for (const entity of entities) {
    const color = entity.color != null ? entity.color : 0x00c8ff
    const mat = new THREE.LineBasicMaterial({ color })

    if (entity.type === 'LINE') {
      const pts = [
        new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, 0),
        new THREE.Vector3(entity.vertices[1].x, entity.vertices[1].y, 0),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.Line(geo, mat))
      lineCount++
    } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
      const pts = entity.vertices.map((v) => new THREE.Vector3(v.x, v.y, 0))
      if (entity.shape) pts.push(pts[0].clone())
      if (pts.length > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        group.add(new THREE.Line(geo, mat))
        lineCount++
      }
    } else if (entity.type === 'CIRCLE') {
      const curve = new THREE.EllipseCurve(
        entity.center.x, entity.center.y,
        entity.radius, entity.radius,
        0, Math.PI * 2
      )
      const pts = curve.getPoints(64)
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0)))
      group.add(new THREE.Line(geo, mat))
      circleCount++
    } else if (entity.type === 'ARC') {
      const startAngle = (entity.startAngle * Math.PI) / 180
      const endAngle = (entity.endAngle * Math.PI) / 180
      const curve = new THREE.EllipseCurve(
        entity.center.x, entity.center.y,
        entity.radius, entity.radius,
        startAngle, endAngle
      )
      const pts = curve.getPoints(32)
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0)))
      group.add(new THREE.Line(geo, mat))
      lineCount++
    }
  }

  return {
    geometry: group,
    metadata: { entityCount: entities.length, lineCount, circleCount, layers: Object.keys(dxf?.tables?.layer?.layers ?? {}) },
    viewMode: 'dxf',
    aiContext: `DXF drawing '${file.name}', ${entities.length} entities (${lineCount} lines, ${circleCount} circles)`,
  }
}

async function parseKiCadPCB(file) {
  const text = await readAsText(file)
  try {
    localStorage.setItem('enginguity_last_kicad', JSON.stringify({ name: file.name, text }))
  } catch (e) {
    console.error('Failed to cache KiCad PCB content:', e)
  }
  const group = new THREE.Group()

  // Layer colours
  const layerColor = {
    'F.Cu': 0xff4444, 'B.Cu': 0x4444ff, 'F.SilkS': 0xffff00, 'B.SilkS': 0xdddd00,
    'Edge.Cuts': 0xffd700,
  }

  let traceCount = 0, padCount = 0, componentCount = 0

  // Parse gr_line (graphic lines)
  const grLineRe = /\(gr_line\s+\(start\s+([\d.-]+)\s+([\d.-]+)\)\s+\(end\s+([\d.-]+)\s+([\d.-]+)\)(?:.*?\(layer\s+"?([^")]+)"?\))?/g
  let m
  while ((m = grLineRe.exec(text)) !== null) {
    const [, x1, y1, x2, y2, layer] = m
    const col = layerColor[layer] ?? 0x888888
    const pts = [new THREE.Vector3(+x1, -y1, 0), new THREE.Vector3(+x2, -y2, 0)]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col })))
    traceCount++
  }

  // Parse segment (copper traces)
  const segRe = /\(segment\s+\(start\s+([\d.-]+)\s+([\d.-]+)\)\s+\(end\s+([\d.-]+)\s+([\d.-]+)\)/g
  while ((m = segRe.exec(text)) !== null) {
    const [, x1, y1, x2, y2] = m
    const pts = [new THREE.Vector3(+x1, -y1, 0), new THREE.Vector3(+x2, -y2, 0)]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff4444 })))
    traceCount++
  }

  // Parse pads as small circles
  const padRe = /\(pad\s+"?[^"]*"?\s+(?:smd|thru_hole|np_thru_hole)\s+\w+\s+\(at\s+([\d.-]+)\s+([\d.-]+)/g
  while ((m = padRe.exec(text)) !== null) {
    const [, px, py] = m
    const geo = new THREE.CircleGeometry(0.3, 8)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    const circle = new THREE.Mesh(geo, mat)
    circle.position.set(+px, -py, 0)
    group.add(circle)
    padCount++
  }

  // Count footprints as components
  componentCount = (text.match(/\(footprint\s+/g) ?? []).length

  return {
    geometry: group,
    metadata: { traceCount, padCount, componentCount },
    viewMode: 'pcb',
    aiContext: `KiCad PCB '${file.name}', ${componentCount} components, ${traceCount} traces, ${padCount} pads`,
  }
}

async function parseGerber(file) {
  const text = await readAsText(file)
  const group = new THREE.Group()

  const isTop = file.name.endsWith('.gtl') || file.name.includes('top') || file.name.includes('Top')
  const color = isTop ? 0x00c8ff : 0x4444ff

  let x = 0, y = 0, drawCount = 0, flashCount = 0
  let currentAperture = { type: 'C', size: 0.1 }
  const apertures = {}

  const lines = text.split('\n')
  for (const raw of lines) {
    const line = raw.trim()

    // Aperture definition: %ADD10C,0.15*%
    const addMatch = line.match(/%ADD(\d+)([A-Z]),([^*]+)\*%/)
    if (addMatch) {
      const [, num, type, params] = addMatch
      const size = parseFloat(params.split('X')[0]) || 0.1
      apertures[num] = { type, size }
      continue
    }

    // Tool select: D10*
    const toolMatch = line.match(/^D(\d+)\*$/)
    if (toolMatch && parseInt(toolMatch[1]) >= 10) {
      currentAperture = apertures[toolMatch[1]] ?? currentAperture
      continue
    }

    // Move/draw command: X...Y...D01/D02/D03
    const coordMatch = line.match(/X(-?\d+)Y(-?\d+)D0([123])/)
    if (coordMatch) {
      const nx = parseInt(coordMatch[1]) / 1e6
      const ny = parseInt(coordMatch[2]) / 1e6
      const op = coordMatch[3]

      if (op === '1') {
        // Draw
        const pts = [new THREE.Vector3(x, y, 0), new THREE.Vector3(nx, ny, 0)]
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color, linewidth: 1 })))
        drawCount++
      } else if (op === '3') {
        // Flash pad
        const r = (currentAperture.size ?? 0.1) / 2
        const geo = new THREE.CircleGeometry(r, 8)
        const mat = new THREE.MeshBasicMaterial({ color })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(nx, ny, 0)
        group.add(mesh)
        flashCount++
      }

      x = nx; y = ny
    }
  }

  const layer = isTop ? 'Top Copper' : 'Bottom Copper'
  return {
    geometry: group,
    metadata: { drawCount, flashCount, layer },
    viewMode: 'pcb',
    aiContext: `Gerber file '${file.name}' (${layer}), ${drawCount} draw commands, ${flashCount} flash pads`,
  }
}

async function parseCSV(file) {
  const text = await readAsText(file)
  const separator = file.name.endsWith('.tsv') ? '\t' : ','
  const result = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: separator })

  const headers = result.meta.fields ?? []
  const rows = result.data
  const numericColumns = headers.filter((h) =>
    rows.slice(0, 20).every((r) => r[h] === null || r[h] === '' || typeof r[h] === 'number')
  )

  return {
    geometry: null,
    metadata: { headers, rows, numericColumns, shape: [rows.length, headers.length] },
    viewMode: 'csv',
    aiContext: `CSV dataset '${file.name}', ${rows.length} rows × ${headers.length} columns. Columns: ${headers.join(', ')}. Numeric: ${numericColumns.join(', ')}`,
  }
}

async function parseCode(file) {
  const text = await readAsText(file)
  const ext = file.name.split('.').pop().toLowerCase()
  const langMap = {
    py: 'Python', js: 'JavaScript', ts: 'TypeScript', c: 'C', cpp: 'C++',
    h: 'C/C++ Header', rs: 'Rust', ino: 'Arduino', sv: 'SystemVerilog',
    v: 'Verilog', vhd: 'VHDL',
  }
  const language = langMap[ext] ?? ext.toUpperCase()
  const lineCount = text.split('\n').length

  return {
    geometry: null,
    metadata: { content: text, language, lineCount, size: file.size },
    viewMode: 'code',
    aiContext: `${language} source file '${file.name}', ${lineCount} lines`,
  }
}

async function parseHex(file) {
  const text = await readAsText(file)
  const lines = text.trim().split('\n')
  const records = []
  let totalBytes = 0
  let minAddr = Infinity, maxAddr = -Infinity
  let checksumValid = true

  for (const line of lines) {
    if (!line.startsWith(':')) continue
    const byteCount = parseInt(line.slice(1, 3), 16)
    const address = parseInt(line.slice(3, 7), 16)
    const type = parseInt(line.slice(7, 9), 16)
    const data = line.slice(9, 9 + byteCount * 2)
    const checksum = parseInt(line.slice(-2), 16)

    // Validate checksum
    let sum = byteCount + (address >> 8) + (address & 0xff) + type
    for (let i = 0; i < data.length; i += 2) sum += parseInt(data.slice(i, i + 2), 16)
    if (((~sum + 1) & 0xff) !== checksum) checksumValid = false

    if (type === 0) {
      totalBytes += byteCount
      if (address < minAddr) minAddr = address
      if (address + byteCount > maxAddr) maxAddr = address + byteCount
    }
    records.push({ address, type, byteCount })
  }

  return {
    geometry: null,
    metadata: { records: records.length, totalBytes, addressRange: [minAddr === Infinity ? 0 : minAddr, maxAddr], checksumValid },
    viewMode: 'hex',
    aiContext: `Intel HEX firmware '${file.name}', ${totalBytes} bytes of firmware data, address range 0x${(minAddr === Infinity ? 0 : minAddr).toString(16).toUpperCase()}–0x${maxAddr.toString(16).toUpperCase()}, checksum ${checksumValid ? 'valid' : 'INVALID'}`,
  }
}

async function parseImage(file) {
  const dataURL = await readAsDataURL(file)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        geometry: null,
        metadata: { dataURL, width: img.naturalWidth, height: img.naturalHeight, fileSize: file.size },
        viewMode: 'image',
        aiContext: `Image file '${file.name}', ${img.naturalWidth}×${img.naturalHeight}px`,
      })
    }
    img.onerror = () => {
      resolve({
        geometry: null,
        metadata: { dataURL, fileSize: file.size },
        viewMode: 'image',
        aiContext: `Image file '${file.name}'`,
      })
    }
    img.src = dataURL
  })
}

async function parsePDF(file) {
  const dataURL = await readAsDataURL(file)
  const buffer = await readAsArrayBuffer(file)
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let text = ''
  const pages = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item) => item.str).join(' ') + '\n'

    // Rasterize at 150 DPI
    const viewport = page.getViewport({ scale: 150 / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    pages.push(canvas.toDataURL('image/jpeg', 0.85))
  }

  return {
    geometry: null,
    metadata: {
      dataURL,
      pageCount: pdf.numPages,
      fileSize: file.size,
      text: text.slice(0, 60000),
      pages,
    },
    viewMode: 'pdf',
    aiContext: `PDF document '${file.name}', ${pdf.numPages} pages, ${(file.size / 1024).toFixed(1)} KB`,
  }
}

async function parseJSON(file) {
  const text = await readAsText(file)
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = null }
  const keys = parsed && typeof parsed === 'object' ? Object.keys(parsed) : []

  return {
    geometry: null,
    metadata: { content: text, parsed, topLevelKeys: keys },
    viewMode: 'json',
    aiContext: `JSON file '${file.name}', ${(text.length / 1024).toFixed(1)} KB, top-level keys: ${keys.slice(0, 10).join(', ')}`,
  }
}

async function parseSVG(file) {
  const text = await readAsText(file)
  const dataURL = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`
  const paths = (text.match(/<path/g) ?? []).length

  return {
    geometry: null,
    metadata: { content: text, dataURL, paths },
    viewMode: 'svg',
    aiContext: `SVG graphic '${file.name}', ${paths} path elements`,
  }
}

// ─── Fallback / generic text ──────────────────────────────────────────────────

async function parseGenericText(file) {
  const text = await readAsText(file)
  return {
    geometry: null,
    metadata: { content: text },
    viewMode: 'text',
    aiContext: `Text file '${file.name}', ${text.split('\n').length} lines`,
  }
}

async function parseGenericBinary(file) {
  const buffer = await readAsArrayBuffer(file)
  const bytes = new Uint8Array(buffer)
  const preview = Array.from(bytes.slice(0, 32)).map((b) => b.toString(16).padStart(2, '0')).join(' ')

  return {
    geometry: null,
    metadata: { sizeBytes: file.size, hexPreview: preview },
    viewMode: 'binary',
    aiContext: `Binary file '${file.name}', ${(file.size / 1024).toFixed(1)} KB`,
  }
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

/**
 * Process a file and return a normalised FileResult.
 * @param {File} file
 * @returns {Promise<FileResult>}
 */
export async function processFile(file) {
  const fmt = detectFormat(file.name)
  const ext = file.name.split('.').pop().toLowerCase()

  let parseResult
  try {
    switch (ext) {
      case 'stl': parseResult = await parseSTL(file); break
      case 'obj': parseResult = await parseOBJ(file); break
      case 'glb':
      case 'gltf': parseResult = await parseGLTF(file); break
      case 'ply': parseResult = await parsePLY(file); break
      case '3mf': parseResult = await parse3MF(file); break
      case 'amf': parseResult = await parseAMF(file); break
      case 'off': parseResult = await parseOFF(file); break
      case 'xyz': parseResult = await parseXYZ(file); break
      case 'pcd': parseResult = await parsePCD(file); break
      case 'dae': parseResult = await parseDAE(file); break
      case 'dxf': parseResult = await parseDXF(file); break
      case 'kicad_pcb': parseResult = await parseKiCadPCB(file); break
      case 'gbr':
      case 'gtl':
      case 'gbl': parseResult = await parseGerber(file); break
      case 'csv':
      case 'tsv': parseResult = await parseCSV(file); break
      case 'json': parseResult = await parseJSON(file); break
      case 'svg': parseResult = await parseSVG(file); break
      case 'pdf': parseResult = await parsePDF(file); break
      case 'hex': parseResult = await parseHex(file); break
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'bmp':
      case 'tiff': parseResult = await parseImage(file); break
      case 'ino':
      case 'c': case 'cpp': case 'h':
      case 'py': case 'rs':
      case 'sv': case 'v': case 'vhd':
      case 'md': case 'txt':
      case 'yaml': case 'yml': case 'toml':
      case 'xml': parseResult = await parseCode(file); break
      default:
        if (fmt?.binary) parseResult = await parseGenericBinary(file)
        else parseResult = await parseGenericText(file)
    }
  } catch (err) {
    throw new Error(`Failed to parse ${file.name}: ${err.message}`)
  }

  return {
    name: file.name,
    ext: ext,
    category: fmt?.category ?? 'unknown',
    format: fmt ?? { ext, name: ext.toUpperCase(), desc: 'Unknown format' },
    sizeBytes: file.size,
    parseResult,
    geometry: parseResult.geometry ?? null,
    metadata: parseResult.metadata ?? {},
    viewMode: parseResult.viewMode ?? 'raw',
    aiContext: parseResult.aiContext ?? `File '${file.name}'`,
  }
}

export default { processFile }
