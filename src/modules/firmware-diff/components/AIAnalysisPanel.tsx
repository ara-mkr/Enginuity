import { useState } from 'react'
import { Settings, Shield, AlertOctagon, Bug, Sparkles, Plus, AlertTriangle, FileText, CheckCircle2, ChevronRight } from 'lucide-react'
import type { AIAnalysisResult, AIChange, AIRisk } from '../types'
import type { NotebookEntry } from '../../notebook/types'

interface AIAnalysisPanelProps {
  analysis: AIAnalysisResult
  onJumpToLine: (line: number) => void
}

export function AIAnalysisPanel({ analysis, onJumpToLine }: AIAnalysisPanelProps) {
  const [addedNotes, setAddedNotes] = useState<Record<number, boolean>>({})

  const getRiskColor = (risk: AIAnalysisResult['overall_risk']) => {
    switch (risk) {
      case 'low': return '#7aaa8a'
      case 'medium': return '#b09470'
      case 'high':
      default:
        return '#b08080'
    }
  }

  const getSeverityColor = (sev: AIChange['severity'] | AIRisk['severity']) => {
    switch (sev) {
      case 'breaking':
      case 'high':
        return '#b08080'
      case 'significant':
      case 'medium':
        return '#b09470'
      case 'minor':
      case 'low':
        return '#7ab4c4'
      case 'cosmetic':
      default:
        return 'var(--text-muted)'
    }
  }

  const getChangeIcon = (type: AIChange['type']) => {
    const style = { size: 14 }
    switch (type) {
      case 'behavioral':
        return <Settings {...style} style={{ color: 'var(--accent)' }} />
      case 'performance':
        return <Sparkles {...style} style={{ color: '#b09470' }} />
      case 'safety':
        return <Shield {...style} style={{ color: '#7aaa8a' }} />
      case 'bug_fix':
        return <Bug {...style} style={{ color: '#b08080' }} />
      case 'refactor':
        return <Settings {...style} style={{ color: '#9485b8' }} />
      case 'config':
      case 'dependency':
      default:
        return <FileText {...style} style={{ color: 'var(--text-muted)' }} />
    }
  }

  // Handle: Add Test Recommendation to Engineering Notebook
  const handleAddToNotebook = (rec: string, index: number) => {
    try {
      const existing: NotebookEntry[] = JSON.parse(localStorage.getItem('enginguity_notebook') ?? '[]')
      
      const newEntry: NotebookEntry = {
        // eslint-disable-next-line react-hooks/purity -- click-handler code, not render
        id: `nb-rec-${Date.now()}-${index}`,
        type: 'TEST_RESULT' as const,
        title: `Validation Test: Firmware Recommendation #${index + 1}`,
        tags: ['FirmwareDiff', 'AIRecommendation', 'TestPlan'],
        date: new Date().toISOString(),
        linkedModule: 'Firmware Diff',
        attachedFiles: [],
        testType: 'Firmware Verification',
        conditions: 'Simulated environment / hardware testbed',
        measurements: [],
        passFail: true,
        notes: `AI-Recommended Verification Test Plan:\n\n${rec}\n\nGenerated from Firmware Diff Viewer semantic changes review.`
      }

      localStorage.setItem('enginguity_notebook', JSON.stringify([newEntry, ...existing]))
      setAddedNotes(prev => ({ ...prev, [index]: true }))
    } catch {
      alert('Failed to log test recommendation to notebook.')
    }
  }

  const highSeverityRisks = analysis.risks.filter(r => r.severity === 'high')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 12 }}>
      
      {/* High-level Summary Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${getRiskColor(analysis.overall_risk)}`,
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10,  color: 'var(--text-muted)',  }}>
            AI Semantic Summary
          </span>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '6px 0 0', lineHeight: 1.5 }}>
            {analysis.summary}
          </p>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4
        }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-dim)',  }}>
            Overall Change Risk
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            color: getRiskColor(analysis.overall_risk),
            backgroundColor: `${getRiskColor(analysis.overall_risk)}10`,
            border: `1px solid ${getRiskColor(analysis.overall_risk)}25`,
            padding: '4px 10px',
            borderRadius: 6,
            
            
          }}>
            {analysis.overall_risk} Risk
          </span>
        </div>
      </div>

      {/* Prominent Danger warning if High Risks are found */}
      {highSeverityRisks.length > 0 && (
        <div style={{
          background: 'rgba(255, 107, 107, 0.08)',
          border: '1px solid rgba(255, 107, 107, 0.25)',
          borderRadius: 10,
          padding: '16px 20px',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start'
        }}>
          <AlertOctagon size={20} style={{ color: '#b08080', flexShrink: 0, marginTop: 2 }} />
          <div>
            <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#b08080', margin: '0 0 4px' }}>
              CRITICAL SECURITY OR SAFETY RISKS DETECTED
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              The diff contains changes that may cause system instability, overflow, or bypass memory boundaries. Review the highlighted risks carefully.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Changes Timeline & Risks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        
        {/* Left: Changes List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={14} style={{ color: 'var(--accent)' }} /> Semantic Modifications
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analysis.changes.map((change, idx) => (
              <div key={idx} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {getChangeIcon(change.type)}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {change.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    fontWeight: 600,
                    
                    padding: '2px 6px',
                    borderRadius: 4,
                    color: getSeverityColor(change.severity),
                    backgroundColor: `${getSeverityColor(change.severity)}12`
                  }}>
                    {change.severity}
                  </span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.4 }}>
                  {change.description}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                  <strong>Impact:</strong> {change.impact}
                </p>

                {change.lineRange && (
                  <button
                    onClick={() => onJumpToLine(change.lineRange!.start)}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      marginTop: 4
                    }}
                  >
                    Jump to lines {change.lineRange.start}-{change.lineRange.end} <ChevronRight size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Risks & Warnings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ color: '#b09470' }} /> Integrity Risks
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analysis.risks.map((risk, idx) => (
              <div key={idx} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                    Risk #{idx + 1}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    fontWeight: 600,
                    
                    padding: '2px 6px',
                    borderRadius: 4,
                    color: getRiskColor(risk.severity),
                    backgroundColor: `${getRiskColor(risk.severity)}12`
                  }}>
                    {risk.severity} severity
                  </span>
                </div>

                <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.4 }}>
                  {risk.description}
                </p>

                {risk.relatedLines && risk.relatedLines.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>Related:</span>
                    {risk.relatedLines.map((line) => (
                      <button
                        key={line}
                        onClick={() => onJumpToLine(line)}
                        style={{
                          background: 'var(--bg-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          padding: '1px 5px',
                          color: 'var(--accent)',
                          fontSize: 10,
                          fontFamily: "'JetBrains Mono', monospace",
                          cursor: 'pointer'
                        }}
                      >
                        L{line}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {analysis.risks.length === 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                No active integrity risks identified.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breaking Changes Callout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Breaking Changes
        </h3>
        {analysis.breaking_changes && analysis.breaking_changes.length > 0 ? (
          <div style={{
            background: 'rgba(255, 107, 107, 0.04)',
            border: '1px solid rgba(255, 107, 107, 0.15)',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            {analysis.breaking_changes.map((bc, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                <span style={{ color: '#b08080' }}>•</span>
                <span>{bc}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(0, 230, 118, 0.08)',
            border: '1px solid rgba(0, 230, 118, 0.15)',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            color: '#7aaa8a',
            fontFamily: "'JetBrains Mono', monospace"
          }}>
            <CheckCircle2 size={12} /> No breaking changes detected.
          </div>
        )}
      </div>

      {/* Test Recommendations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Verification & Testing Recommendations
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {analysis.test_recommendations.map((rec, idx) => (
            <div key={idx} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                  width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {idx + 1}
                </span>
                <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.4, paddingTop: 1 }}>
                  {rec}
                </p>
              </div>

              <button
                className="btn"
                disabled={addedNotes[idx]}
                onClick={() => handleAddToNotebook(rec, idx)}
                style={{
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  borderColor: addedNotes[idx] ? '#7aaa8a' : 'var(--border-bright)',
                  color: addedNotes[idx] ? '#7aaa8a' : 'var(--accent)'
                }}
              >
                <Plus size={11} /> {addedNotes[idx] ? 'Logged' : 'Add to Notebook'}
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
