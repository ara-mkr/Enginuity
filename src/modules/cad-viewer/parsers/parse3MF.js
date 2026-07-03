import JSZip from 'jszip'
import * as THREE from 'three'

// Dev-only diagnostics; stripped from production output.
const cadDebug = (...args) => { if (import.meta.env.DEV) console.debug(...args) }

export async function parse3MF(arrayBuffer) {
  // Step 1: Unzip
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  // Step 2: Find the root model file
  let modelPath = '3D/3dmodel.model'  // default
  
  const relsFile = zip.file('_rels/.rels')
  if (relsFile) {
    const relsText = await relsFile.async('text')
    const parser = new DOMParser()
    const relsDoc = parser.parseFromString(relsText, 'text/xml')
    const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'))
    for (const rel of relationships) {
      const type = rel.getAttribute('Type') || ''
      if (type.includes('3dmodel')) {
        modelPath = rel.getAttribute('Target').replace(/^\//, '')
        break
      }
    }
  }

  // Step 3: Parse the model XML
  let modelFile = zip.file(modelPath)
  if (!modelFile) {
    // Try common alternative paths
    const alternatives = [
      '3D/3dmodel.model',
      '3dmodel.model', 
      Object.keys(zip.files).find(f => f.endsWith('.model'))
    ].filter(Boolean)
    
    for (const alt of alternatives) {
      const f = zip.file(alt)
      if (f) { modelPath = alt; break }
    }
  }

  const actualModelFile = zip.file(modelPath)
  if (!actualModelFile) {
    throw new Error('Could not find 3D model XML file inside 3MF container.')
  }

  const modelText = await actualModelFile.async('text')
  const xmlDoc = new DOMParser().parseFromString(modelText, 'text/xml')

  // Step 4: Extract metadata
  const metadata = {}
  Array.from(xmlDoc.getElementsByTagName('metadata')).forEach(m => {
    const name = m.getAttribute('name')
    if (name) {
      metadata[name] = m.textContent
    }
  })

  // Step 5: Extract units
  const modelEl = xmlDoc.getElementsByTagName('model')[0]
  const unit = modelEl?.getAttribute('unit') || 'millimeter'
  const unitScale = {
    millimeter: 1,
    centimeter: 10,
    inch: 25.4,
    foot: 304.8,
    meter: 1000,
    micron: 0.001
  }[unit] || 1

  // Step 6: Build object map (id → object element)
  const objectMap = new Map()
  Array.from(xmlDoc.getElementsByTagName('object')).forEach(obj => {
    objectMap.set(obj.getAttribute('id'), obj)
  })

  // Step 7: Extract materials/colors
  const materialMap = new Map()
  Array.from(xmlDoc.getElementsByTagName('basematerials')).forEach(bm => {
    const bmId = bm.getAttribute('id')
    const materials = []
    Array.from(bm.getElementsByTagName('base')).forEach((base) => {
      const colorHex = base.getAttribute('displaycolor') || '#888888'
      materials.push(colorHex)
    })
    materialMap.set(bmId, materials)
  })

  // Step 8: Find build items (top-level objects to render)
  const buildEl = xmlDoc.getElementsByTagName('build')[0]
  const buildItems = buildEl ? Array.from(buildEl.getElementsByTagName('item')) : []
  
  const group = new THREE.Group()
  let totalVertices = 0
  let totalFaces = 0

  // Muted part colors for multi-body assemblies (Polaris palette)
  const partColors = [
    '#c8d0d8', // light grey-blue
    '#8899aa', // muted blue
    '#aabbcc', // steel
    '#99aabb', // slate
    '#bbccdd', // pale blue
    '#aab0b8', // warm grey
    '#9ab0c0', // cool grey
    '#b8c8d0', // ice
  ]
  let colorIndex = 0

  // Step 9: Recursive object builder
  function buildObject(objectEl, parentTransform) {
    const meshEl = objectEl.getElementsByTagName('mesh')[0] || null
    const componentsEl = objectEl.getElementsByTagName('components')[0] || null
    const objectGroup = new THREE.Group()

    if (parentTransform) {
      // Apply 3MF transform matrix (row-major 4x3)
      const t = parentTransform.split(' ').map(Number)
      if (t.length >= 12) {
        objectGroup.matrix.set(
          t[0], t[3], t[6], t[9],
          t[1], t[4], t[7], t[10],
          t[2], t[5], t[8], t[11],
          0,    0,    0,    1
        )
        objectGroup.matrixAutoUpdate = false
      }
    }

    // Handle direct mesh
    if (meshEl) {
      const geometry = new THREE.BufferGeometry()

      // Parse vertices — getElementsByTagName is namespace-agnostic
      const vertexEls = Array.from(meshEl.getElementsByTagName('vertex'))
      const positions = new Float32Array(vertexEls.length * 3)
      vertexEls.forEach((v, i) => {
        positions[i * 3]     = parseFloat(v.getAttribute('x') || 0) * unitScale
        positions[i * 3 + 1] = parseFloat(v.getAttribute('y') || 0) * unitScale
        positions[i * 3 + 2] = parseFloat(v.getAttribute('z') || 0) * unitScale
      })
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      // Parse triangles
      const triangleEls = Array.from(meshEl.getElementsByTagName('triangle'))
      const indices = new Uint32Array(triangleEls.length * 3)
      triangleEls.forEach((tri, i) => {
        indices[i * 3]     = parseInt(tri.getAttribute('v1') || 0)
        indices[i * 3 + 1] = parseInt(tri.getAttribute('v2') || 0)
        indices[i * 3 + 2] = parseInt(tri.getAttribute('v3') || 0)
      })
      geometry.setIndex(new THREE.BufferAttribute(indices, 1))

      // CRITICAL: Always compute normals
      geometry.computeVertexNormals()
      geometry.computeBoundingBox()

      totalVertices += vertexEls.length
      totalFaces += triangleEls.length

      // Determine color
      let color = partColors[colorIndex % partColors.length]
      colorIndex++

      const pid = objectEl.getAttribute('pid')
      const pindex = objectEl.getAttribute('pindex')
      if (pid && materialMap.has(pid)) {
        const mats = materialMap.get(pid)
        const idx = parseInt(pindex || 0)
        if (mats[idx]) color = mats[idx]
      }

      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        specular: new THREE.Color(0x222222),
        shininess: 30,
        side: THREE.DoubleSide
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = objectEl.getAttribute('name') || objectEl.getAttribute('id') || `Part ${colorIndex}`
      mesh.castShadow = true
      mesh.receiveShadow = true
      objectGroup.add(mesh)
    }

    // Handle components (sub-assemblies)
    if (componentsEl) {
      Array.from(componentsEl.getElementsByTagName('component')).forEach(component => {
        const refId = component.getAttribute('objectid')
        const transform = component.getAttribute('transform')
        const refObject = objectMap.get(refId)
        if (refObject) {
          const childGroup = buildObject(refObject, transform)
          objectGroup.add(childGroup)
        }
      })
    }

    return objectGroup
  }

  // Step 10: Build all items
  if (buildItems.length > 0) {
    buildItems.forEach((item) => {
      const objectId = item.getAttribute('objectid')
      const transform = item.getAttribute('transform')
      const objectEl = objectMap.get(objectId)
      if (objectEl) {
        const built = buildObject(objectEl, transform)
        group.add(built)
      }
    })
  } else {
    // No build items — render all mesh objects directly
    objectMap.forEach((objectEl) => {
      if (objectEl.querySelector('mesh')) {
        const built = buildObject(objectEl, null)
        group.add(built)
      }
    })
  }

  // Step 11: Extract thumbnail if present
  let thumbnailDataURL = null
  const thumbFile = zip.file('Metadata/thumbnail.png') || 
                    zip.file('Thumbnails/thumbnail.png') ||
                    Object.values(zip.files).find(f => 
                      f.name.endsWith('.png') && 
                      !f.name.includes('texture'))
  if (thumbFile) {
    const thumbBlob = await thumbFile.async('blob')
    thumbnailDataURL = URL.createObjectURL(thumbBlob)
  }

  return {
    group,
    metadata: {
      ...metadata,
      unit,
      objectCount: buildItems.length || objectMap.size,
      totalVertices,
      totalFaces,
      thumbnail: thumbnailDataURL
    }
  }
}

// Nuclear fallback: ignores build/component structure, finds every mesh element
export async function parse3MFFlat(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const group = new THREE.Group()

  const modelFiles = Object.keys(zip.files).filter(f =>
    f.endsWith('.model') || (f.endsWith('.xml') && !f.startsWith('_rels'))
  )

  const partColors = ['#c8d0d8','#8899aa','#aabbcc','#99aabb','#bbccdd','#aab0b8','#9ab0c0','#b8c8d0']
  let colorIndex = 0

  for (const modelPath of modelFiles) {
    const text = await zip.files[modelPath].async('text')
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    const meshEls = Array.from(doc.getElementsByTagName('mesh'))
    cadDebug('[CAD] parse3MFFlat found', meshEls.length, 'meshes in', modelPath)

    meshEls.forEach((meshEl, idx) => {
      try {
        const vertexEls = Array.from(meshEl.getElementsByTagName('vertex'))
        const triangleEls = Array.from(meshEl.getElementsByTagName('triangle'))
        cadDebug('[CAD] flat mesh', idx, 'verts:', vertexEls.length, 'tris:', triangleEls.length)

        if (vertexEls.length === 0 || triangleEls.length === 0) return

        const positions = new Float32Array(vertexEls.length * 3)
        vertexEls.forEach((v, i) => {
          positions[i * 3]     = parseFloat(v.getAttribute('x') || '0')
          positions[i * 3 + 1] = parseFloat(v.getAttribute('y') || '0')
          positions[i * 3 + 2] = parseFloat(v.getAttribute('z') || '0')
        })

        const indices = new Uint32Array(triangleEls.length * 3)
        triangleEls.forEach((t, i) => {
          indices[i * 3]     = parseInt(t.getAttribute('v1') || '0')
          indices[i * 3 + 1] = parseInt(t.getAttribute('v2') || '0')
          indices[i * 3 + 2] = parseInt(t.getAttribute('v3') || '0')
        })

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setIndex(new THREE.BufferAttribute(indices, 1))
        geo.computeVertexNormals()
        geo.computeBoundingBox()

        const mat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(partColors[colorIndex % partColors.length]),
          specular: new THREE.Color(0x222222),
          shininess: 30,
          side: THREE.DoubleSide
        })
        colorIndex++

        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
      } catch (e) {
        console.error('[CAD] flat parse failed for mesh', idx, e)
      }
    })
  }

  return group
}
