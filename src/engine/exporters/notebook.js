export function toMarkdown(entries) {
  let md = `---\nproject: ENGINGUITY Export\ndate: ${new Date().toISOString()}\n---\n\n`
  
  entries.forEach(e => {
    md += `# ${e.title}\n`
    md += `**Date:** ${new Date(e.date).toLocaleString()} | **Tags:** ${e.tags?.join(', ') || 'none'}\n\n`
    if (e.linkedModule) {
      md += `*Linked Module: ${e.linkedModule}*\n\n`
    }
    md += `${e.notes}\n\n`
    md += `---\n\n`
  })

  return md
}

export function toJSON(entries) {
  return JSON.stringify(entries, null, 2)
}

export function toObsidian(entries) {
  // Convert standard references to Obsidian-style wiki links e.g. [[Note title]]
  let md = `---\nproject: Obsidian Vault Export\n---\n\n`
  
  entries.forEach(e => {
    md += `## [[${e.title}]]\n`
    md += `created: ${e.date}\ntags: ${e.tags?.map(t => `#${t}`).join(' ') || ''}\n\n`
    
    // Attempt simple link parsing in content: replace references to other notes
    let notes = e.notes
    entries.forEach(other => {
      if (other.id !== e.id) {
        const regex = new RegExp(other.title, 'gi')
        notes = notes.replace(regex, `[[${other.title}]]`)
      }
    })
    
    md += `${notes}\n\n`
    md += `---\n\n`
  })
  
  return md
}

export function toHTML(entries) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Engineering Logbook</title>
  <style>
    body { font-family: monospace; background: #080810; color: #e2e4f0; padding: 30px; }
    .timeline { max-width: 800px; margin: 0 auto; border-left: 2px solid #1f1f35; padding-left: 20px; }
    .entry { position: relative; margin-bottom: 30px; }
    .dot { position: absolute; left: -26px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #00c8ff; }
    .title { font-size: 18px; font-weight: bold; color: #00c8ff; }
    .meta { font-size: 11px; color: #6b6d85; margin: 4px 0 12px; }
    .content { font-size: 13px; line-height: 1.6; white-space: pre-wrap; background: #13131f; padding: 15px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="timeline">
    ${entries.map(e => `
      <div class="entry">
        <div class="dot"></div>
        <div class="title">${e.title}</div>
        <div class="meta">Logged: ${new Date(e.date).toLocaleString()} | Tags: ${e.tags?.join(', ') || 'none'}</div>
        <div class="content">${e.notes}</div>
      </div>
    `).join('')}
  </div>
</body>
</html>`
}
