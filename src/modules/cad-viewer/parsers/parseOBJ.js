import * as THREE from 'three'

export function parseOBJ(text) {
  // Parse OBJ without any MTL loading
  // Handles: v, vt, vn, f (triangles and quads)
  
  const positions = []
  const uvs = []
  const normals = []
  const finalPositions = []
  const finalNormals = []
  
  const lines = text.split('\n')
  
  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    
    if (parts[0] === 'v') {
      positions.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      )
    } else if (parts[0] === 'vn') {
      normals.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      )
    } else if (parts[0] === 'f') {
      // Face: can be v, v/vt, v/vt/vn, v//vn
      // Handle quads by splitting into two triangles
      const faceVerts = parts.slice(1)
      const triangles = faceVerts.length === 4
        ? [[0,1,2],[0,2,3]]
        : [[0,1,2]]
      
      for (const tri of triangles) {
        for (const idx of tri) {
          const vertStr = faceVerts[idx]
          if (!vertStr) continue
          const [vIdx, vtIdx, vnIdx] = vertStr.split('/').map(s => 
            s ? parseInt(s) - 1 : undefined)
          
          if (isNaN(vIdx)) continue
          const pi = vIdx * 3
          finalPositions.push(
            positions[pi], 
            positions[pi + 1], 
            positions[pi + 2]
          )
          
          if (vnIdx !== undefined && normals.length) {
            const ni = vnIdx * 3
            finalNormals.push(
              normals[ni],
              normals[ni + 1],
              normals[ni + 2]
            )
          }
        }
      }
    }
  }
  
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', 
    new THREE.BufferAttribute(new Float32Array(finalPositions), 3))
  
  if (finalNormals.length === finalPositions.length) {
    geometry.setAttribute('normal',
      new THREE.BufferAttribute(new Float32Array(finalNormals), 3))
  }
  
  geometry.computeVertexNormals() // always recompute for reliability
  geometry.computeBoundingBox()
  return geometry
}
