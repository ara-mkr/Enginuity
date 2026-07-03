export function toMarkdown(filename, stats, aiAnalysis) {
  let md = `# CAD Viewer Analysis: ${filename || 'Model'}\n\n`
  
  if (stats) {
    md += `## Geometry Statistics\n`
    md += `- **Vertices Count**: ${stats.vertexCount ?? 'N/A'}\n`
    md += `- **Faces Count**: ${stats.faceCount ?? 'N/A'}\n`
    if (stats.boundingBox) {
      md += `- **Bounding Box Dimensions**: X: ${stats.boundingBox.x}mm, Y: ${stats.boundingBox.y}mm, Z: ${stats.boundingBox.z}mm\n`
    }
    md += '\n'
  }

  if (aiAnalysis) {
    md += `## AI Material & Design Analysis\n\n`
    md += aiAnalysis
  }

  return md
}

export function toJSON(filename, stats, aiAnalysis, metadata) {
  return JSON.stringify({ filename, stats, aiAnalysis, metadata }, null, 2)
}
