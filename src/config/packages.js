export const PACKAGES = {
  // SMD PASSIVES
  '0201': {
    category: 'Passive', type: 'chip',
    body: { l: 0.60, w: 0.30, h: 0.23 },
    land: { l: 0.51, w: 0.42, pitch: 0.66 },
    courtyard: 0.12
  },
  '0402': {
    category: 'Passive', type: 'chip',
    body: { l: 1.00, w: 0.50, h: 0.35 },
    land: { l: 0.60, w: 0.60, pitch: 1.00 },
    courtyard: 0.20
  },
  '0603': {
    category: 'Passive', type: 'chip',
    body: { l: 1.60, w: 0.80, h: 0.45 },
    land: { l: 0.90, w: 0.95, pitch: 1.60 },
    courtyard: 0.25
  },
  '0805': {
    category: 'Passive', type: 'chip',
    body: { l: 2.00, w: 1.25, h: 0.50 },
    land: { l: 1.15, w: 1.45, pitch: 2.00 },
    courtyard: 0.25
  },
  '1206': {
    category: 'Passive', type: 'chip',
    body: { l: 3.20, w: 1.60, h: 0.55 },
    land: { l: 1.60, w: 1.80, pitch: 3.20 },
    courtyard: 0.25
  },
  '1210': {
    category: 'Passive', type: 'chip',
    body: { l: 3.20, w: 2.50, h: 0.55 },
    land: { l: 1.60, w: 2.70, pitch: 3.20 },
    courtyard: 0.25
  },
  '2512': {
    category: 'Passive', type: 'chip',
    body: { l: 6.30, w: 3.10, h: 0.55 },
    land: { l: 1.80, w: 3.30, pitch: 6.20 },
    courtyard: 0.25
  },

  // SOT PACKAGES
  'SOT-23': {
    category: 'Transistor', type: 'sot',
    pins: 3,
    body: { l: 2.90, w: 1.30, h: 1.10 },
    pitch: 0.95,
    land: { l: 0.90, w: 0.60 },
    pinLayout: 'sot23-3',
    courtyard: 0.25
  },
  'SOT-23-5': {
    category: 'IC', type: 'sot',
    pins: 5,
    body: { l: 2.90, w: 1.60, h: 1.10 },
    pitch: 0.95,
    land: { l: 0.90, w: 0.60 },
    pinLayout: 'sot23-5',
    courtyard: 0.25
  },
  'SOT-23-6': {
    category: 'IC', type: 'sot',
    pins: 6,
    body: { l: 2.90, w: 1.60, h: 1.10 },
    pitch: 0.95,
    land: { l: 0.90, w: 0.60 },
    pinLayout: 'sot23-6',
    courtyard: 0.25
  },
  'SOT-223': {
    category: 'Power', type: 'sot223',
    pins: 4,
    body: { l: 6.50, w: 3.50, h: 1.80 },
    pitch: 2.30,
    land: { l: 2.20, w: 0.80 },
    tabLand: { l: 3.60, w: 2.20 },
    courtyard: 0.25
  },
  'SOT-89': {
    category: 'Power', type: 'sot89',
    pins: 3,
    body: { l: 4.50, w: 2.50, h: 1.50 },
    pitch: 1.50,
    land: { l: 2.00, w: 0.80 },
    courtyard: 0.25
  },

  // SOIC
  'SOIC-8': {
    category: 'IC', type: 'soic',
    pins: 8,
    body: { l: 4.90, w: 3.90 },
    pitch: 1.27,
    land: { l: 1.50, w: 0.60 },
    rowSpacing: 5.40,
    courtyard: 0.25
  },
  'SOIC-14': {
    category: 'IC', type: 'soic',
    pins: 14,
    body: { l: 8.65, w: 3.90 },
    pitch: 1.27,
    land: { l: 1.50, w: 0.60 },
    rowSpacing: 5.40,
    courtyard: 0.25
  },
  'SOIC-16': {
    category: 'IC', type: 'soic',
    pins: 16,
    body: { l: 9.90, w: 3.90 },
    pitch: 1.27,
    land: { l: 1.50, w: 0.60 },
    rowSpacing: 5.40,
    courtyard: 0.25
  },
  'SOIC-8W': {
    category: 'IC', type: 'soic',
    pins: 8,
    body: { l: 4.90, w: 7.50 },
    pitch: 1.27,
    land: { l: 1.50, w: 0.60 },
    rowSpacing: 9.40,
    courtyard: 0.25
  },

  // TSSOP
  'TSSOP-8': {
    category: 'IC', type: 'ssop',
    pins: 8,
    pitch: 0.65,
    body: { l: 3.00, w: 4.40 },
    land: { l: 1.05, w: 0.45 },
    rowSpacing: 6.40,
    courtyard: 0.20
  },
  'TSSOP-16': {
    category: 'IC', type: 'ssop',
    pins: 16,
    pitch: 0.65,
    body: { l: 5.00, w: 4.40 },
    land: { l: 1.05, w: 0.45 },
    rowSpacing: 6.40,
    courtyard: 0.20
  },
  'TSSOP-20': {
    category: 'IC', type: 'ssop',
    pins: 20,
    pitch: 0.65,
    body: { l: 6.50, w: 4.40 },
    land: { l: 1.05, w: 0.45 },
    rowSpacing: 6.40,
    courtyard: 0.20
  },

  // QFP
  'LQFP-32': {
    category: 'IC', type: 'qfp',
    pins: 32,
    pitch: 0.80,
    body: { l: 7.00, w: 7.00 },
    land: { l: 1.35, w: 0.45 },
    courtyard: 0.50
  },
  'LQFP-48': {
    category: 'IC', type: 'qfp',
    pins: 48,
    pitch: 0.50,
    body: { l: 7.00, w: 7.00 },
    land: { l: 1.50, w: 0.30 },
    courtyard: 0.50
  },
  'LQFP-64': {
    category: 'IC', type: 'qfp',
    pins: 64,
    pitch: 0.50,
    body: { l: 10.00, w: 10.00 },
    land: { l: 1.50, w: 0.30 },
    courtyard: 0.50
  },
  'LQFP-100': {
    category: 'IC', type: 'qfp',
    pins: 100,
    pitch: 0.50,
    body: { l: 14.00, w: 14.00 },
    land: { l: 1.50, w: 0.30 },
    courtyard: 0.50
  },

  // QFN
  'QFN-16': {
    category: 'IC', type: 'qfn',
    pins: 16,
    pitch: 0.65,
    body: { l: 3.00, w: 3.00 },
    land: { l: 0.55, w: 0.35 },
    thermalPad: { l: 1.65, w: 1.65 },
    courtyard: 0.25
  },
  'QFN-24': {
    category: 'IC', type: 'qfn',
    pins: 24,
    pitch: 0.50,
    body: { l: 4.00, w: 4.00 },
    land: { l: 0.55, w: 0.30 },
    thermalPad: { l: 2.70, w: 2.70 },
    courtyard: 0.25
  },
  'QFN-32': {
    category: 'IC', type: 'qfn',
    pins: 32,
    pitch: 0.50,
    body: { l: 5.00, w: 5.00 },
    land: { l: 0.55, w: 0.30 },
    thermalPad: { l: 3.45, w: 3.45 },
    courtyard: 0.25
  },
  'QFN-48': {
    category: 'IC', type: 'qfn',
    pins: 48,
    pitch: 0.50,
    body: { l: 7.00, w: 7.00 },
    land: { l: 0.55, w: 0.30 },
    thermalPad: { l: 5.60, w: 5.60 },
    courtyard: 0.25
  },

  // DIP
  'DIP-8': {
    category: 'IC', type: 'dip',
    pins: 8,
    pitch: 2.54,
    rowSpacing: 7.62,
    drillDia: 0.80,
    padDia: 1.60,
    courtyard: 0.50
  },
  'DIP-14': {
    category: 'IC', type: 'dip',
    pins: 14,
    pitch: 2.54,
    rowSpacing: 7.62,
    drillDia: 0.80,
    padDia: 1.60,
    courtyard: 0.50
  },
  'DIP-16': {
    category: 'IC', type: 'dip',
    pins: 16,
    pitch: 2.54,
    rowSpacing: 7.62,
    drillDia: 0.80,
    padDia: 1.60,
    courtyard: 0.50
  },
  'DIP-28': {
    category: 'IC', type: 'dip',
    pins: 28,
    pitch: 2.54,
    rowSpacing: 15.24,
    drillDia: 0.80,
    padDia: 1.60,
    courtyard: 0.50
  },

  // TO packages
  'TO-92': {
    category: 'Transistor', type: 'to',
    pins: 3,
    pitch: 1.27,
    drillDia: 0.80,
    padDia: 1.60,
    courtyard: 0.50
  },
  'TO-220': {
    category: 'Power', type: 'to220',
    pins: 3,
    pitch: 2.54,
    drillDia: 1.00,
    padDia: 2.00,
    courtyard: 0.50
  },
  'TO-263': {
    category: 'Power', type: 'smd_power',
    pins: 3,
    pitch: 2.54,
    body: { l: 9.00, w: 8.20 },
    land: { l: 2.20, w: 1.70 },
    tabLand: { l: 8.50, w: 5.40 },
    courtyard: 0.50
  },
  'TO-252': {
    category: 'Power', type: 'smd_power',
    pins: 3,
    pitch: 2.29,
    body: { l: 6.60, w: 6.10 },
    land: { l: 2.20, w: 1.20 },
    tabLand: { l: 5.00, w: 3.60 },
    courtyard: 0.50
  },

  // BGA
  'BGA-64': {
    category: 'IC', type: 'bga',
    pins: 64, rows: 8, cols: 8,
    pitch: 0.80,
    ballDia: 0.45,
    padDia: 0.40,
    courtyard: 0.50
  },
  'BGA-144': {
    category: 'IC', type: 'bga',
    pins: 144, rows: 12, cols: 12,
    pitch: 0.80,
    ballDia: 0.45,
    padDia: 0.40,
    courtyard: 0.50
  },

  // CONNECTORS
  'Micro-USB-B': {
    category: 'Connector', type: 'usb',
    pins: 5,
    pitch: 0.65,
    body: { l: 7.40, w: 5.60 },
    land: { l: 1.20, w: 0.40 },
    mountingPads: true,
    courtyard: 0.50
  },
  'USB-C': {
    category: 'Connector', type: 'usb',
    pins: 24,
    pitch: 0.50,
    body: { l: 8.94, w: 7.18 },
    land: { l: 1.20, w: 0.30 },
    mountingPads: true,
    courtyard: 0.50
  },
}

export const CATEGORIES = ['All', 'Passive', 'IC', 'Power', 'Transistor', 'Connector', 'Custom']

// IPC-7351 density level pad multipliers
export const DENSITY_MULTIPLIERS = {
  least:   { l: 0.80, w: 0.80 },
  nominal: { l: 1.00, w: 1.00 },
  most:    { l: 1.20, w: 1.20 },
}
