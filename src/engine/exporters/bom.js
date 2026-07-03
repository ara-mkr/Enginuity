export function toMarkdown(items) {
  let md = `# Bill of Materials\n\n`
  md += `| Part ID | Description | Supplier / Part # | Qty | Unit Price | Total Price | Stock Status |\n`
  md += `|---------|-------------|-------------------|-----|------------|-------------|--------------|\n`
  
  items.forEach(i => {
    const total = (i.quantity ?? 1) * (i.unitPrice ?? 0)
    md += `| ${i.partId || i.id} | ${i.description} | ${i.supplier || ''} / ${i.supplierPartNumber || ''} | ${i.quantity} | $${(i.unitPrice ?? 0).toFixed(2)} | $${total.toFixed(2)} | ${i.stockStatus || 'unknown'} |\n`
  })

  return md
}

export function toCSV(items) {
  let csv = `"Part ID","Description","Supplier","Supplier Part Number","Qty","Unit Price","Total Price","Status"\n`
  items.forEach(i => {
    const total = (i.quantity ?? 1) * (i.unitPrice ?? 0)
    csv += `"${i.partId || i.id}","${i.description}","${i.supplier || ''}","${i.supplierPartNumber || ''}",${i.quantity},${i.unitPrice ?? 0},${total},"${i.stockStatus || ''}"\n`
  })
  return csv
}

export function toOrderCSV(items) {
  // Mouser/Digikey standard format: PartNumber,Qty
  let csv = `"Manufacturer Part Number","Quantity"\n`
  items.forEach(i => {
    csv += `"${i.supplierPartNumber || i.partId || i.id}",${i.quantity}\n`
  })
  return csv
}

export function toExcel(items) {
  // Return standard CSV representation for Excel compatibility
  return toCSV(items)
}

export function toHTML(items) {
  const totalCost = items.reduce((sum, i) => sum + (i.quantity ?? 1) * (i.unitPrice ?? 0), 0)
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bill of Materials</title>
  <style>
    body { font-family: sans-serif; background: #080810; color: #e2e4f0; padding: 30px; }
    .card { background: #13131f; border: 1px solid #1f1f35; border-radius: 8px; padding: 24px; max-width: 900px; margin: 0 auto; }
    h1 { color: #00c8ff; font-family: monospace; border-bottom: 1px solid #1f1f35; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #1f1f35; padding: 10px; text-align: left; font-size: 13px; }
    th { background: #1a1a2e; }
    .status-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
    .instock { background: rgba(0,230,118,0.15); color: #00e676; }
    .outofstock { background: rgba(255,107,107,0.15); color: #ff6b6b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Bill of Materials</h1>
    <table>
      <thead>
        <tr>
          <th>Part ID</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(i => {
          const total = (i.quantity ?? 1) * (i.unitPrice ?? 0)
          const isInstock = i.stockStatus === 'in_stock' || i.stockStatus === 'In Stock'
          return `
            <tr>
              <td><strong>${i.partId || i.id}</strong></td>
              <td>${i.description}</td>
              <td>${i.quantity}</td>
              <td>$${(i.unitPrice ?? 0).toFixed(2)}</td>
              <td>$${total.toFixed(2)}</td>
              <td><span class="status-badge ${isInstock ? 'instock' : 'outofstock'}">${i.stockStatus || 'unknown'}</span></td>
            </tr>
          `
        }).join('')}
      </tbody>
    </table>
    <h3 style="text-align:right;margin-top:20px;">Total Project Cost: $${totalCost.toFixed(2)}</h3>
  </div>
</body>
</html>`
}
