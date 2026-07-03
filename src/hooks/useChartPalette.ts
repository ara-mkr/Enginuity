import { useEffect, useState } from 'react'

// Documented fallbacks — kept in sync with the --chart-trace-* declarations
// in index.css. Used when a variable is missing (e.g. tests without the
// stylesheet loaded).
const FALLBACK_TRACE_COLORS = ['#7ab4c4', '#b08080', '#9485b8', '#7aaa8a', '#b09470', '#b07888']

function resolveTraceColors(): string[] {
  const styles = getComputedStyle(document.documentElement)
  return FALLBACK_TRACE_COLORS.map((fallback, i) => {
    const v = styles.getPropertyValue(`--chart-trace-${i + 1}`).trim()
    return v || fallback
  })
}

/**
 * Chart trace colors resolved from the --chart-trace-* CSS variables.
 *
 * Recharts writes stroke as an SVG presentation attribute, which can't
 * resolve var(), so the variables are resolved to concrete values here and
 * re-resolved whenever the UI settings theme rewrites the root inline style.
 */
export function useChartPalette(): string[] {
  const [colors, setColors] = useState(resolveTraceColors)

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(resolveTraceColors()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
    return () => observer.disconnect()
  }, [])

  return colors
}
