export function toMarkdown(profile) {
  let md = `# Datasheet Analysis: ${profile.name || 'Component'}\n\n`
  
  if (profile.description) {
    md += `## Description\n${profile.description}\n\n`
  }

  if (profile.parameters) {
    md += `## Key Specifications\n\n`
    md += `| Parameter | Value | Details |\n`
    md += `|-----------|-------|---------|\n`
    Object.keys(profile.parameters).forEach(key => {
      const val = profile.parameters[key]
      md += `| ${key} | ${val.value || val} | ${val.notes || 'N/A'} |\n`
    })
    md += '\n'
  }

  if (profile.pinout) {
    md += `## Pin Configuration\n\n`
    md += `| Pin | Function | Description |\n`
    md += `|-----|----------|-------------|\n`
    profile.pinout.forEach(p => {
      md += `| ${p.number || p.pin} | ${p.name || p.function} | ${p.description || ''} |\n`
    })
  }

  return md
}

export function toJSON(profile) {
  return JSON.stringify(profile, null, 2)
}

export function toHTML(profile) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Datasheet Profile: ${profile.name || 'Component'}</title>
  <style>
    body { font-family: sans-serif; background: #080810; color: #e2e4f0; padding: 30px; }
    .card { background: #13131f; border: 1px solid #1f1f35; border-radius: 8px; padding: 24px; max-width: 800px; margin: 0 auto; }
    h1 { color: #00c8ff; font-family: monospace; border-bottom: 1px solid #1f1f35; padding-bottom: 8px; }
    h2 { font-family: monospace; color: #7b5ea7; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #1f1f35; padding: 10px; text-align: left; font-size: 13px; }
    th { background: #1a1a2e; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${profile.name || 'Component Profile'}</h1>
    <p>${profile.description || 'No description available.'}</p>
    
    <h2>Specifications</h2>
    <table>
      <thead>
        <tr><th>Parameter</th><th>Value</th></tr>
      </thead>
      <tbody>
        ${Object.keys(profile.parameters || {}).map(k => `<tr><td><strong>${k}</strong></td><td>${profile.parameters[k].value || profile.parameters[k]}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`
}
