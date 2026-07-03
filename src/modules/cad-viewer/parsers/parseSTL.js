import * as THREE from 'three'

export function parseSTL(arrayBuffer) {
  // Detect ASCII vs binary
  const header = new Uint8Array(arrayBuffer, 0, 80)
  const headerStr = new TextDecoder().decode(header)
  
  const isASCII = headerStr.trimStart().startsWith('solid') && 
    isValidASCIISTL(arrayBuffer)

  let geometry
  if (isASCII) {
    geometry = parseASCIISTL(arrayBuffer)
  } else {
    geometry = parseBinarySTL(arrayBuffer)
  }

  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}

function isValidASCIISTL(buffer) {
  // Most reliable: binary STL has exactly 84 + numTriangles*50 bytes
  if (buffer.byteLength >= 84) {
    const view = new DataView(buffer)
    const numTriangles = view.getUint32(80, true)
    if (84 + numTriangles * 50 === buffer.byteLength) return false
  }
  // Secondary: look for "facet normal" text (binary headers rarely contain this)
  const text = new TextDecoder('utf-8', { fatal: false })
    .decode(new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength)))
  return text.includes('facet normal')
}

function parseBinarySTL(buffer) {
  const reader = new DataView(buffer)
  const numTriangles = reader.getUint32(80, true)
  
  const positions = new Float32Array(numTriangles * 9)
  
  let offset = 84
  for (let i = 0; i < numTriangles; i++) {
    // Normal vector (skip — we'll recompute)
    offset += 12
    
    // 3 vertices
    for (let v = 0; v < 3; v++) {
      const idx = i * 9 + v * 3
      positions[idx]     = reader.getFloat32(offset,     true)
      positions[idx + 1] = reader.getFloat32(offset + 4, true)
      positions[idx + 2] = reader.getFloat32(offset + 8, true)
      offset += 12
    }
    
    offset += 2 // attribute byte count
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
}

function parseASCIISTL(buffer) {
  const text = new TextDecoder().decode(buffer)
  const positions = []
  
  const vertexRegex = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g
  let match
  while ((match = vertexRegex.exec(text)) !== null) {
    positions.push(
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3])
    )
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', 
    new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geometry
}
