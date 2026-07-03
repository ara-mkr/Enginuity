import type { BOMItem } from './types'

function generateUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Parses raw text content of a .kicad_pcb file and groups/deduplicates footprints to return a BOMItem list.
 */
export function parseKiCadPCBText(text: string): Omit<BOMItem, 'unitPrice' | 'extendedPrice' | 'stockStatus' | 'leadTimeWeeks' | 'altAvailable'>[] {
  // KiCad PCB files contain (footprint "..." (at ...) (property "Reference" "..." ...) (property "Value" "..." ...))
  // Or in v5: (module ... (fp_text reference "..." ...) (fp_text value "..." ...))
  const footprints = text.split(/\((?:footprint|module)\s+/)
  const rawItems: Array<{ ref: string; value: string; package: string }> = []

  // Skip the first element since it's the header block before any footprints
  for (let i = 1; i < footprints.length; i++) {
    const block = footprints[i]

    // 1. Footprint Package name (first quoted string in the footprint block, e.g. "Resistor_SMD:R_0603_1608Metric")
    const pkgMatch = block.match(/^"([^"]+)"/)
    let pkg = pkgMatch ? pkgMatch[1] : ''
    // Strip library prefix if present
    if (pkg.includes(':')) {
      pkg = pkg.split(':').pop() || pkg
    }

    // 2. Reference Designator
    // v6+ property Reference: (property "Reference" "R1" ...)
    // v5 fp_text reference: (fp_text reference "R1" ...)
    const refMatch = block.match(/\(property\s+"?Reference"?\s+"([^"]+)"/) ||
                     block.match(/\(fp_text\s+reference\s+"([^"]+)"/)
    if (!refMatch) continue // Skip graphic footprints (logos, mounting holes with no ref)
    const ref = refMatch[1]

    // Skip graphic/text elements or fiducials
    if (/^REF\*\*|^G\d+|^FID\d+|^MK\d+/i.test(ref)) continue

    // 3. Value
    // v6+ property Value: (property "Value" "10k" ...)
    // v5 fp_text value: (fp_text value "10k" ...)
    const valMatch = block.match(/\(property\s+"?Value"?\s+"([^"]+)"/) ||
                     block.match(/\(fp_text\s+value\s+"([^"]+)"/)
    const value = valMatch ? valMatch[1] : 'Unknown'

    rawItems.push({
      ref,
      value,
      package: pkg,
    })
  }

  // Group components by Value + Package to build standard BOM structure
  const grouped: Record<string, Omit<BOMItem, 'id' | 'unitPrice' | 'extendedPrice' | 'stockStatus' | 'leadTimeWeeks' | 'altAvailable'>> = {}

  for (const item of rawItems) {
    const key = `${item.value.toUpperCase()}::${item.package.toUpperCase()}`
    if (!grouped[key]) {
      grouped[key] = {
        quantity: 0,
        part_number: item.value, // Treat value as temporary MPN
        description: `${item.value} in ${item.package || 'Unknown'} package`,
        manufacturer: null,
        value: item.value,
        package: item.package || null,
        reference_designators: '',
      }
    }
    grouped[key].quantity += 1
    const currentRefs = grouped[key].reference_designators
      ? grouped[key].reference_designators!.split(', ')
      : []
    currentRefs.push(item.ref)
    // Sort refs naturally
    currentRefs.sort((a, b) => {
      const aMatch = a.match(/^([A-Za-z]+)(\d+)$/)
      const bMatch = b.match(/^([A-Za-z]+)(\d+)$/)
      if (aMatch && bMatch) {
        if (aMatch[1] !== bMatch[1]) return aMatch[1].localeCompare(bMatch[1])
        return parseInt(aMatch[2]) - parseInt(bMatch[2])
      }
      return a.localeCompare(b)
    })
    grouped[key].reference_designators = currentRefs.join(', ')
  }

  return Object.values(grouped).map((item) => ({
    ...item,
    id: generateUUID(),
  }))
}

/**
 * Parses raw text content of a KiCad XML BOM file and returns structured BOMItems.
 */
export function parseKiCadXMLText(text: string): Omit<BOMItem, 'unitPrice' | 'extendedPrice' | 'stockStatus' | 'leadTimeWeeks' | 'altAvailable'>[] {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(text, 'application/xml')
    const comps = xmlDoc.querySelectorAll('comp')
    const rawItems: Array<{ ref: string; value: string; package: string; manufacturer: string | null; partNumber: string | null }> = []

    comps.forEach((comp) => {
      const ref = comp.getAttribute('ref') || ''
      const value = comp.querySelector('value')?.textContent || 'Unknown'
      const fpRaw = comp.querySelector('footprint')?.textContent || ''
      const fp = fpRaw.split(':').pop() || fpRaw

      let manufacturer: string | null = null
      let partNumber: string | null = null

      const fields = comp.querySelectorAll('fields field')
      fields.forEach((field) => {
        const name = field.getAttribute('name')?.toLowerCase() || ''
        if (name.includes('manufacturer') || name === 'mfr') {
          manufacturer = field.textContent
        }
        if (name.includes('partnumber') || name === 'mpn' || name.includes('part number')) {
          partNumber = field.textContent
        }
      })

      rawItems.push({
        ref,
        value,
        package: fp,
        manufacturer,
        partNumber: partNumber || value, // Fallback to value if no MPN
      })
    })

    // Group items
    const grouped: Record<string, Omit<BOMItem, 'id' | 'unitPrice' | 'extendedPrice' | 'stockStatus' | 'leadTimeWeeks' | 'altAvailable'>> = {}

    for (const item of rawItems) {
      const key = `${(item.partNumber || item.value).toUpperCase()}::${item.package.toUpperCase()}`
      if (!grouped[key]) {
        grouped[key] = {
          quantity: 0,
          part_number: item.partNumber,
          description: `${item.value} component`,
          manufacturer: item.manufacturer,
          value: item.value,
          package: item.package || null,
          reference_designators: '',
        }
      }
      grouped[key].quantity += 1
      const currentRefs = grouped[key].reference_designators
        ? grouped[key].reference_designators!.split(', ')
        : []
      currentRefs.push(item.ref)
      currentRefs.sort((a, b) => {
        const aMatch = a.match(/^([A-Za-z]+)(\d+)$/)
        const bMatch = b.match(/^([A-Za-z]+)(\d+)$/)
        if (aMatch && bMatch) {
          if (aMatch[1] !== bMatch[1]) return aMatch[1].localeCompare(bMatch[1])
          return parseInt(aMatch[2]) - parseInt(bMatch[2])
        }
        return a.localeCompare(b)
      })
      grouped[key].reference_designators = currentRefs.join(', ')
    }

    return Object.values(grouped).map((item) => ({
      ...item,
      id: generateUUID(),
    }))
  } catch (err) {
    console.error('Failed to parse KiCad XML', err)
    return []
  }
}
