const FILE_FORMATS = {
  geometry: {
    label: 'CAD & 3D Geometry',
    color: '#00c8ff',
    formats: [
      { ext: 'stl',  name: 'STL',      desc: 'Stereolithography',          loader: 'STLLoader',        binary: true  },
      { ext: 'obj',  name: 'OBJ',      desc: 'Wavefront Object',           loader: 'OBJLoader',        binary: false },
      { ext: 'glb',  name: 'GLB',      desc: 'Binary glTF',                loader: 'GLTFLoader',       binary: true  },
      { ext: 'gltf', name: 'glTF',     desc: 'GL Transmission Format',     loader: 'GLTFLoader',       binary: false },
      { ext: '3mf',  name: '3MF',      desc: '3D Manufacturing Format',    loader: 'ThreeMFLoader',    binary: true  },
      { ext: 'ply',  name: 'PLY',      desc: 'Polygon File Format',        loader: 'PLYLoader',        binary: true  },
      { ext: 'off',  name: 'OFF',      desc: 'Object File Format',         loader: 'custom',           binary: false },
      { ext: 'amf',  name: 'AMF',      desc: 'Additive Manufacturing Format', loader: 'custom_xml',   binary: false },
      { ext: 'wrl',  name: 'VRML',     desc: 'Virtual Reality Modeling',   loader: 'VRMLLoader',       binary: false },
      { ext: 'x3d',  name: 'X3D',      desc: 'Extensible 3D',             loader: 'X3DLoader',        binary: false },
      { ext: 'dae',  name: 'COLLADA',  desc: 'Digital Asset Exchange',     loader: 'ColladaLoader',    binary: false },
      { ext: 'fbx',  name: 'FBX',      desc: 'Filmbox',                    loader: 'FBXLoader',        binary: true  },
      { ext: '3ds',  name: '3DS',      desc: 'Autodesk 3DS Max',           loader: 'TDSLoader',        binary: true  },
      { ext: 'xyz',  name: 'XYZ',      desc: 'Point Cloud',                loader: 'custom_pointcloud',binary: false },
      { ext: 'pcd',  name: 'PCD',      desc: 'Point Cloud Data',           loader: 'PCDLoader',        binary: true  },
    ],
  },

  electronics: {
    label: 'Electronics & PCB',
    color: '#00e676',
    formats: [
      { ext: 'kicad_pcb', name: 'KiCad PCB',      desc: 'KiCad Board Layout',     loader: 'custom_kicad',        binary: false },
      { ext: 'kicad_sch', name: 'KiCad Schematic', desc: 'KiCad Schematic',        loader: 'custom_kicad_sch',    binary: false },
      { ext: 'sch',       name: 'Eagle SCH',       desc: 'Eagle Schematic',        loader: 'custom_eagle',        binary: false },
      { ext: 'brd',       name: 'Eagle BRD',       desc: 'Eagle Board',            loader: 'custom_eagle_brd',    binary: false },
      { ext: 'gbr',       name: 'Gerber',          desc: 'PCB Fabrication File',   loader: 'custom_gerber',       binary: false },
      { ext: 'gtl',       name: 'Gerber Top',      desc: 'Top Copper Layer',       loader: 'custom_gerber',       binary: false },
      { ext: 'gbl',       name: 'Gerber Bottom',   desc: 'Bottom Copper Layer',    loader: 'custom_gerber',       binary: false },
      { ext: 'drl',       name: 'Drill File',      desc: 'NC Drill / Excellon',    loader: 'custom_drill',        binary: false },
      { ext: 'lht',       name: 'LibrePCB',        desc: 'LibrePCB Layout',        loader: 'custom_librepcb',     binary: false },
    ],
  },

  simulation: {
    label: 'Simulation & Analysis',
    color: '#9485b8',
    formats: [
      { ext: 'csv',  name: 'CSV',               desc: 'Comma Separated Values',    loader: 'custom_csv',     binary: false },
      { ext: 'tsv',  name: 'TSV',               desc: 'Tab Separated Values',      loader: 'custom_csv',     binary: false },
      { ext: 'mat',  name: 'MATLAB',            desc: 'MATLAB Data File',          loader: 'custom_mat',     binary: true  },
      { ext: 'npz',  name: 'NumPy',             desc: 'NumPy Compressed Array',    loader: 'custom_npz',     binary: true  },
      { ext: 'hdf5', name: 'HDF5',              desc: 'Hierarchical Data Format',  loader: 'custom_hdf5',    binary: true  },
      { ext: 'h5',   name: 'HDF5',              desc: 'Hierarchical Data Format',  loader: 'custom_hdf5',    binary: true  },
      { ext: 'vtk',  name: 'VTK',               desc: 'Visualization Toolkit',     loader: 'custom_vtk',     binary: false },
      { ext: 'vtu',  name: 'VTK Unstructured',  desc: 'VTK Unstructured Grid',     loader: 'custom_vtu',     binary: false },
      { ext: 'inp',  name: 'Abaqus INP',        desc: 'FEA Input File',            loader: 'custom_inp',     binary: false },
      { ext: 'bdf',  name: 'Nastran',           desc: 'Nastran Bulk Data',         loader: 'custom_nastran', binary: false },
      { ext: 'med',  name: 'Salome MED',        desc: 'FEA Mesh Format',           loader: 'custom_med',     binary: true  },
    ],
  },

  code: {
    label: 'Code & Firmware',
    color: '#b09470',
    formats: [
      { ext: 'ino', name: 'Arduino',      desc: 'Arduino Sketch',          loader: 'text',           binary: false },
      { ext: 'c',   name: 'C',            desc: 'C Source File',           loader: 'text',           binary: false },
      { ext: 'cpp', name: 'C++',          desc: 'C++ Source File',         loader: 'text',           binary: false },
      { ext: 'h',   name: 'Header',       desc: 'C/C++ Header',            loader: 'text',           binary: false },
      { ext: 'py',  name: 'Python',       desc: 'Python Script',           loader: 'text',           binary: false },
      { ext: 'rs',  name: 'Rust',         desc: 'Rust Source File',        loader: 'text',           binary: false },
      { ext: 'sv',  name: 'SystemVerilog',desc: 'Hardware Description',    loader: 'text',           binary: false },
      { ext: 'v',   name: 'Verilog',      desc: 'Hardware Description',    loader: 'text',           binary: false },
      { ext: 'vhd', name: 'VHDL',         desc: 'Hardware Description',    loader: 'text',           binary: false },
      { ext: 'hex', name: 'Intel HEX',    desc: 'Firmware Binary',         loader: 'custom_hex',     binary: false },
      { ext: 'bin', name: 'Binary',       desc: 'Raw Firmware',            loader: 'binary_hex',     binary: true  },
      { ext: 'elf', name: 'ELF',          desc: 'Executable Firmware',     loader: 'custom_elf',     binary: true  },
    ],
  },

  documents: {
    label: 'Documents & Specs',
    color: '#ff6b6b',
    formats: [
      { ext: 'pdf',  name: 'PDF',      desc: 'Portable Document Format',    loader: 'pdf',            binary: true  },
      { ext: 'md',   name: 'Markdown', desc: 'Markdown Document',           loader: 'text',           binary: false },
      { ext: 'txt',  name: 'Text',     desc: 'Plain Text',                  loader: 'text',           binary: false },
      { ext: 'json', name: 'JSON',     desc: 'JSON Data',                   loader: 'json',           binary: false },
      { ext: 'yaml', name: 'YAML',     desc: 'YAML Config',                 loader: 'text',           binary: false },
      { ext: 'yml',  name: 'YAML',     desc: 'YAML Config',                 loader: 'text',           binary: false },
      { ext: 'toml', name: 'TOML',     desc: 'TOML Config',                 loader: 'text',           binary: false },
      { ext: 'xml',  name: 'XML',      desc: 'XML Document',                loader: 'text',           binary: false },
      { ext: 'bom',  name: 'BOM',      desc: 'Bill of Materials',           loader: 'custom_bom',     binary: false },
      { ext: 'dxf',  name: 'DXF',      desc: 'AutoCAD Drawing Exchange',   loader: 'custom_dxf',     binary: false },
      { ext: 'svg',  name: 'SVG',      desc: 'Scalable Vector Graphic',    loader: 'svg',            binary: false },
    ],
  },

  imaging: {
    label: 'Images & Scans',
    color: '#00c8ff',
    formats: [
      { ext: 'png',  name: 'PNG',    desc: 'Portable Network Graphic',      loader: 'image',          binary: true  },
      { ext: 'jpg',  name: 'JPEG',   desc: 'JPEG Image',                    loader: 'image',          binary: true  },
      { ext: 'jpeg', name: 'JPEG',   desc: 'JPEG Image',                    loader: 'image',          binary: true  },
      { ext: 'tiff', name: 'TIFF',   desc: 'Tagged Image (PCB scans)',       loader: 'image',          binary: true  },
      { ext: 'bmp',  name: 'Bitmap', desc: 'Bitmap Image',                  loader: 'image',          binary: true  },
      { ext: 'dcm',  name: 'DICOM',  desc: 'Medical/CT Scan',               loader: 'custom_dicom',   binary: true  },
    ],
  },
}

export default FILE_FORMATS

// ── Derived helpers ───────────────────────────────────────────────────────────

/** Flat map of ext → { format, category, categoryColor } */
export const EXT_MAP = (() => {
  const map = {}
  for (const [catId, cat] of Object.entries(FILE_FORMATS)) {
    for (const fmt of cat.formats) {
      map[fmt.ext] = { ...fmt, category: catId, categoryColor: cat.color, categoryLabel: cat.label }
    }
  }
  return map
})()

/** All supported extensions as a flat array */
export const ALL_EXTENSIONS = Object.keys(EXT_MAP)

/** Accept string for <input type="file"> */
export const ACCEPT_STRING = ALL_EXTENSIONS.map((e) => `.${e}`).join(',')

/** Look up format info by file extension */
export function detectFormat(filename) {
  const parts = filename.split('.')
  // Try longest suffix first (e.g. kicad_pcb before pcb)
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join('.').toLowerCase()
    if (EXT_MAP[ext]) return EXT_MAP[ext]
  }
  return null
}
