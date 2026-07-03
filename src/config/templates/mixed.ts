export const mixedTemplates = [
  {
    id: 'sallen-key-filter',
    name: 'Sallen-Key Active Low-Pass Filter',
    tagline: 'A second-order active low-pass analog filter utilizing an op-amp.',
    category: 'Mixed & Analog',
    difficulty: 'intermediate',
    estimatedHours: 4,
    tags: ['Analog', 'Filter', 'Op-Amp', 'Sallen-Key', 'Active Filter'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="40" x2="260" y2="40" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="20" y1="80" x2="260" y2="80" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="20" y1="120" x2="260" y2="120" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="80" y1="30" x2="80" y2="130" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="160" y1="30" x2="160" y2="130" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="240" y1="30" x2="240" y2="130" stroke="#1a1a2e" stroke-width="0.5"/>
  <path d="M20,40 L100,40 C130,40 150,80 180,105 L260,120" stroke="#6b6d85" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="130" y1="26" x2="130" y2="130" stroke="#6b6d85" stroke-width="1" stroke-dasharray="3 3"/>
  <circle cx="130" cy="58" r="3" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'Second-order active analog filter designed to eliminate high-frequency noise from analog sensor signals before feeding into an ADC input.',
      tags: ['ActiveFilter', 'OpAmp', 'SallenKey', 'AnalogFrontEnd']
    },
    parameterPlayground: {
      description: 'Tune resistances and capacitances to calculate cutoff frequencies.',
      parameters: [
        { name: 'r1_k', label: 'Resistor R1', min: 1, max: 100, default: 10, unit: 'kΩ' },
        { name: 'r2_k', label: 'Resistor R2', min: 1, max: 100, default: 10, unit: 'kΩ' },
        { name: 'c1_nf', label: 'Capacitor C1', min: 0.1, max: 1000, default: 10, unit: 'nF' },
        { name: 'c2_nf', label: 'Capacitor C2', min: 0.1, max: 1000, default: 4.7, unit: 'nF' }
      ],
      equations: [
        { outputName: 'cutoff_hz', label: 'Cutoff Frequency (fc)', formula_js: '1 / (2 * Math.PI * Math.sqrt(r1_k * 1000 * r2_k * 1000 * c1_nf * 1e-9 * c2_nf * 1e-9))', unit: 'Hz' },
        { outputName: 'q_factor', label: 'Quality Factor (Q)', formula_js: 'Math.sqrt(r1_k * r2_k * c1_nf * c2_nf) / (c2_nf * (r1_k + r2_k))', unit: '' }
      ]
    },
    starterCode: {
      language: 'text',
      filename: 'sallen_key_netlist.cir',
      content: `* Sallen-Key Active Low-Pass Filter SPICE Simulation
Vcc Vcc 0 DC 15
Vee Vee 0 DC -15
Vin In 0 AC 1 SINE(0 1 1000)

R1 In Node1 10k
R2 Node1 Node2 10k
C1 Node1 Out 10nF
C2 Node2 0 4.7nF

* Operational Amplifier (Idealized VCVS)
Xop Node2 Out Vcc Vee Out opamp_model

.ac dec 20 10 100k
.plot ac v(Out) db(v(Out))
.end`
    },
    bomStarter: [
      { quantity: 1, description: 'Low-Noise Precision Op-Amp', value: 'NE5532', package: 'DIP-8', notes: 'Dual op-amp IC' },
      { quantity: 2, description: 'Metal Film Resistors 10k 1%', value: '10kΩ', package: '0805', notes: 'Matched values' },
      { quantity: 1, description: 'Ceramic Capacitor 10nF 50V', value: '10nF C1', package: '0603', notes: 'NP0/C0G low-drift' },
      { quantity: 1, description: 'Ceramic Capacitor 4.7nF 50V', value: '4.7nF C2', package: '0603', notes: 'NP0/C0G low-drift' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Capacitor Dielectric Grade', content: 'Selected NP0/C0G grade ceramic capacitors for the filter network to prevent thermal drifting of the cutoff frequency.' }
    ],
    resources: [
      { title: 'Active Filter Design Application Report', url: 'https://www.ti.com/lit/an/sloa049b/sloa049b.pdf', type: 'reference' }
    ]
  },
  {
    id: 'cc-pwm-led-driver',
    name: 'Constant Current PWM LED Driver',
    tagline: 'High-power LED constant current driver with PWM dimming control.',
    category: 'Mixed & Analog',
    difficulty: 'intermediate',
    estimatedHours: 4,
    tags: ['LED Driver', 'Constant Current', 'PWM', 'MOSFET', 'Analog'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="80" x2="50" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="50" y1="50" x2="50" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="50" y1="50" x2="90" y2="50" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="90" y1="50" x2="90" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="90" y1="110" x2="130" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="130" y1="50" x2="130" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="130" y1="50" x2="170" y2="50" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="170" y1="50" x2="170" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="170" y1="80" x2="210" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="240" cy="80" r="22" fill="#1a1a2e" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="228" y1="68" x2="252" y2="92" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="228" y1="92" x2="252" y2="68" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
    projectContext: {
      description: 'Active linear constant current regulator with feedback amplifier and high-power MOSFET. Includes a secondary PWM gate to handle microcontroller-based dimming.',
      tags: ['ConstantCurrent', 'LEDDriver', 'PWMDimming', 'ActiveFeedback']
    },
    parameterPlayground: {
      description: 'Optimize current limit resistors and power losses.',
      parameters: [
        { name: 'v_ref_v', label: 'Reference Voltage (Vref)', min: 0.1, max: 2.5, default: 0.8, unit: 'V' },
        { name: 'r_sense_ohms', label: 'Sense Resistor Rsense', min: 0.2, max: 10.0, default: 2.2, unit: 'Ω' },
        { name: 'v_supply_v', label: 'Input Supply Voltage', min: 5.0, max: 24.0, default: 12.0, unit: 'V' }
      ],
      equations: [
        { outputName: 'led_current_ma', label: 'Target LED Current', formula_js: '(v_ref_v / r_sense_ohms) * 1000', unit: 'mA' },
        { outputName: 'sense_power_w', label: 'Sense Resistor Power Loss', formula_js: 'Math.pow(v_ref_v / r_sense_ohms, 2) * r_sense_ohms', unit: 'W' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'led_dimmer.ino',
      content: `// PWM LED Constant Current Dimmer Controller
const int PWM_PIN = 9; // Connected to driver dimming input

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("LED Dimmer Initialized.");
}

void loop() {
  // Fade in
  for (int duty = 0; duty <= 255; duty++) {
    analogWrite(PWM_PIN, duty);
    delay(10);
  }

  delay(1000);

  // Fade out
  for (int duty = 255; duty >= 0; duty--) {
    analogWrite(PWM_PIN, duty);
    delay(10);
  }

  delay(1000);
}`
    },
    bomStarter: [
      { quantity: 1, description: 'Power N-Channel MOSFET', value: 'IRF540N', package: 'TO-220', notes: 'Controls LED current loop' },
      { quantity: 1, description: 'Operational Amplifier', value: 'LM358', package: 'DIP-8', notes: 'Feedback loop controller' },
      { quantity: 1, description: 'Precision Shunt Sense Resistor', value: '2.2Ω 1W', package: '2512', notes: 'Senses LED string current' },
      { quantity: 1, description: 'High-Power LED Bead (3W)', value: 'White 3.2V 700mA', package: 'Star-PCB', notes: 'Output light load' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Sense Resistor Power Rating', content: 'Rsense power dissipation is ~300mW. Chose a 1W rated 2512 resistor to keep component heating low and prevent thermal resistance shift.' }
    ],
    resources: [
      { title: 'Linear Constant Current LED Driver App Note', url: 'https://www.microchip.com/downloads/en/appnotes/01365a.pdf', type: 'reference' }
    ]
  }
];
