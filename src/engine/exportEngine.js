import * as paramPlaygroundExporter from './exporters/parameterPlayground'
import * as cadViewerExporter from './exporters/cadViewer'
import * as circuitSimExporter from './exporters/circuitSim'
import * as datasheetExporter from './exporters/datasheet'
import * as notebookExporter from './exporters/notebook'
import * as bomExporter from './exporters/bom'
import * as firmwareDiffExporter from './exporters/firmwareDiff'

export const EXPORT_TARGETS = [
  {
    id: 'github_gist',
    name: 'GitHub Gist',
    icon: 'Github',
    description: 'Save as a secret Gist',
    requiresAuth: true,
    authKey: 'enginguity_github_token',
    formats: ['markdown', 'json', 'code', 'patch']
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: 'BookOpen',
    description: 'Create a Notion page',
    requiresAuth: true,
    authKey: 'enginguity_notion_token',
    formats: ['markdown']
  },
  {
    id: 'clipboard_md',
    name: 'Copy as Markdown',
    icon: 'Copy',
    description: 'Ready for any markdown editor',
    requiresAuth: false,
    formats: ['markdown']
  },
  {
    id: 'clipboard_html',
    name: 'Copy as HTML',
    icon: 'FileText',
    description: 'Paste into any web editor',
    requiresAuth: false,
    formats: ['html']
  },
  {
    id: 'download_md',
    name: 'Download .md',
    icon: 'Download',
    description: 'Markdown file',
    requiresAuth: false,
    formats: ['markdown']
  },
  {
    id: 'download_pdf',
    name: 'Download PDF',
    icon: 'Download',
    description: 'Print-ready PDF',
    requiresAuth: false,
    formats: ['pdf']
  },
  {
    id: 'download_html',
    name: 'Self-contained HTML',
    icon: 'Download',
    description: 'Share as a single file',
    requiresAuth: false,
    formats: ['html']
  },
  {
    id: 'download_json',
    name: 'Export as JSON',
    icon: 'Download',
    description: 'Raw data, re-importable',
    requiresAuth: false,
    formats: ['json']
  },
  {
    id: 'obsidian',
    name: 'Obsidian Vault',
    icon: 'BookOpen',
    description: 'Formatted for Obsidian',
    requiresAuth: false,
    formats: ['markdown']
  },
  {
    id: 'share_link',
    name: 'Share Link',
    icon: 'Share2',
    description: 'Encoded URL, no server needed',
    requiresAuth: false,
    formats: ['url']
  }
]

// Convert markdown structure to Notion block format
export function markdownToNotionBlocks(md) {
  const lines = md.split('\n')
  const blocks = []

  let inCodeBlock = false
  let codeLines = []
  let codeLang = 'javascript'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Code blocks parser
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Close block
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
            language: codeLang
          }
        })
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeLang = line.slice(3).trim() || 'javascript'
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(lines[i])
      continue
    }

    if (!line) continue

    // Headers
    if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
        }
      })
    } else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: line.slice(3) } }]
        }
      })
    } else if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: line.slice(4) } }]
        }
      })
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
        }
      })
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: line } }]
        }
      })
    }
  }

  return blocks
}

// GitHub Gist export API dispatcher
export async function exportToGist(token, moduleName, filename, content) {
  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: `ENGINGUITY Export — ${moduleName} — ${new Date().toLocaleDateString()}`,
      public: false,
      files: {
        [filename]: { content }
      }
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${response.status}`)
  }

  const data = await response.json()
  return data
}

// Notion Integration page exporter
export async function exportToNotion(token, pageUrl, moduleName, markdownContent) {
  // Extract 32-character hexadecimal page ID from URL
  const match = pageUrl.match(/[a-f0-9]{32}/i)
  if (!match) {
    throw new Error('Invalid Notion page URL. Make sure it contains a 32-character hex ID.')
  }
  const pageId = match[0]

  const blocks = markdownToNotionBlocks(markdownContent)

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { page_id: pageId },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: `ENGINGUITY Export - ${moduleName}` } }]
        }
      },
      children: blocks.slice(0, 95) // Notion API caps children block list size
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${response.status}`)
  }

  const data = await response.json()
  return data
}

// Map module name to specific exporter routines
export function getExporterForModule(moduleName) {
  switch (moduleName.toLowerCase()) {
    case 'parameter playground':
    case 'playground':
    case 'parameters':
      return paramPlaygroundExporter
    case 'cad viewer':
    case 'cad':
      return cadViewerExporter
    case 'circuit sim':
    case 'circuit':
      return circuitSimExporter
    case 'datasheet':
    case 'datasheet intelligence':
      return datasheetExporter
    case 'notebook':
    case 'engineering notebook':
      return notebookExporter
    case 'bom':
    case 'bom intelligence':
      return bomExporter
    case 'firmware diff':
    case 'firmware-diff':
      return firmwareDiffExporter
    default:
      return null
  }
}
