export const rfTemplates = [
  {
    id: 'lora-iot-node',
    name: 'LoRa Long-Range IoT Node',
    tagline: 'A low-power long-range transmitter node using the RFM95W LoRa module.',
    category: 'RF & Networking',
    difficulty: 'intermediate',
    estimatedHours: 6,
    tags: ['LoRa', 'RF', 'SPI', 'Long Range', 'Wireless'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="140" y1="130" x2="140" y2="50" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="100" y1="130" x2="180" y2="130" stroke="#6b6d85" stroke-width="1.5"/>
  <path d="M108,100 C120,88 160,88 172,100" stroke="#6b6d85" stroke-width="1.5" fill="none"/>
  <path d="M84,112 C104,92 176,92 196,112" stroke="#6b6d85" stroke-width="1.5" fill="none"/>
  <path d="M60,124 C88,96 192,96 220,124" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
  <circle cx="140" cy="50" r="3" fill="#6b6d85"/>
</svg>`,
    projectContext: {
      description: 'SPI-based wireless telemetry node running LoRa modulation protocol to send data payloads over kilometers using sub-GHz frequencies.',
      tags: ['LoRa', 'RFM95W', 'WirelessTelemetry', 'SubGHz']
    },
    parameterPlayground: {
      description: 'Tune transmit power and distance to model link margins.',
      parameters: [
        { name: 'tx_power_dbm', label: 'Transmit Power', min: 2, max: 20, default: 13, unit: 'dBm' },
        { name: 'distance_km', label: 'Distance', min: 0.1, max: 20, default: 2.5, unit: 'km' },
        { name: 'freq_mhz', label: 'Frequency Band', min: 433, max: 915, default: 915, unit: 'MHz' }
      ],
      equations: [
        { outputName: 'fspl_db', label: 'Path Loss (FSPL)', formula_js: '20 * Math.log10(distance_km) + 20 * Math.log10(freq_mhz) + 32.44', unit: 'dB' },
        { outputName: 'rx_power_dbm', label: 'Estimated Rx Power', formula_js: 'tx_power_dbm - (20 * Math.log10(distance_km) + 20 * Math.log10(freq_mhz) + 32.44)', unit: 'dBm' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'lora_tx.ino',
      content: `// LoRa Transmitter Node (RFM95W)
#include <SPI.h>
#include <RH_RF95.h>

#define RFM95_CS  10
#define RFM95_RST 9
#define RFM95_INT 2

RH_RF95 rf95(RFM95_CS, RFM95_RST);

void setup() {
  pinMode(RFM95_RST, OUTPUT);
  digitalWrite(RFM95_RST, HIGH);
  Serial.begin(115200);
  delay(100);

  // Manual reset
  digitalWrite(RFM95_RST, LOW);
  delay(10);
  digitalWrite(RFM95_RST, HIGH);
  delay(10);

  if (!rf95.init()) {
    Serial.println("LoRa radio init failed");
    while (1);
  }

  // Set frequency
  if (!rf95.setFrequency(915.0)) {
    Serial.println("setFrequency failed");
    while (1);
  }

  // Set Tx Power (max 23 dBm)
  rf95.setTxPower(13, false);
  Serial.println("LoRa transmitter initialized.");
}

void loop() {
  Serial.println("Sending packet...");
  uint8_t data[] = "Hello World!";
  rf95.send(data, sizeof(data));
  rf95.waitPacketSent();

  delay(5000); // Send payload every 5 seconds
}`
    },
    bomStarter: [
      { quantity: 1, description: 'Adafruit RFM95W LoRa Transceiver Breakout', value: '915 MHz RFM95', package: 'Module', notes: 'SPI interface' },
      { quantity: 1, description: '915MHz Whip Antenna with SMA connector', value: '50 Ohm SMA', package: 'Antenna', notes: 'RF matching load' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Carrier Frequency Selection', content: 'Chose the 915MHz band to comply with US FCC regulations for unlicensed ISM bands, avoiding 868MHz which is European standard.' }
    ],
    resources: [
      { title: 'RFM95W LoRa Module Datasheet', url: 'https://cdn-shop.adafruit.com/datasheets/RFM95W-V2.0.pdf', type: 'datasheet' }
    ]
  },
  {
    id: 'pcb-antenna-24',
    name: '2.4GHz PCB Trace Antenna',
    tagline: 'A resonant quarter-wave inverted-F PCB microstrip antenna solver.',
    category: 'RF & Networking',
    difficulty: 'advanced',
    estimatedHours: 8,
    tags: ['Antenna', 'PCB', 'Microstrip', '2.4GHz', 'RF Design'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="130" x2="260" y2="130" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="110" x2="20" y2="130" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="110" x2="220" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="220" y1="30" x2="220" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="100" y1="110" x2="100" y2="130" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="220" y1="30" x2="260" y2="30" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="260" cy="30" r="3" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'Laying out an inverted-F trace antenna directly onto an FR4 PCB. Solves resonant lengths and line widths for 50 Ohm matching.',
      tags: ['InvertedFAntenna', 'PCBLayout', 'RFMatching', 'FR4Substrate']
    },
    parameterPlayground: {
      description: 'Optimize substrate dielectric constant and trace dimensions.',
      parameters: [
        { name: 'substrate_er', label: 'FR4 Dielectric Const (εr)', min: 3.5, max: 4.8, default: 4.4, unit: '' },
        { name: 'substrate_h_mm', label: 'Substrate Height (h)', min: 0.2, max: 2.4, default: 1.6, unit: 'mm' },
        { name: 'freq_mhz', label: 'Center Frequency', min: 2000, max: 6000, default: 2450, unit: 'MHz' }
      ],
      equations: [
        { outputName: 'wavelength_free_mm', label: 'Free Space Wavelength', formula_js: '299792 / freq_mhz', unit: 'mm' },
        { outputName: 'eff_dielectric', label: 'Effective Dielectric', formula_js: '(substrate_er + 1)/2 + ((substrate_er - 1)/2) * Math.pow(1 + 12 * (substrate_h_mm / 3), -0.5)', unit: '' },
        { outputName: 'quarter_wave_len_mm', label: 'Resonant Trace Length', formula_js: '(299792 / freq_mhz) / (4 * Math.sqrt((substrate_er + 1)/2 + ((substrate_er - 1)/2) * Math.pow(1 + 12 * (substrate_h_mm / 3), -0.5)))', unit: 'mm' }
      ]
    },
    starterCode: {
      language: 'python',
      filename: 'antenna_calc.py',
      content: `# Resonant Microstrip Trace Antenna Calculator
import math

def calculate_antenna(er, h_mm, f_mhz):
    # Speed of light in vacuum (mm/s)
    c_speed = 299792458000.0
    f_hz = f_mhz * 1000000.0
    lambda_free = c_speed / f_hz

    # Effective relative permittivity (approximation for w/h ratio of ~2)
    w_h = 2.0
    eff_er = (er + 1.0)/2.0 + ((er - 1.0)/2.0) * (1.0 + 12.0*(h_mm / (w_h * h_mm)))**(-0.5)

    # Guide wavelength
    lambda_g = lambda_free / math.sqrt(eff_er)
    quarter_wave = lambda_g / 4.0

    print(f"Free Wavelength:   {lambda_free/10.0:.2f} cm")
    print(f"Effective Er:      {eff_er:.3f}")
    print(f"Resonant 1/4 L:    {quarter_wave:.2f} mm")

calculate_antenna(4.4, 1.6, 2450)`
    },
    bomStarter: [
      { quantity: 1, description: 'FR4 Double Sided Raw PCB Board', value: '1.6mm Thick 1oz', package: 'Board stock', notes: 'Substrate for trace antenna' },
      { quantity: 1, description: 'U.FL SMT RF Coaxial Connector', value: '50 Ohm U.FL', package: 'SMT-Connector', notes: 'RF feedline transition' }
    ],
    notebookEntries: [
      { type: 'PLAN', title: 'Impedance Match Tuning', content: 'Planned network space for a pi-filter (shunt-series-shunt pads) between the transceiver output and the trace antenna feed point to allow fine matching.' }
    ],
    resources: [
      { title: 'Inverted-F Antenna Design Guide', url: 'https://www.ti.com/lit/an/swru120d/swru120d.pdf', type: 'reference' }
    ]
  },
  {
    id: 'rs485-network',
    name: 'RS-485 Industrial Network Bus',
    tagline: 'Reliable multi-drop serial communications using the MAX485 differential driver.',
    category: 'RF & Networking',
    difficulty: 'beginner',
    estimatedHours: 3,
    tags: ['RS-485', 'Serial', 'Modbus', 'Differential', 'Bus'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="65" x2="260" y2="65" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="95" x2="260" y2="95" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="50" y="50" width="40" height="60" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="130" y="50" width="40" height="60" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="210" y="50" width="40" height="60" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="70" y1="50" x2="70" y2="32" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="150" y1="50" x2="150" y2="32" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="230" y1="50" x2="230" y2="32" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="230" cy="32" r="3" fill="#94a3b8"/>
  <circle cx="70" cy="32" r="2.5" fill="#6b6d85"/>
  <circle cx="150" cy="32" r="2.5" fill="#6b6d85"/>
</svg>`,
    projectContext: {
      description: 'Differential signaling serial transceiver bus configured for multi-drop master/slave Modbus topologies over long wiring runs in noisy environments.',
      tags: ['RS485', 'DifferentialSignaling', 'Modbus', 'MAX485']
    },
    parameterPlayground: {
      description: 'Calculate cable voltage drop and maximum data rates.',
      parameters: [
        { name: 'cable_length_m', label: 'Cable Length', min: 1, max: 1200, default: 100, unit: 'm' },
        { name: 'baud_rate', label: 'Baud Rate', min: 9600, max: 10000000, default: 115200, unit: 'bps' }
      ],
      equations: [
        { outputName: 'max_data_rate_kbps', label: 'Max Capacity Limit', formula_js: '100000 / cable_length_m', unit: 'kbps' },
        { outputName: 'round_trip_delay_ns', label: 'Cable Propagation Delay', formula_js: 'cable_length_m * 4.8', unit: 'ns' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'rs485_node.ino',
      content: `// RS-485 Half-Duplex Transceiver Driver
#define DE_PIN 3  // Driver Enable (High to Tx, Low to Rx)
#define RE_PIN 2  // Receiver Enable (Low to Enable)

void setup() {
  pinMode(DE_PIN, OUTPUT);
  pinMode(RE_PIN, OUTPUT);

  // Set to receive mode initially
  digitalWrite(DE_PIN, LOW);
  digitalWrite(RE_PIN, LOW);

  Serial.begin(9600);     // Hardware UART to PC
  Serial1.begin(115200);   // UART connected to RS-485 transceiver

  Serial.println("RS-485 Receiver Listening...");
}

void loop() {
  if (Serial1.available()) {
    char inChar = Serial1.read();
    Serial.write(inChar); // Forward to PC
  }
}

void transmitString(const char* data) {
  // Switch to transmit mode
  digitalWrite(DE_PIN, HIGH);
  digitalWrite(RE_PIN, HIGH);
  delay(1); // Allow transmitter to stabilize

  Serial1.print(data);
  Serial1.flush(); // Wait for data to empty buffer

  // Switch back to receive mode
  digitalWrite(DE_PIN, LOW);
  digitalWrite(RE_PIN, LOW);
}`
    },
    bomStarter: [
      { quantity: 1, description: 'RS-485 Differential Transceiver IC', value: 'MAX485EPA', package: 'DIP-8', notes: '5V half-duplex transceiver' },
      { quantity: 2, description: 'Bus Termination Resistors', value: '120Ω 1%', package: '0603', notes: 'Placed at extreme end-nodes of bus' },
      { quantity: 1, description: 'Shielded Twisted Pair Cable', value: '24 AWG STP', package: 'Cable', notes: 'Differential transmission wire' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Bus Termination Selection', content: 'Added 120 Ohm termination resistors at the ends of the bus line to match the characteristic impedance of the twisted-pair cable, preventing signal reflections.' }
    ],
    resources: [
      { title: 'MAX485 Datasheet', url: 'https://datasheets.maximintegrated.com/en/ds/MAX1487-MAX491.pdf', type: 'datasheet' }
    ]
  }
];
