export function toPatch(diffLines, fileA, fileB) {
  let patch = `diff --git a/${fileA || 'before'} b/${fileB || 'after'}\n`
  patch += `--- a/${fileA || 'before'}\n`
  patch += `+++ b/${fileB || 'after'}\n`

  // Minimal hunks formatter for the raw file patch
  // To avoid complex grouping, we serialize sequentially
  let inHunk = false
  let startA = 0
  let startB = 0
  let linesAccum = []

  diffLines.forEach((l, idx) => {
    if (l.type !== 'UNCHANGED') {
      if (!inHunk) {
        inHunk = true
        startA = l.lineA || idx
        startB = l.lineB || idx
        linesAccum = []
      }
      if (l.type === 'REMOVED' || l.type === 'MODIFIED') {
        linesAccum.push(`-${l.value || l.valueA}`)
      }
      if (l.type === 'ADDED' || l.type === 'MODIFIED') {
        linesAccum.push(`+${l.value || l.valueB}`)
      }
    } else {
      if (inHunk) {
        patch += `@@ -${startA},${linesAccum.filter(li => li.startsWith('-')).length} +${startB},${linesAccum.filter(li => li.startsWith('+')).length} @@\n`
        patch += linesAccum.join('\n') + '\n'
        inHunk = false
      }
    }
  })

  if (inHunk) {
    patch += `@@ -${startA},${linesAccum.filter(li => li.startsWith('-')).length} +${startB},${linesAccum.filter(li => li.startsWith('+')).length} @@\n`
    patch += linesAccum.join('\n') + '\n'
  }

  return patch
}

export function toMarkdown(stats, analysis) {
  let md = `# Firmware Diff Analysis Report\n\n`
  md += `## Changes Summary\n`
  md += `- **Additions**: ${stats.linesAdded} lines\n`
  md += `- **Removals**: ${stats.linesRemoved} lines\n`
  md += `- **Modifications**: ${stats.linesModified} lines\n`
  md += `- **Density Score**: ${stats.percentChanged}% of the firmware altered\n\n`

  if (analysis) {
    md += `## AI Semantics Report\n`
    md += `> ${analysis.summary}\n\n`
    md += `### Identified Risks\n`
    analysis.risks.forEach((r, idx) => {
      md += `${idx + 1}. **[${r.severity.toUpperCase()}]** ${r.description} (Lines: ${r.relatedLines.join(', ') || 'N/A'})\n`
    })
  }

  return md
}

export function toHTML(diffLines, fileA, fileB) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Firmware Diff: ${fileA} vs ${fileB}</title>
  <style>
    body { font-family: monospace; background: #080810; color: #e2e4f0; padding: 20px; }
    .line { display: flex; font-size: 12px; line-height: 18px; }
    .num { width: 40px; color: #3a3c55; text-align: right; padding-right: 8px; border-right: 1px solid #1f1f35; background: rgba(0,0,0,0.15); user-select: none; }
    .code { padding-left: 10px; white-space: pre; flex: 1; }
    .added { background: rgba(0,230,118,0.12); color: #00e676; }
    .removed { background: rgba(255,107,107,0.12); color: #ff6b6b; }
    .modified { background: rgba(255,171,64,0.12); color: #ffab40; }
  </style>
</head>
<body>
  <h2>Comparison: ${fileA} → ${fileB}</h2>
  <div style="border: 1px solid #1f1f35; border-radius: 6px; overflow: hidden; background: #13131f;">
    ${diffLines.map((l, i) => `
      <div class="line ${l.type.toLowerCase()}">
        <span class="num">${l.lineA || ''}</span>
        <span class="num">${l.lineB || ''}</span>
        <span class="code">${l.value || l.valueA || l.valueB || ''}</span>
      </div>
    `).join('')}
  </div>
</body>
</html>`
}

export function toGitHubPR(stats, analysis) {
  let pr = `## Summary of Firmware Changes\n\n`
  pr += `### Metric Changes\n`
  pr += `- **Lines Added**: ${stats.linesAdded}\n`
  pr += `- **Lines Removed**: ${stats.linesRemoved}\n`
  pr += `- **Lines Modified**: ${stats.linesModified}\n\n`
  
  if (analysis) {
    pr += `### Semantic Risk Analysis\n`
    pr += `> ${analysis.summary}\n\n`
    
    if (analysis.breaking_changes?.length > 0) {
      pr += `### △ Breaking Changes\n`
      analysis.breaking_changes.forEach(bc => {
        pr += `- ${bc}\n`
      })
      pr += '\n'
    }
  }

  return pr
}
