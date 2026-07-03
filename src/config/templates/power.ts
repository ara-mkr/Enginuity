export const powerTemplates = [
  {
    id: 'buck-converter',
    name: 'Buck Converter (Synchronous)',
    tagline: 'A synchronous buck DC-DC converter with high-efficiency MOSFET switching.',
    category: 'Power',
    difficulty: 'advanced',
    estimatedHours: 8,
    tags: ['Buck Converter', 'Power', 'MOSFET', 'DC-DC', 'Efficiency'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="80" x2="88" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="88" y1="58" x2="88" y2="102" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="88" y1="102" x2="110" y2="58" stroke="#6b6d85" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="110" y1="80" x2="128" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <path d="M128,80 C128,63 142,63 142,80 C142,63 156,63 156,80 C156,63 170,63 170,80" stroke="#94a3b8" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <line x1="170" y1="80" x2="260" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="224" y1="80" x2="224" y2="114" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="204" y1="114" x2="244" y2="114" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="210" y1="120" x2="238" y2="120" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="216" y1="126" x2="232" y2="126" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="224" cy="80" r="2.5" fill="#6b6d85"/>
  <circle cx="170" cy="80" r="3" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'Synchronous step-down DC-DC converter designed to efficiently reduce high voltages (e.g. 12V-24V) to low voltages (e.g. 5V or 3.3V) for microcontrollers and auxiliary boards.',
      tags: ['BuckConverter', 'DCDC', 'MOSFET', 'GateDriver', 'PowerDesign']
    },
    parameterPlayground: {
      description: 'Optimize inductor ripple, capacitor sizing, and duty cycle limits.',
      parameters: [
        { name: 'vin', label: 'Input Voltage Vin', min: 7, max: 36, default: 12, unit: 'V' },
        { name: 'vout', label: 'Output Voltage Vout', min: 1.2, max: 5, default: 3.3, unit: 'V' },
        { name: 'iout', label: 'Output Current Iout', min: 0.1, max: 10, default: 3, unit: 'A' },
        { name: 'fsw_khz', label: 'Switching Frequency', min: 100, max: 1000, default: 300, unit: 'kHz' }
      ],
      equations: [
        { outputName: 'duty_cycle', label: 'Duty Cycle', formula_js: 'vout / vin', unit: '' },
        { outputName: 'l_min_uh', label: 'Minimum Inductance', formula_js: '((vin - vout) * (vout / vin)) / (0.3 * iout * fsw_khz * 1000) * 1000000', unit: 'µH' }
      ]
    },
    starterCode: null,
    bomStarter: [
      { quantity: 2, description: 'Power N-Channel MOSFET', value: 'IRFH5300', package: 'PQFN-8', notes: 'High & Low side switch' },
      { quantity: 1, description: 'Synchronous buck gate driver', value: 'LM5106', package: 'MSOP-10', notes: 'Complementary gate drive with deadtime control' },
      { quantity: 1, description: 'Shielded Power Inductor', value: '10µH 5.5A', package: 'SMD-10x10', notes: 'Energy storage inductor' },
      { quantity: 2, description: 'Low-ESR Aluminum Caps', value: '220µF 35V', package: 'Radial-SMD', notes: 'Input and output ripple filters' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Inductor Core Selection', content: 'Chose a ferrite core inductor over powdered iron to minimize high-frequency core losses at our target 300kHz switching speed.' }
    ],
    resources: [
      { title: 'LM5106 Gate Driver Datasheet', url: 'https://www.ti.com/lit/ds/symlink/lm5106.pdf', type: 'datasheet' }
    ]
  },
  {
    id: 'li-ion-charger-cccv',
    name: 'Li-Ion Battery Charger (CC/CV)',
    tagline: 'Standard Constant Current / Constant Voltage charger design for safe single-cell charging.',
    category: 'Power',
    difficulty: 'beginner',
    estimatedHours: 3,
    tags: ['Li-Ion', 'Charger', 'CC/CV', 'Battery', 'TP4056'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="80" x2="68" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="68" y="50" width="144" height="60" rx="4" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="212" y="64" width="16" height="32" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="74" y="56" width="72" height="48" rx="2" fill="#94a3b8"/>
  <line x1="110" y1="50" x2="110" y2="110" stroke="#1a1a2e" stroke-width="1.5"/>
  <line x1="146" y1="50" x2="146" y2="110" stroke="#1a1a2e" stroke-width="1.5"/>
  <line x1="182" y1="50" x2="182" y2="110" stroke="#1a1a2e" stroke-width="1.5"/>
</svg>`,
    projectContext: {
      description: 'Single-cell 3.7V Lithium-Ion battery charger circuit employing a dedicated charger controller IC configured to provide constant current charging tapering into constant voltage mode.',
      tags: ['LiIon', 'TP4056', 'CC-CV', 'BatteryCharger']
    },
    parameterPlayground: {
      description: 'Adjust programming resistor values and monitor charging currents.',
      parameters: [
        { name: 'r_prog_ohms', label: 'Prog Resistor Rprog', min: 1000, max: 10000, default: 1200, unit: 'Ω' }
      ],
      equations: [
        { outputName: 'charge_current_ma', label: 'Constant Charge Current', formula_js: '1200 / r_prog_ohms * 1000', unit: 'mA' }
      ]
    },
    starterCode: null,
    bomStarter: [
      { quantity: 1, description: 'Standalone Linear Li-Ion Charger IC', value: 'TP4056', package: 'SOP-8-EP', notes: 'CC/CV controller' },
      { quantity: 1, description: 'Metal Film Prog Resistor', value: '1.2kΩ 1%', package: '0603', notes: 'Sets charging current to 1A' },
      { quantity: 1, description: 'NTC Thermistor', value: '10kΩ', package: '0805', notes: 'Thermal protection monitoring' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Set maximum charge rate to 1A', content: 'Selected Rprog = 1.2k to limit standard charge current to 1000mA, protecting single cells from thermal damage.' }
    ],
    resources: [
      { title: 'TP4056 Datasheet', url: 'https://dlnmh9ip6v2uc.cloudfront.net/datasheets/Prototyping/TP4056.pdf', type: 'datasheet' }
    ]
  },
  {
    id: 'three-phase-inverter',
    name: '3-Phase Inverter (BLDC Drive)',
    tagline: 'High-power 3-phase MOSFET bridge inverter for brushless DC motor drives.',
    category: 'Power',
    difficulty: 'expert',
    estimatedHours: 16,
    tags: ['Inverter', 'BLDC', '3-Phase', 'MOSFET Bridge', 'Gate Driver'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="32" x2="260" y2="32" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="128" x2="260" y2="128" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="52" y="44" width="40" height="32" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="52" y="84" width="40" height="32" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="120" y="44" width="40" height="32" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="120" y="84" width="40" height="32" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="188" y="44" width="40" height="32" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="188" y="84" width="40" height="32" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="72" y1="32" x2="72" y2="44" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="72" y1="116" x2="72" y2="128" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="140" y1="32" x2="140" y2="44" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="140" y1="116" x2="140" y2="128" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="208" y1="32" x2="208" y2="44" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="208" y1="116" x2="208" y2="128" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="72" y1="76" x2="72" y2="84" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="208" y1="76" x2="208" y2="84" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="140" y1="76" x2="140" y2="84" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="140" cy="80" r="3" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'A 6-MOSFET inverter bridge layout designed to synthesize 3-phase AC voltage patterns to spin brushless motors. Includes high-frequency bypass grids and phase voltage feedback rails.',
      tags: ['Inverter', 'BLDC', 'HalfBridge', 'HighPower', 'GateDriver']
    },
    parameterPlayground: {
      description: 'Optimize supply voltages and switching frequencies to verify motor speed and core temperatures.',
      parameters: [
        { name: 'v_bus', label: 'DC Bus Voltage', min: 12, max: 48, default: 24, unit: 'V' },
        { name: 'motor_kv', label: 'Motor KV Rating', min: 100, max: 2000, default: 850, unit: 'RPM/V' },
        { name: 'pole_pairs', label: 'Motor Pole Pairs', min: 2, max: 14, default: 7, unit: '' }
      ],
      equations: [
        { outputName: 'no_load_rpm', label: 'No-load Speed', formula_js: 'v_bus * motor_kv', unit: 'rpm' },
        { outputName: 'elec_freq_hz', label: 'Electrical Frequency', formula_js: '(v_bus * motor_kv / 60) * pole_pairs', unit: 'Hz' }
      ]
    },
    starterCode: null,
    bomStarter: [
      { quantity: 6, description: 'N-Channel Power Trench MOSFET', value: 'FDMS86101', package: 'Power56', notes: 'Inverter bridge switches' },
      { quantity: 3, description: 'High/Low Gate Driver IC', value: 'FAN73892', package: 'SOP-28', notes: 'Integrated 3-phase gate drive' },
      { quantity: 3, description: 'Ceramic Bulk Decoupling Caps', value: '10µF 100V', package: '1210', notes: 'High-frequency bus stabilization' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'High-Side Gate Resistors Value', content: 'Settled on 10Ω gate resistors to slow down MOSFET turn-on speeds slightly, preventing switching ringing while keeping dissipation low.' }
    ],
    resources: [
      { title: 'FAN73892 3-Phase Gate Driver', url: 'https://www.onsemi.com/pdf/datasheet/fan73892-d.pdf', type: 'datasheet' }
    ]
  }
]
