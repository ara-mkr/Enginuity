export function toMarkdown(schema, values, outputs) {
  let md = `# Parameter Playground Export\n\n`
  
  md += `## Input Parameters\n\n`
  md += `| Parameter | Symbol | Value | Unit | Range |\n`
  md += `|-----------|--------|-------|------|-------|\n`
  schema.parameters.forEach(p => {
    md += `| ${p.label} | \`${p.name}\` | ${values[p.name] ?? p.default} | ${p.unit} | ${p.min} - ${p.max} |\n`
  })

  md += `\n## Computed Equations\n\n`
  md += `| Output | Label | Formula | Current Value | Unit |\n`
  md += `|--------|-------|---------|---------------|------|\n`
  schema.equations.forEach(eq => {
    md += `| \`${eq.outputName}\` | ${eq.label} | \`${eq.formula || eq.formula_js}\` | ${outputs[eq.outputName] ?? '—'} | ${eq.unit} |\n`
  })

  return md
}

export function toJSON(schema, values, sweep) {
  return JSON.stringify({ schema, values, sweep }, null, 2)
}

export function toShareURL(schema, values, sweep) {
  const payload = JSON.stringify({ schema, values, sweep })
  // Access global LZString loaded from CDN or fall back to basic base64 encoding
  const compressor = window.LZString
  const compressed = compressor ? compressor.compressToBase64(payload) : btoa(encodeURIComponent(payload))
  return `${window.location.origin}/parameter-playground?share=${encodeURIComponent(compressed)}`
}

export function toHTML(schema, values) {
  const paramsJSON = JSON.stringify(schema.parameters)
  const equationsJSON = JSON.stringify(schema.equations)
  const valuesJSON = JSON.stringify(values)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Interactive Simulator</title>
  <style>
    body { font-family: monospace; background: #080810; color: #e2e4f0; padding: 30px; }
    .card { background: #13131f; border: 1px solid #1f1f35; border-radius: 8px; padding: 20px; max-width: 600px; margin: 0 auto; }
    h2 { border-bottom: 1px solid #1f1f35; padding-bottom: 8px; color: #00c8ff; }
    .row { display: flex; flex-direction: column; margin-bottom: 12px; }
    .slider-header { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
    input[type=range] { width: 100%; accent-color: #00c8ff; }
    .readouts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
    .readout-card { background: #1a1a2e; border: 1px solid #1f1f35; padding: 12px; border-radius: 6px; }
    .readout-val { font-size: 20px; font-weight: bold; color: #00c8ff; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Interactive Workbench</h2>
    <div id="sliders"></div>
    <div class="readouts" id="readouts"></div>
  </div>

  <script>
    const parameters = ${paramsJSON};
    const equations = ${equationsJSON};
    const currentValues = ${valuesJSON};

    function evaluateEquations() {
      const scope = {};
      parameters.forEach(p => {
        scope[p.name] = currentValues[p.name];
      });

      // Solve equations sequentially
      equations.forEach(eq => {
        try {
          // simple clean for evaluator js
          const cleanFormula = (eq.formula_js || eq.formula)
            .replace(/Math\\./g, 'Math.');
          
          // Evaluate in scope context
          const func = new Function(...Object.keys(scope), 'return ' + cleanFormula);
          const val = func(...Object.values(scope));
          scope[eq.outputName] = val;
          
          const el = document.getElementById('val-' + eq.outputName);
          if (el) el.innerText = typeof val === 'number' ? val.toFixed(4) : val;
        } catch (e) {
          console.error(e);
        }
      });
    }

    const slidersContainer = document.getElementById('sliders');
    parameters.forEach(p => {
      const val = currentValues[p.name] !== undefined ? currentValues[p.name] : p.default;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = \`
        <div class="slider-header">
          <span>\${p.label}</span>
          <span id="label-\${p.name}">\${val} \${p.unit}</span>
        </div>
        <input type="range" id="slider-\${p.name}" min="\${p.min}" max="\${p.max}" step="\${(p.max - p.min) / 100}" value="\${val}" />
      \`;
      slidersContainer.appendChild(row);

      const slider = document.getElementById('slider-' + p.name);
      slider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        currentValues[p.name] = v;
        document.getElementById('label-' + p.name).innerText = v + ' ' + p.unit;
        evaluateEquations();
      });
    });

    const readoutsContainer = document.getElementById('readouts');
    equations.forEach(eq => {
      const card = document.createElement('div');
      card.className = 'readout-card';
      card.innerHTML = \`
        <div style="font-size:11px;color:#6b6d85;">\${eq.label}</div>
        <div class="readout-val" id="val-\${eq.outputName}">—</div>
        <div style="font-size:10px;color:#6b6d85;">\${eq.unit}</div>
      \`;
      readoutsContainer.appendChild(card);
    });

    evaluateEquations();
  </script>
</body>
</html>`
}
