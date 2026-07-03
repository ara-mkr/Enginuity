export function toMarkdown(components, results) {
  let md = `# Circuit Simulation Netlist & Results\n\n`
  md += `## Component Listing\n\n`
  md += `| Label | Type | Value | Nodes |\n`
  md += `|-------|------|-------|-------|\n`
  components.forEach(c => {
    md += `| ${c.label} | ${c.type} | ${c.value} | ${c.nodes?.join('-') || 'N/A'} |\n`
  })

  if (results) {
    md += `\n## Simulation Metrics\n\n`
    md += `| Node/Variable | Minimum | Maximum | Mean |\n`
    md += `|---------------|---------|---------|------|\n`
    Object.keys(results).forEach(node => {
      const vals = results[node] || []
      if (vals.length > 0) {
        const numVals = vals.filter(v => typeof v === 'number')
        const min = Math.min(...numVals)
        const max = Math.max(...numVals)
        const mean = numVals.reduce((a,b)=>a+b, 0)/numVals.length
        md += `| ${node} | ${min.toFixed(4)} | ${max.toFixed(4)} | ${mean.toFixed(4)} |\n`
      }
    })
  }

  return md
}

export function toNetlist(components) {
  let netlist = `* ENGINGUITY SPICE NETLIST GENERATION\n`
  components.forEach(c => {
    const nodesStr = c.nodes?.join(' ') || '0 0'
    netlist += `${c.label} ${nodesStr} ${c.value}\n`
  })
  netlist += `.op\n.end\n`
  return netlist
}

export function toJSON(components, results) {
  return JSON.stringify({ components, results }, null, 2)
}

export function toHTML(components, results) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Schematic Analysis</title>
  <style>
    body { font-family: monospace; background: #080810; color: #e2e4f0; padding: 20px; }
    .card { background: #13131f; border: 1px solid #1f1f35; border-radius: 8px; padding: 20px; max-width: 700px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Circuit Simulation Summary</h2>
    <pre>${toNetlist(components)}</pre>
  </div>
</body>
</html>`
}
