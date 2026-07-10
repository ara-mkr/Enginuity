import React, { useState } from 'react'
import { Folder, FolderOpen, FileCode, Plus, Minus } from 'lucide-react'
import type { FileTreeNode } from '../types'

interface FileTreeProps {
  node: FileTreeNode
  onSelectFile: (path: string) => void
  selectedPath: string | null
}

export function FileTree({ node, onSelectFile, selectedPath }: FileTreeProps) {
  const [isOpen, setIsOpen] = useState(true)

  const getStatusColor = (status: FileTreeNode['status']) => {
    switch (status) {
      case 'added':
        return '#7aaa8a'
      case 'removed':
        return '#b08080'
      case 'modified':
        return '#b09470'
      case 'unchanged':
      default:
        return 'var(--text-muted)'
    }
  }

  const getStatusBadge = (status: FileTreeNode['status']) => {
    switch (status) {
      case 'added':
        return <Plus size={10} style={{ color: '#7aaa8a' }} />
      case 'removed':
        return <Minus size={10} style={{ color: '#b08080' }} />
      case 'modified':
        return <span style={{ fontSize: 9, color: '#b09470', fontFamily: "'JetBrains Mono', monospace" }}>~</span>
      default:
        return null
    }
  }

  const isSelected = selectedPath === node.path

  if (node.isDir) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8 }}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 6px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            userSelect: 'none',
            color: 'var(--text)',
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {isOpen ? <FolderOpen size={14} style={{ color: 'var(--accent-2)' }} /> : <Folder size={14} style={{ color: 'var(--text-muted)' }} />}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{node.name}</span>
          {node.status !== 'unchanged' && (
            <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 'auto' }}>
              {getStatusBadge(node.status)}
            </span>
          )}
        </div>
        
        {isOpen && node.children && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '1px solid var(--border)', marginLeft: 12, paddingLeft: 4 }}>
            {node.children.map((child) => (
              <FileTree
                key={child.path}
                node={child}
                onSelectFile={onSelectFile}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 12,
        userSelect: 'none',
        background: isSelected ? 'var(--accent-glow)' : 'transparent',
        borderLeft: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
        color: isSelected ? 'var(--accent)' : getStatusColor(node.status),
        transition: 'all 0.15s',
        paddingLeft: 8
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--surface-2)'
          e.currentTarget.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = getStatusColor(node.status)
        }
      }}
    >
      <FileCode size={13} style={{ opacity: 0.8 }} />
      <span style={{ fontFamily: "'JetBrains Mono', monospace", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.name}
      </span>
      {node.status !== 'unchanged' && (
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {getStatusBadge(node.status)}
        </span>
      )}
    </div>
  )
}
