export const FORMULA_LIBRARY = [
  // ─── MECHANICS ─────────────────────────────────────────────────────────────
  {
    name: 'Torque to Lift Load',
    description: 'Calculates the torque required to lift a load at a specific radius.',
    category: 'Mechanics',
    formula_latex: 'T = m \\cdot g \\cdot r',
    variables: [
      { symbol: 'm', name: 'Mass', value: 5, unit: 'kg', description: 'Mass of the load to lift' },
      { symbol: 'g', name: 'Gravitational acceleration', value: 9.80665, unit: 'm/s²', description: 'Local gravity constant' },
      { symbol: 'r', name: 'Radius', value: 0.3, unit: 'm', description: 'Radius of the lifting arm' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'm', label: 'Mass', min: 0.1, max: 100, default: 5, unit: 'kg' },
        { name: 'g', label: 'Gravity', min: 9.7, max: 9.9, default: 9.80665, unit: 'm/s²' },
        { name: 'r', label: 'Radius', min: 0.05, max: 2, default: 0.3, unit: 'm' }
      ],
      equations: [
        { outputName: 'torque', label: 'Required Torque', formula_js: 'm * g * r', unit: 'Nm' }
      ]
    }
  },
  {
    name: 'Kinetic Energy',
    description: 'Calculates the kinetic energy of a translating body.',
    category: 'Mechanics',
    formula_latex: 'E_k = \\frac{1}{2} m v^2',
    variables: [
      { symbol: 'm', name: 'Mass', value: 10, unit: 'kg', description: 'Mass of the body' },
      { symbol: 'v', name: 'Velocity', value: 3, unit: 'm/s', description: 'Velocity of the body' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'm', label: 'Mass', min: 1, max: 1000, default: 10, unit: 'kg' },
        { name: 'v', label: 'Velocity', min: 0, max: 100, default: 3, unit: 'm/s' }
      ],
      equations: [
        { outputName: 'Ek', label: 'Kinetic Energy', formula_js: '0.5 * m * Math.pow(v, 2)', unit: 'J' }
      ]
    }
  },
  {
    name: 'Potential Energy',
    description: 'Calculates the gravitational potential energy of a raised mass.',
    category: 'Mechanics',
    formula_latex: 'E_p = m \\cdot g \\cdot h',
    variables: [
      { symbol: 'm', name: 'Mass', value: 5, unit: 'kg', description: 'Mass of the body' },
      { symbol: 'g', name: 'Gravity', value: 9.80665, unit: 'm/s²', description: 'Gravitational acceleration' },
      { symbol: 'h', name: 'Height', value: 10, unit: 'm', description: 'Height above reference level' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'm', label: 'Mass', min: 0.1, max: 100, default: 5, unit: 'kg' },
        { name: 'g', label: 'Gravity', min: 9.7, max: 9.9, default: 9.80665, unit: 'm/s²' },
        { name: 'h', label: 'Height', min: 0, max: 1000, default: 10, unit: 'm' }
      ],
      equations: [
        { outputName: 'Ep', label: 'Potential Energy', formula_js: 'm * g * h', unit: 'J' }
      ]
    }
  },
  {
    name: 'Centripetal Force',
    description: 'Calculates the force keeping a body moving in a circular path.',
    category: 'Mechanics',
    formula_latex: 'F_c = \\frac{m \\cdot v^2}{r}',
    variables: [
      { symbol: 'm', name: 'Mass', value: 2, unit: 'kg', description: 'Mass of the rotating body' },
      { symbol: 'v', name: 'Velocity', value: 15, unit: 'm/s', description: 'Tangential velocity' },
      { symbol: 'r', name: 'Radius', value: 0.5, unit: 'm', description: 'Radius of circular path' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'm', label: 'Mass', min: 0.1, max: 50, default: 2, unit: 'kg' },
        { name: 'v', label: 'Velocity', min: 0.1, max: 150, default: 15, unit: 'm/s' },
        { name: 'r', label: 'Radius', min: 0.1, max: 10, default: 0.5, unit: 'm' }
      ],
      equations: [
        { outputName: 'Fc', label: 'Centripetal Force', formula_js: '(m * Math.pow(v, 2)) / r', unit: 'N' }
      ]
    }
  },
  {
    name: 'Moment of Inertia (Solid Cylinder)',
    description: 'Moment of inertia of a solid cylinder rotating around its longitudinal axis.',
    category: 'Mechanics',
    formula_latex: 'I = \\frac{1}{2} m r^2',
    variables: [
      { symbol: 'm', name: 'Mass', value: 10, unit: 'kg', description: 'Total mass of the cylinder' },
      { symbol: 'r', name: 'Radius', value: 0.15, unit: 'm', description: 'Radius of the cylinder' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'm', label: 'Mass', min: 0.5, max: 500, default: 10, unit: 'kg' },
        { name: 'r', label: 'Radius', min: 0.01, max: 5, default: 0.15, unit: 'm' }
      ],
      equations: [
        { outputName: 'I', label: 'Moment of Inertia', formula_js: '0.5 * m * Math.pow(r, 2)', unit: 'kg·m²' }
      ]
    }
  },
  {
    name: "Hooke's Law (Spring)",
    description: 'Calculates the force exerted by a spring when compressed or stretched.',
    category: 'Mechanics',
    formula_latex: 'F = k \\cdot x',
    variables: [
      { symbol: 'k', name: 'Spring constant', value: 500, unit: 'N/m', description: 'Stiffness of the spring' },
      { symbol: 'x', name: 'Displacement', value: 0.05, unit: 'm', description: 'Distance from equilibrium position' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'k', label: 'Spring Constant', min: 10, max: 10000, default: 500, unit: 'N/m' },
        { name: 'x', label: 'Displacement', min: 0.001, max: 1, default: 0.05, unit: 'm' }
      ],
      equations: [
        { outputName: 'F', label: 'Spring Force', formula_js: 'k * x', unit: 'N' }
      ]
    }
  },
  {
    name: 'Mechanical Stress',
    description: 'Calculates internal distribution of force per unit area.',
    category: 'Mechanics',
    formula_latex: '\\sigma = \\frac{F}{A}',
    variables: [
      { symbol: 'F', name: 'Force', value: 1000, unit: 'N', description: 'Applied normal force' },
      { symbol: 'A', name: 'Cross-sectional area', value: 0.0001, unit: 'm²', description: 'Area over which force acts' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'F', label: 'Force', min: 1, max: 500000, default: 1000, unit: 'N' },
        { name: 'A', label: 'Area', min: 1e-6, max: 0.1, default: 0.0001, unit: 'm²' }
      ],
      equations: [
        { outputName: 'stress', label: 'Stress', formula_js: 'F / A', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Rotational Power',
    description: 'Calculates power based on torque and rotational speed.',
    category: 'Mechanics',
    formula_latex: 'P = T \\cdot \\omega',
    variables: [
      { symbol: 'T', name: 'Torque', value: 25, unit: 'Nm', description: 'Output torque' },
      { symbol: 'n', name: 'Rotational Speed', value: 1500, unit: 'rpm', description: 'Rotational speed in RPM' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'T', label: 'Torque', min: 0.1, max: 1000, default: 25, unit: 'Nm' },
        { name: 'n', label: 'Speed (RPM)', min: 10, max: 10000, default: 1500, unit: 'rpm' }
      ],
      equations: [
        { outputName: 'omega', label: 'Angular Speed', formula_js: 'n * (2 * Math.PI / 60)', unit: 'rad/s' },
        { outputName: 'P', label: 'Power Output', formula_js: 'T * n * (2 * Math.PI / 60)', unit: 'W' }
      ]
    }
  },

  // ─── ELECTRONICS ───────────────────────────────────────────────────────────
  {
    name: "Ohm's Law",
    description: 'Fundamental relationship between voltage, current, and resistance.',
    category: 'Electronics',
    formula_latex: 'V = I \\cdot R',
    variables: [
      { symbol: 'I', name: 'Current', value: 0.5, unit: 'A', description: 'Electrical current flowing through component' },
      { symbol: 'R', name: 'Resistance', value: 220, unit: 'Ω', description: 'Resistance of the component' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'I', label: 'Current', min: 0.001, max: 10, default: 0.5, unit: 'A' },
        { name: 'R', label: 'Resistance', min: 1, max: 100000, default: 220, unit: 'Ω' }
      ],
      equations: [
        { outputName: 'V', label: 'Voltage Drop', formula_js: 'I * R', unit: 'V' }
      ]
    }
  },
  {
    name: 'Electrical Power',
    description: 'Power dissipated by a resistor under electrical load.',
    category: 'Electronics',
    formula_latex: 'P = I^2 \\cdot R',
    variables: [
      { symbol: 'I', name: 'Current', value: 1.5, unit: 'A', description: 'Current flowing through component' },
      { symbol: 'R', name: 'Resistance', value: 10, unit: 'Ω', description: 'Resistance value' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'I', label: 'Current', min: 0.01, max: 50, default: 1.5, unit: 'A' },
        { name: 'R', label: 'Resistance', min: 0.1, max: 1000, default: 10, unit: 'Ω' }
      ],
      equations: [
        { outputName: 'P', label: 'Power Dissipated', formula_js: 'Math.pow(I, 2) * R', unit: 'W' }
      ]
    }
  },
  {
    name: 'RC Cutoff Frequency',
    description: 'Cutoff frequency (-3dB) of a single-pole RC filter.',
    category: 'Electronics',
    formula_latex: 'f_c = \\frac{1}{2\\pi R C}',
    variables: [
      { symbol: 'R', name: 'Resistance', value: 10000, unit: 'Ω', description: 'Filter resistance' },
      { symbol: 'C', name: 'Capacitance', value: 1e-7, unit: 'F', description: 'Filter capacitance (100 nF)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'R', label: 'Resistance', min: 100, max: 1000000, default: 10000, unit: 'Ω' },
        { name: 'C', label: 'Capacitance', min: 1e-12, max: 1e-3, default: 1e-7, unit: 'F' }
      ],
      equations: [
        { outputName: 'fc', label: 'Cutoff Frequency', formula_js: '1 / (2 * Math.PI * R * C)', unit: 'Hz' }
      ]
    }
  },
  {
    name: 'LC Resonant Frequency',
    description: 'Calculates the resonant frequency of an ideal parallel/series LC circuit.',
    category: 'Electronics',
    formula_latex: 'f_0 = \\frac{1}{2\\pi\\sqrt{L C}}',
    variables: [
      { symbol: 'L', name: 'Inductance', value: 1e-3, unit: 'H', description: 'Circuit inductance (1 mH)' },
      { symbol: 'C', name: 'Capacitance', value: 1e-6, unit: 'F', description: 'Circuit capacitance (1 µF)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'L', label: 'Inductance', min: 1e-6, max: 1, default: 1e-3, unit: 'H' },
        { name: 'C', label: 'Capacitance', min: 1e-12, max: 1e-3, default: 1e-6, unit: 'F' }
      ],
      equations: [
        { outputName: 'f0', label: 'Resonant Frequency', formula_js: '1 / (2 * Math.PI * Math.sqrt(L * C))', unit: 'Hz' }
      ]
    }
  },
  {
    name: 'Voltage Divider Output',
    description: 'Calculates the output voltage of a dual-resistor voltage divider.',
    category: 'Electronics',
    formula_latex: 'V_{out} = V_{in} \\cdot \\frac{R_2}{R_1 + R_2}',
    variables: [
      { symbol: 'Vin', name: 'Input Voltage', value: 5, unit: 'V', description: 'Input voltage level' },
      { symbol: 'R1', name: 'Resistor 1 (Top)', value: 10000, unit: 'Ω', description: 'Upper voltage divider resistor' },
      { symbol: 'R2', name: 'Resistor 2 (Bottom)', value: 5000, unit: 'Ω', description: 'Lower voltage divider resistor' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Vin', label: 'Input Voltage', min: 0.1, max: 48, default: 5, unit: 'V' },
        { name: 'R1', label: 'R1 (Top)', min: 10, max: 1000000, default: 10000, unit: 'Ω' },
        { name: 'R2', label: 'R2 (Bottom)', min: 10, max: 1000000, default: 5000, unit: 'Ω' }
      ],
      equations: [
        { outputName: 'Vout', label: 'Output Voltage', formula_js: 'Vin * (R2 / (R1 + R2))', unit: 'V' }
      ]
    }
  },
  {
    name: 'Capacitive Reactance',
    description: 'Opposition of a capacitor to alternating current at a specific frequency.',
    category: 'Electronics',
    formula_latex: 'X_c = \\frac{1}{2\\pi f C}',
    variables: [
      { symbol: 'f', name: 'Frequency', value: 1000, unit: 'Hz', description: 'AC signal frequency' },
      { symbol: 'C', name: 'Capacitance', value: 1e-6, unit: 'F', description: 'Capacitance value' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'f', label: 'Frequency', min: 1, max: 10000000, default: 1000, unit: 'Hz' },
        { name: 'C', label: 'Capacitance', min: 1e-12, max: 0.1, default: 1e-6, unit: 'F' }
      ],
      equations: [
        { outputName: 'Xc', label: 'Reactance', formula_js: '1 / (2 * Math.PI * f * C)', unit: 'Ω' }
      ]
    }
  },
  {
    name: 'Inductive Reactance',
    description: 'Opposition of an inductor to alternating current at a specific frequency.',
    category: 'Electronics',
    formula_latex: 'X_l = 2\\pi f L',
    variables: [
      { symbol: 'f', name: 'Frequency', value: 1000, unit: 'Hz', description: 'AC signal frequency' },
      { symbol: 'L', name: 'Inductance', value: 1e-3, unit: 'H', description: 'Inductance value' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'f', label: 'Frequency', min: 1, max: 10000000, default: 1000, unit: 'Hz' },
        { name: 'L', label: 'Inductance', min: 1e-9, max: 100, default: 1e-3, unit: 'H' }
      ],
      equations: [
        { outputName: 'Xl', label: 'Reactance', formula_js: '2 * Math.PI * f * L', unit: 'Ω' }
      ]
    }
  },
  {
    name: '3-Phase AC Real Power',
    description: 'Power delivered by a balanced 3-phase AC system.',
    category: 'Electronics',
    formula_latex: 'P = \\sqrt{3} \\cdot V_L \\cdot I_L \\cdot PF',
    variables: [
      { symbol: 'V', name: 'Line Voltage', value: 480, unit: 'V', description: 'Line-to-line RMS voltage' },
      { symbol: 'I', name: 'Line Current', value: 32, unit: 'A', description: 'Line RMS current' },
      { symbol: 'PF', name: 'Power Factor', value: 0.85, unit: '', description: 'Cosine of phase angle (0.0 to 1.0)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'V', label: 'Line Voltage', min: 100, max: 1000, default: 480, unit: 'V' },
        { name: 'I', label: 'Line Current', min: 1, max: 500, default: 32, unit: 'A' },
        { name: 'PF', label: 'Power Factor', min: 0, max: 1, default: 0.85, unit: '' }
      ],
      equations: [
        { outputName: 'P', label: 'Real Power', formula_js: 'Math.sqrt(3) * V * I * PF', unit: 'W' }
      ]
    }
  },

  // ─── THERMODYNAMICS ────────────────────────────────────────────────────────
  {
    name: 'Ideal Gas Law',
    description: 'Relates pressure, volume, substance amount, and temperature of an ideal gas.',
    category: 'Thermodynamics',
    formula_latex: 'P = \\frac{n R T}{V}',
    variables: [
      { symbol: 'n', name: 'Moles', value: 1, unit: 'mol', description: 'Amount of substance' },
      { symbol: 'R', name: 'Gas Constant', value: 8.314, unit: 'J/(mol·K)', description: 'Universal gas constant' },
      { symbol: 'T', name: 'Temperature', value: 298.15, unit: 'K', description: 'Absolute temperature (Kelvin)' },
      { symbol: 'V', name: 'Volume', value: 0.0244, unit: 'm³', description: 'Volume of container' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'n', label: 'Moles', min: 0.01, max: 100, default: 1, unit: 'mol' },
        { name: 'R', label: 'Gas Constant', min: 8.3, max: 8.4, default: 8.314, unit: 'J/(mol·K)' },
        { name: 'T', label: 'Temperature (K)', min: 1, max: 2000, default: 298.15, unit: 'K' },
        { name: 'V', label: 'Volume (m³)', min: 0.001, max: 10, default: 0.0244, unit: 'm³' }
      ],
      equations: [
        { outputName: 'P', label: 'Pressure', formula_js: '(n * R * T) / V', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Sensible Heat Transfer',
    description: 'Heat energy required to change the temperature of a mass without phase change.',
    category: 'Thermodynamics',
    formula_latex: 'Q = m \\cdot c \\cdot \\Delta T',
    variables: [
      { symbol: 'm', name: 'Mass', value: 2, unit: 'kg', description: 'Mass of the material' },
      { symbol: 'c', name: 'Specific heat capacity', value: 4184, unit: 'J/(kg·K)', description: 'Specific heat capacity (water = 4184)' },
      { symbol: 'dT', name: 'Delta T', value: 10, unit: 'K', description: 'Temperature difference' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'm', label: 'Mass', min: 0.01, max: 1000, default: 2, unit: 'kg' },
        { name: 'c', label: 'Spec Heat', min: 100, max: 10000, default: 4184, unit: 'J/(kg·K)' },
        { name: 'dT', label: 'Delta Temp', min: -200, max: 1000, default: 10, unit: 'K' }
      ],
      equations: [
        { outputName: 'Q', label: 'Heat Transferred', formula_js: 'm * c * dT', unit: 'J' }
      ]
    }
  },
  {
    name: 'Carnot Cycle Efficiency',
    description: 'Theoretical maximum efficiency limit of any heat engine operating between two temperatures.',
    category: 'Thermodynamics',
    formula_latex: '\\eta = 1 - \\frac{T_C}{T_H}',
    variables: [
      { symbol: 'TC', name: 'Cold Reservoir Temp', value: 298.15, unit: 'K', description: 'Temperature of cold sink' },
      { symbol: 'TH', name: 'Hot Reservoir Temp', value: 873.15, unit: 'K', description: 'Temperature of hot source' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'TC', label: 'Cold Temp (K)', min: 1, max: 500, default: 298.15, unit: 'K' },
        { name: 'TH', label: 'Hot Temp (K)', min: 300, max: 3000, default: 873.15, unit: 'K' }
      ],
      equations: [
        { outputName: 'eff', label: 'Efficiency', formula_js: 'TC >= TH ? 0 : 1 - (TC / TH)', unit: '' }
      ]
    }
  },
  {
    name: 'Conductive Heat Transfer (Fourier)',
    description: 'Heat conduction rate through a material boundary.',
    category: 'Thermodynamics',
    formula_latex: 'q = k \\cdot A \\cdot \\frac{\\Delta T}{L}',
    variables: [
      { symbol: 'k', name: 'Thermal conductivity', value: 401, unit: 'W/(m·K)', description: 'Conductivity coefficient (copper = 401)' },
      { symbol: 'A', name: 'Area', value: 0.05, unit: 'm²', description: 'Heat transfer surface area' },
      { symbol: 'dT', name: 'Delta Temp', value: 50, unit: 'K', description: 'Temperature difference across material' },
      { symbol: 'L', name: 'Thickness', value: 0.01, unit: 'm', description: 'Thickness of material barrier' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'k', label: 'Thermal Cond', min: 0.01, max: 1000, default: 401, unit: 'W/(m·K)' },
        { name: 'A', label: 'Surface Area', min: 1e-4, max: 10, default: 0.05, unit: 'm²' },
        { name: 'dT', label: 'Delta Temp', min: 0.1, max: 2000, default: 50, unit: 'K' },
        { name: 'L', label: 'Thickness', min: 1e-4, max: 1, default: 0.01, unit: 'm' }
      ],
      equations: [
        { outputName: 'q', label: 'Conduction Rate', formula_js: 'k * A * (dT / L)', unit: 'W' }
      ]
    }
  },
  {
    name: 'Stefan-Boltzmann Radiation',
    description: 'Total power radiated per unit area of a blackbody at absolute temperature.',
    category: 'Thermodynamics',
    formula_latex: 'P = \\epsilon \\cdot \\sigma \\cdot A \\cdot T^4',
    variables: [
      { symbol: 'eps', name: 'Emissivity', value: 0.9, unit: '', description: 'Material surface emissivity (0 to 1)' },
      { symbol: 'sig', name: 'Stefan-Boltzmann Constant', value: 5.670374e-8, unit: 'W/(m²·K⁴)', description: 'Radiation constant' },
      { symbol: 'A', name: 'Surface Area', value: 0.5, unit: 'm²', description: 'Radiating surface area' },
      { symbol: 'T', name: 'Temperature', value: 400, unit: 'K', description: 'Surface absolute temperature' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'eps', label: 'Emissivity', min: 0.01, max: 1, default: 0.9, unit: '' },
        { name: 'sig', label: 'S-B Constant', min: 5.67e-8, max: 5.68e-8, default: 5.670374e-8, unit: 'W/(m²·K⁴)' },
        { name: 'A', label: 'Area', min: 1e-3, max: 100, default: 0.5, unit: 'm²' },
        { name: 'T', label: 'Temperature (K)', min: 1, max: 3000, default: 400, unit: 'K' }
      ],
      equations: [
        { outputName: 'P', label: 'Radiated Power', formula_js: 'eps * sig * A * Math.pow(T, 4)', unit: 'W' }
      ]
    }
  },
  {
    name: 'First Law of Thermodynamics',
    description: 'Calculates internal energy change based on heat added and work done.',
    category: 'Thermodynamics',
    formula_latex: '\\Delta U = Q - W',
    variables: [
      { symbol: 'Q', name: 'Heat Added', value: 500, unit: 'J', description: 'Heat energy added to system' },
      { symbol: 'W', name: 'Work Done', value: 200, unit: 'J', description: 'Work done by the system' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Q', label: 'Heat Added', min: -10000, max: 10000, default: 500, unit: 'J' },
        { name: 'W', label: 'Work Done', min: -10000, max: 10000, default: 200, unit: 'J' }
      ],
      equations: [
        { outputName: 'dU', label: 'Energy Change', formula_js: 'Q - W', unit: 'J' }
      ]
    }
  },
  {
    name: 'Entropy Change (Isothermal)',
    description: 'Change in entropy of a system during a reversible isothermal process.',
    category: 'Thermodynamics',
    formula_latex: '\\Delta S = \\frac{Q}{T}',
    variables: [
      { symbol: 'Q', name: 'Heat Added', value: 1500, unit: 'J', description: 'Reversible heat transfer' },
      { symbol: 'T', name: 'Temperature', value: 300, unit: 'K', description: 'Absolute constant temperature' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Q', label: 'Heat Transferred', min: -100000, max: 100000, default: 1500, unit: 'J' },
        { name: 'T', label: 'Temperature (K)', min: 1, max: 2000, default: 300, unit: 'K' }
      ],
      equations: [
        { outputName: 'dS', label: 'Entropy Change', formula_js: 'Q / T', unit: 'J/K' }
      ]
    }
  },
  {
    name: 'Coefficient of Performance (Refrigerators)',
    description: 'Performance indicator of heat pump or refrigeration device.',
    category: 'Thermodynamics',
    formula_latex: 'COP = \\frac{T_C}{T_H - T_C}',
    variables: [
      { symbol: 'TC', name: 'Cold Temp', value: 268.15, unit: 'K', description: 'Cold reservoir temperature (-5°C)' },
      { symbol: 'TH', name: 'Hot Temp', value: 308.15, unit: 'K', description: 'Hot reservoir temperature (35°C)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'TC', label: 'Cold Temp (K)', min: 100, max: 300, default: 268.15, unit: 'K' },
        { name: 'TH', label: 'Hot Temp (K)', min: 250, max: 500, default: 308.15, unit: 'K' }
      ],
      equations: [
        { outputName: 'COP', label: 'COP', formula_js: 'TH <= TC ? 0 : TC / (TH - TC)', unit: '' }
      ]
    }
  },

  // ─── FLUID DYNAMICS ────────────────────────────────────────────────────────
  {
    name: 'Reynolds Number',
    description: 'Dimensionless parameter used to predict fluid flow regimes (laminar vs turbulent).',
    category: 'Fluid Dynamics',
    formula_latex: 'Re = \\frac{\\rho \\cdot v \\cdot D}{\\mu}',
    variables: [
      { symbol: 'rho', name: 'Density', value: 998, unit: 'kg/m³', description: 'Density of fluid' },
      { symbol: 'v', name: 'Velocity', value: 1.5, unit: 'm/s', description: 'Mean flow velocity' },
      { symbol: 'D', name: 'Diameter', value: 0.05, unit: 'm', description: 'Internal pipe diameter' },
      { symbol: 'mu', name: 'Dynamic Viscosity', value: 0.001002, unit: 'Pa·s', description: 'Dynamic viscosity (water at 20°C)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'rho', label: 'Density', min: 0.1, max: 20000, default: 998, unit: 'kg/m³' },
        { name: 'v', label: 'Velocity', min: 0.01, max: 100, default: 1.5, unit: 'm/s' },
        { name: 'D', label: 'Diameter', min: 0.001, max: 2, default: 0.05, unit: 'm' },
        { name: 'mu', label: 'Viscosity', min: 1e-6, max: 1, default: 0.001002, unit: 'Pa·s' }
      ],
      equations: [
        { outputName: 'Re', label: 'Reynolds Number', formula_js: '(rho * v * D) / mu', unit: '' }
      ]
    }
  },
  {
    name: "Bernoulli's Static Pressure Drop",
    description: 'Calculates static pressure change due to changes in height and fluid speed.',
    category: 'Fluid Dynamics',
    formula_latex: '\\Delta P = \\frac{1}{2} \\rho (v_2^2 - v_1^2) + \\rho g (y_2 - y_1)',
    variables: [
      { symbol: 'rho', name: 'Fluid density', value: 1000, unit: 'kg/m³', description: 'Density of the fluid' },
      { symbol: 'v1', name: 'Velocity 1', value: 1, unit: 'm/s', description: 'Velocity at section 1' },
      { symbol: 'v2', name: 'Velocity 2', value: 4, unit: 'm/s', description: 'Velocity at section 2' },
      { symbol: 'g', name: 'Gravity', value: 9.80665, unit: 'm/s²', description: 'Local gravity constant' },
      { symbol: 'dy', name: 'Elevation Change', value: 2, unit: 'm', description: 'Change in elevation (y2 - y1)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'rho', label: 'Density', min: 1, max: 15000, default: 1000, unit: 'kg/m³' },
        { name: 'v1', label: 'Speed 1', min: 0, max: 50, default: 1, unit: 'm/s' },
        { name: 'v2', label: 'Speed 2', min: 0, max: 50, default: 4, unit: 'm/s' },
        { name: 'g', label: 'Gravity', min: 9.7, max: 9.9, default: 9.80665, unit: 'm/s²' },
        { name: 'dy', label: 'Delta Elev', min: -100, max: 100, default: 2, unit: 'm' }
      ],
      equations: [
        { outputName: 'dP', label: 'Pressure Drop', formula_js: '0.5 * rho * (Math.pow(v2, 2) - Math.pow(v1, 2)) + rho * g * dy', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Hydrostatic Pressure',
    description: 'Pressure exerted by a fluid column at equilibrium due to gravity.',
    category: 'Fluid Dynamics',
    formula_latex: 'P = \\rho \\cdot g \\cdot h',
    variables: [
      { symbol: 'rho', name: 'Density', value: 1000, unit: 'kg/m³', description: 'Fluid density (water = 1000)' },
      { symbol: 'g', name: 'Gravity', value: 9.80665, unit: 'm/s²', description: 'Gravitational acceleration' },
      { symbol: 'h', name: 'Depth', value: 10, unit: 'm', description: 'Depth of the fluid column' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'rho', label: 'Density', min: 0.1, max: 20000, default: 1000, unit: 'kg/m³' },
        { name: 'g', label: 'Gravity', min: 9.7, max: 9.9, default: 9.80665, unit: 'm/s²' },
        { name: 'h', label: 'Depth', min: 0.1, max: 11000, default: 10, unit: 'm' }
      ],
      equations: [
        { outputName: 'P', label: 'Pressure', formula_js: 'rho * g * h', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Volumetric Flow Rate',
    description: 'Volume of fluid which passes per unit of time through a cross-section.',
    category: 'Fluid Dynamics',
    formula_latex: 'Q = A \\cdot v',
    variables: [
      { symbol: 'A', name: 'Area', value: 0.0078, unit: 'm²', description: 'Cross-sectional area of pipe' },
      { symbol: 'v', name: 'Velocity', value: 2.5, unit: 'm/s', description: 'Average fluid velocity' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'A', label: 'Area', min: 1e-6, max: 10, default: 0.0078, unit: 'm²' },
        { name: 'v', label: 'Speed', min: 0, max: 100, default: 2.5, unit: 'm/s' }
      ],
      equations: [
        { outputName: 'Q', label: 'Flow Rate', formula_js: 'A * v', unit: 'm³/s' }
      ]
    }
  },
  {
    name: 'Aerodynamic Drag Force',
    description: 'Resistance force exerted on a body moving through a fluid.',
    category: 'Fluid Dynamics',
    formula_latex: 'F_d = \\frac{1}{2} \\rho v^2 C_d A',
    variables: [
      { symbol: 'rho', name: 'Air density', value: 1.225, unit: 'kg/m³', description: 'Fluid density (standard air = 1.225)' },
      { symbol: 'v', name: 'Velocity', value: 30, unit: 'm/s', description: 'Flow speed relative to body' },
      { symbol: 'Cd', name: 'Drag Coefficient', value: 0.3, unit: '', description: 'Dimensionless shape resistance factor' },
      { symbol: 'A', name: 'Frontal Area', value: 2.2, unit: 'm²', description: 'Projected frontal cross-sectional area' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'rho', label: 'Air Density', min: 0.1, max: 5, default: 1.225, unit: 'kg/m³' },
        { name: 'v', label: 'Velocity', min: 0.1, max: 500, default: 30, unit: 'm/s' },
        { name: 'Cd', label: 'Drag Coeff', min: 0.01, max: 2, default: 0.3, unit: '' },
        { name: 'A', label: 'Frontal Area', min: 0.01, max: 50, default: 2.2, unit: 'm²' }
      ],
      equations: [
        { outputName: 'Fd', label: 'Drag Force', formula_js: '0.5 * rho * Math.pow(v, 2) * Cd * A', unit: 'N' }
      ]
    }
  },
  {
    name: 'Hagen-Poiseuille Pressure Drop',
    description: 'Calculates pressure drop in laminar flow through a long cylindrical pipe.',
    category: 'Fluid Dynamics',
    formula_latex: '\\Delta P = \\frac{8 \\mu L Q}{\\pi R^4}',
    variables: [
      { symbol: 'mu', name: 'Viscosity', value: 0.001, unit: 'Pa·s', description: 'Fluid dynamic viscosity' },
      { symbol: 'L', name: 'Length', value: 10, unit: 'm', description: 'Length of the pipe' },
      { symbol: 'Q', name: 'Flow Rate', value: 0.0005, unit: 'm³/s', description: 'Volumetric flow rate' },
      { symbol: 'R', name: 'Radius', value: 0.01, unit: 'm', description: 'Internal pipe radius (10 mm)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'mu', label: 'Viscosity', min: 1e-4, max: 10, default: 0.001, unit: 'Pa·s' },
        { name: 'L', label: 'Pipe Length', min: 0.1, max: 1000, default: 10, unit: 'm' },
        { name: 'Q', label: 'Flow Rate', min: 1e-6, max: 0.1, default: 0.0005, unit: 'm³/s' },
        { name: 'R', label: 'Pipe Radius', min: 0.001, max: 0.5, default: 0.01, unit: 'm' }
      ],
      equations: [
        { outputName: 'dP', label: 'Pressure Drop', formula_js: '(8 * mu * L * Q) / (Math.PI * Math.pow(R, 4))', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Torricelli Theorem Velocity',
    description: 'Calculates speed of efflux of liquid from an aperture under gravity.',
    category: 'Fluid Dynamics',
    formula_latex: 'v = \\sqrt{2 g h}',
    variables: [
      { symbol: 'g', name: 'Gravity', value: 9.80665, unit: 'm/s²', description: 'Gravitational acceleration' },
      { symbol: 'h', name: 'Head height', value: 5, unit: 'm', description: 'Height of fluid column above aperture' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'g', label: 'Gravity', min: 9.7, max: 9.9, default: 9.80665, unit: 'm/s²' },
        { name: 'h', label: 'Height Diff', min: 0.01, max: 1000, default: 5, unit: 'm' }
      ],
      equations: [
        { outputName: 'v', label: 'Exit Speed', formula_js: 'Math.sqrt(2 * g * h)', unit: 'm/s' }
      ]
    }
  },
  {
    name: 'Froude Number',
    description: 'Dimensionless value relating inertia force to gravitational force in open channel flow.',
    category: 'Fluid Dynamics',
    formula_latex: 'Fr = \\frac{v}{\\sqrt{g L}}',
    variables: [
      { symbol: 'v', name: 'Flow Velocity', value: 4, unit: 'm/s', description: 'Flow velocity' },
      { symbol: 'g', name: 'Gravity', value: 9.80665, unit: 'm/s²', description: 'Gravitational acceleration' },
      { symbol: 'L', name: 'Depth Length', value: 0.8, unit: 'm', description: 'Hydraulic depth or length scale' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'v', label: 'Velocity', min: 0.01, max: 50, default: 4, unit: 'm/s' },
        { name: 'g', label: 'Gravity', min: 9.7, max: 9.9, default: 9.80665, unit: 'm/s²' },
        { name: 'L', label: 'Length Scale', min: 0.01, max: 10, default: 0.8, unit: 'm' }
      ],
      equations: [
        { outputName: 'Fr', label: 'Froude Number', formula_js: 'v / Math.sqrt(g * L)', unit: '' }
      ]
    }
  },

  // ─── SIGNAL PROCESSING ─────────────────────────────────────────────────────
  {
    name: 'Decibels to Power Ratio',
    description: 'Converts decibels (dB) back to absolute power amplification ratio.',
    category: 'Signal Processing',
    formula_latex: 'A_P = 10^{\\frac{dB}{10}}',
    variables: [
      { symbol: 'dB', name: 'Gain in dB', value: 20, unit: 'dB', description: 'Logarithmic power gain' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'dB', label: 'Decibels', min: -100, max: 100, default: 20, unit: 'dB' }
      ],
      equations: [
        { outputName: 'ratio', label: 'Power Ratio', formula_js: 'Math.pow(10, dB / 10)', unit: 'x' }
      ]
    }
  },
  {
    name: 'Decibels to Amplitude Ratio',
    description: 'Converts decibels (dB) back to absolute voltage or pressure ratio.',
    category: 'Signal Processing',
    formula_latex: 'A_V = 10^{\\frac{dB}{20}}',
    variables: [
      { symbol: 'dB', name: 'Gain in dB', value: 20, unit: 'dB', description: 'Logarithmic amplitude gain' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'dB', label: 'Decibels', min: -100, max: 100, default: 20, unit: 'dB' }
      ],
      equations: [
        { outputName: 'ratio', label: 'Amplitude Ratio', formula_js: 'Math.pow(10, dB / 20)', unit: 'x' }
      ]
    }
  },
  {
    name: 'Sampling Period to Frequency',
    description: 'Inverse relationship between sampling interval and frequency.',
    category: 'Signal Processing',
    formula_latex: 'f_s = \\frac{1}{T_s}',
    variables: [
      { symbol: 'Ts', name: 'Sampling Period', value: 0.0000227, unit: 's', description: 'Time interval between samples (e.g. 44.1kHz)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Ts', label: 'Sample Period', min: 1e-9, max: 10, default: 0.0000227, unit: 's' }
      ],
      equations: [
        { outputName: 'fs', label: 'Sampling Rate', formula_js: '1 / Ts', unit: 'Hz' }
      ]
    }
  },
  {
    name: 'Nyquist-Shannon Sampling Limit',
    description: 'Defines the minimum sampling rate required to avoid signal aliasing.',
    category: 'Signal Processing',
    formula_latex: 'f_s = 2 \\cdot f_{max}',
    variables: [
      { symbol: 'fmax', name: 'Max Signal Freq', value: 20000, unit: 'Hz', description: 'Highest frequency component of signal' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'fmax', label: 'Highest Freq', min: 1, max: 1000000000, default: 20000, unit: 'Hz' }
      ],
      equations: [
        { outputName: 'fs', label: 'Min Nyquist Rate', formula_js: '2 * fmax', unit: 'Hz' }
      ]
    }
  },
  {
    name: 'Sinc Function',
    description: 'Normalized sinc function critical in interpolation and filter designs.',
    category: 'Signal Processing',
    formula_latex: '\\text{sinc}(x) = \\frac{\\sin(\\pi x)}{\\pi x}',
    variables: [
      { symbol: 'x', name: 'Input variable', value: 0.5, unit: '', description: 'Normalized variable input' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'x', label: 'Variable', min: -10, max: 10, default: 0.5, unit: '' }
      ],
      equations: [
        { outputName: 'sinc', label: 'Sinc Value', formula_js: 'x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)', unit: '' }
      ]
    }
  },
  {
    name: 'Shannon-Hartley Channel Capacity',
    description: 'Theoretical maximum error-free data rate transmitted over a noisy channel.',
    category: 'Signal Processing',
    formula_latex: 'C = B \\cdot \\log_2(1 + SNR_{linear})',
    variables: [
      { symbol: 'B', name: 'Bandwidth', value: 20000000, unit: 'Hz', description: 'Frequency bandwidth of channel (20 MHz)' },
      { symbol: 'SNRdB', name: 'SNR in dB', value: 30, unit: 'dB', description: 'Signal to noise ratio in decibels' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'B', label: 'Bandwidth', min: 1000, max: 1e11, default: 20000000, unit: 'Hz' },
        { name: 'SNRdB', label: 'SNR (dB)', min: -10, max: 80, default: 30, unit: 'dB' }
      ],
      equations: [
        { outputName: 'snr', label: 'Linear SNR', formula_js: 'Math.pow(10, SNRdB / 10)', unit: '' },
        { outputName: 'C', label: 'Capacity', formula_js: 'B * (Math.log(1 + Math.pow(10, SNRdB / 10)) / Math.log(2))', unit: 'bps' }
      ]
    }
  },
  {
    name: 'Frequency Resolution (FFT)',
    description: 'Calculates frequency grid resolution of an FFT.',
    category: 'Signal Processing',
    formula_latex: '\\Delta f = \\frac{f_s}{N}',
    variables: [
      { symbol: 'fs', name: 'Sampling rate', value: 44100, unit: 'Hz', description: 'AC sampling rate' },
      { symbol: 'N', name: 'FFT length', value: 1024, unit: 'samples', description: 'Number of sample points in FFT transform' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'fs', label: 'Sampling Rate', min: 10, max: 1e9, default: 44100, unit: 'Hz' },
        { name: 'N', label: 'FFT Bin Size', min: 8, max: 1048576, default: 1024, unit: 'samples' }
      ],
      equations: [
        { outputName: 'df', label: 'Freq Bin Resolution', formula_js: 'fs / N', unit: 'Hz' }
      ]
    }
  },
  {
    name: 'Harmonic Distortion (THD)',
    description: 'Calculates Total Harmonic Distortion from harmonic voltages.',
    category: 'Signal Processing',
    formula_latex: '\\text{THD} = \\frac{\\sqrt{V_2^2 + V_3^2 + V_4^2}}{V_1}',
    variables: [
      { symbol: 'V1', name: 'Fundamental V', value: 1.0, unit: 'V', description: 'RMS voltage of fundamental frequency' },
      { symbol: 'V2', name: '2nd Harmonic V', value: 0.05, unit: 'V', description: 'RMS voltage of 2nd harmonic component' },
      { symbol: 'V3', name: '3rd Harmonic V', value: 0.02, unit: 'V', description: 'RMS voltage of 3rd harmonic component' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'V1', label: 'Fundamental V', min: 0.01, max: 100, default: 1.0, unit: 'V' },
        { name: 'V2', label: '2nd Harm V', min: 0, max: 10, default: 0.05, unit: 'V' },
        { name: 'V3', label: '3rd Harm V', min: 0, max: 10, default: 0.02, unit: 'V' }
      ],
      equations: [
        { outputName: 'thd', label: 'THD Ratio', formula_js: 'Math.sqrt(Math.pow(V2, 2) + Math.pow(V3, 2)) / V1', unit: '' }
      ]
    }
  },

  // ─── MATERIALS ─────────────────────────────────────────────────────────────
  {
    name: 'Youngs Modulus (Tensile)',
    description: 'Modulus of elasticity relating stress to strain in mechanical load.',
    category: 'Materials',
    formula_latex: 'E = \\frac{\\sigma}{\\epsilon}',
    variables: [
      { symbol: 'stress', name: 'Stress', value: 200e6, unit: 'Pa', description: 'Applied tensile stress (e.g. 200 MPa)' },
      { symbol: 'strain', name: 'Strain', value: 0.001, unit: '', description: 'Deformation ratio (displacement / original length)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'stress', label: 'Stress (Pa)', min: 1000, max: 1e11, default: 200e6, unit: 'Pa' },
        { name: 'strain', label: 'Strain', min: 1e-6, max: 0.5, default: 0.001, unit: '' }
      ],
      equations: [
        { outputName: 'E', label: 'Elastic Modulus', formula_js: 'stress / strain', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Linear Thermal Expansion',
    description: 'Calculates structural length change under thermal variations.',
    category: 'Materials',
    formula_latex: '\\Delta L = \\alpha \\cdot L_0 \\cdot \\Delta T',
    variables: [
      { symbol: 'alpha', name: 'Expansion Coefficient', value: 16.5e-6, unit: '1/K', description: 'Coefficient of linear expansion (copper = 16.5 ppm)' },
      { symbol: 'L0', name: 'Original Length', value: 2.0, unit: 'm', description: 'Initial length of structural member' },
      { symbol: 'dT', name: 'Delta Temp', value: 30, unit: 'K', description: 'Temperature change differential' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'alpha', label: 'Coeff alpha', min: 1e-7, max: 1e-4, default: 16.5e-6, unit: '1/K' },
        { name: 'L0', label: 'Base Length', min: 0.001, max: 500, default: 2.0, unit: 'm' },
        { name: 'dT', label: 'Delta Temp', min: -100, max: 1000, default: 30, unit: 'K' }
      ],
      equations: [
        { outputName: 'dL', label: 'Expansion Length', formula_js: 'alpha * L0 * dT', unit: 'm' }
      ]
    }
  },
  {
    name: 'Poisson Ratio',
    description: 'Proportional transverse compression to axial expansion strain.',
    category: 'Materials',
    formula_latex: '\\nu = -\\frac{\\epsilon_t}{\\epsilon_a}',
    variables: [
      { symbol: 'et', name: 'Transverse Strain', value: -0.0003, unit: '', description: 'Strain perpendicular to load direction' },
      { symbol: 'ea', name: 'Axial Strain', value: 0.001, unit: '', description: 'Strain parallel to load direction' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'et', label: 'Transverse Strain', min: -0.1, max: 0, default: -0.0003, unit: '' },
        { name: 'ea', label: 'Axial Strain', min: 1e-6, max: 0.5, default: 0.001, unit: '' }
      ],
      equations: [
        { outputName: 'nu', label: 'Poisson Ratio', formula_js: '-et / ea', unit: '' }
      ]
    }
  },
  {
    name: 'Bulk Modulus',
    description: 'Measure of fluid/solid resistance to uniform pressure compression.',
    category: 'Materials',
    formula_latex: 'K = - V_0 \\cdot \\frac{\\Delta P}{\\Delta V}',
    variables: [
      { symbol: 'V0', name: 'Initial Volume', value: 1.0, unit: 'm³', description: 'Original uncompressed volume' },
      { symbol: 'dP', name: 'Pressure Change', value: 1000000, unit: 'Pa', description: 'Volumetric load compression pressure' },
      { symbol: 'dV', name: 'Volume Change', value: -0.0005, unit: 'm³', description: 'Volume change under load' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'V0', label: 'Base Volume', min: 1e-6, max: 1000, default: 1.0, unit: 'm³' },
        { name: 'dP', label: 'Press Delta', min: 10, max: 1e9, default: 1000000, unit: 'Pa' },
        { name: 'dV', label: 'Vol Delta', min: -0.1, max: -1e-8, default: -0.0005, unit: 'm³' }
      ],
      equations: [
        { outputName: 'K', label: 'Bulk Modulus', formula_js: '-V0 * (dP / dV)', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Shear Stress',
    description: 'Force tending to cause deformation of a material by slippage along planes parallel to stress.',
    category: 'Materials',
    formula_latex: '\\tau = \\frac{F_s}{A}',
    variables: [
      { symbol: 'Fs', name: 'Shear Force', value: 15000, unit: 'N', description: 'Applied coplanar shear force' },
      { symbol: 'A', name: 'Shear Area', value: 0.0005, unit: 'm²', description: 'Parallel area resistant to shear' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Fs', label: 'Shear Force', min: 1, max: 1000000, default: 15000, unit: 'N' },
        { name: 'A', label: 'Shear Area', min: 1e-6, max: 0.5, default: 0.0005, unit: 'm²' }
      ],
      equations: [
        { outputName: 'tau', label: 'Shear Stress', formula_js: 'Fs / A', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Flexural Stress (3-Point Bending Beam)',
    description: 'Calculates maximum flexural bending stress on rectangular beam under midpoint load.',
    category: 'Materials',
    formula_latex: '\\sigma_f = \\frac{3 F L}{2 b d^2}',
    variables: [
      { symbol: 'F', name: 'Load Force', value: 500, unit: 'N', description: 'Bending force applied at center' },
      { symbol: 'L', name: 'Span Length', value: 1.2, unit: 'm', description: 'Span length between supports' },
      { symbol: 'b', name: 'Beam width', value: 0.05, unit: 'm', description: 'Rectangular beam width' },
      { symbol: 'd', name: 'Beam depth', value: 0.08, unit: 'm', description: 'Rectangular beam depth/thickness' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'F', label: 'Applied Force', min: 1, max: 50000, default: 500, unit: 'N' },
        { name: 'L', label: 'Span Length', min: 0.05, max: 10, default: 1.2, unit: 'm' },
        { name: 'b', label: 'Width (b)', min: 0.005, max: 1, default: 0.05, unit: 'm' },
        { name: 'd', label: 'Depth (d)', min: 0.005, max: 1, default: 0.08, unit: 'm' }
      ],
      equations: [
        { outputName: 'sigf', label: 'Bending Stress', formula_js: '(3 * F * L) / (2 * b * Math.pow(d, 2))', unit: 'Pa' }
      ]
    }
  },
  {
    name: 'Brinell Hardness Number (BHN)',
    description: 'Calculates indentation hardness value.',
    category: 'Materials',
    formula_latex: '\\text{BHN} = \\frac{2P}{\\pi D (D - \\sqrt{D^2 - d^2})}',
    variables: [
      { symbol: 'P', name: 'Indent Load', value: 3000, unit: 'kgf', description: 'Load applied (kg-force)' },
      { symbol: 'D', name: 'Ball Diameter', value: 10, unit: 'mm', description: 'Diameter of indenter sphere' },
      { symbol: 'd', name: 'Indentation Diameter', value: 3.5, unit: 'mm', description: 'Width of print left by sphere' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'P', label: 'Load (kgf)', min: 1, max: 10000, default: 3000, unit: 'kgf' },
        { name: 'D', label: 'Indenter Diam', min: 1, max: 50, default: 10, unit: 'mm' },
        { name: 'd', label: 'Print Diam', min: 0.1, max: 49, default: 3.5, unit: 'mm' }
      ],
      equations: [
        { outputName: 'bhn', label: 'Hardness BHN', formula_js: 'd >= D ? 0 : (2 * P) / (Math.PI * D * (D - Math.sqrt(Math.pow(D, 2) - Math.pow(d, 2))))', unit: 'kgf/mm²' }
      ]
    }
  },
  {
    name: 'Resistivity of Wire',
    description: 'Calculates resistance based on length, area, and material resistivity.',
    category: 'Materials',
    formula_latex: 'R = \\rho \\cdot \\frac{L}{A}',
    variables: [
      { symbol: 'rho', name: 'Resistivity', value: 1.68e-8, unit: 'Ω·m', description: 'Specific resistivity (copper = 1.68e-8)' },
      { symbol: 'L', name: 'Wire Length', value: 50, unit: 'm', description: 'Length of wire conductor' },
      { symbol: 'A', name: 'Cross Section Area', value: 2.08e-6, unit: 'm²', description: 'Cross section area (14 AWG = 2.08e-6)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'rho', label: 'Material rho', min: 1e-9, max: 1e5, default: 1.68e-8, unit: 'Ω·m' },
        { name: 'L', label: 'Length', min: 0.01, max: 10000, default: 50, unit: 'm' },
        { name: 'A', label: 'Area', min: 1e-9, max: 0.1, default: 2.08e-6, unit: 'm²' }
      ],
      equations: [
        { outputName: 'R', label: 'Resistance', formula_js: 'rho * L / A', unit: 'Ω' }
      ]
    }
  },

  // ─── ELECTROMAGNETISM ──────────────────────────────────────────────────────
  {
    name: "Coulomb's Law",
    description: 'Electrostatic force between two stationary point charges.',
    category: 'Electromagnetism',
    formula_latex: 'F = k_e \\cdot \\frac{q_1 \\cdot q_2}{r^2}',
    variables: [
      { symbol: 'ke', name: 'Coulomb constant', value: 8.98755e9, unit: 'N·m²/C²', description: 'Electrostatic constant' },
      { symbol: 'q1', name: 'Charge 1', value: 1e-6, unit: 'C', description: 'Charge of particle 1 (1 µC)' },
      { symbol: 'q2', name: 'Charge 2', value: -2e-6, unit: 'C', description: 'Charge of particle 2 (-2 µC)' },
      { symbol: 'r', name: 'Distance', value: 0.05, unit: 'm', description: 'Separation distance (5 cm)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'ke', label: 'Coulomb Const', min: 8.9e9, max: 9e9, default: 8.98755e9, unit: 'N·m²/C²' },
        { name: 'q1', label: 'Charge 1', min: -1e-3, max: 1e-3, default: 1e-6, unit: 'C' },
        { name: 'q2', label: 'Charge 2', min: -1e-3, max: 1e-3, default: -2e-6, unit: 'C' },
        { name: 'r', label: 'Distance', min: 0.001, max: 10, default: 0.05, unit: 'm' }
      ],
      equations: [
        { outputName: 'F', label: 'Electrostatic Force', formula_js: 'ke * (q1 * q2) / Math.pow(r, 2)', unit: 'N' }
      ]
    }
  },
  {
    name: 'Lorentz Force',
    description: 'Combined electric and magnetic force on a moving charge.',
    category: 'Electromagnetism',
    formula_latex: 'F_L = q \\cdot (E + v \\cdot B \\cdot \\sin(\\theta))',
    variables: [
      { symbol: 'q', name: 'Charge', value: 1.602e-19, unit: 'C', description: 'Elementary charge' },
      { symbol: 'E', name: 'Electric Field', value: 100, unit: 'V/m', description: 'Electric field strength' },
      { symbol: 'v', name: 'Velocity', value: 1e5, unit: 'm/s', description: 'Speed of moving particle' },
      { symbol: 'B', name: 'Magnetic Field', value: 0.5, unit: 'T', description: 'Magnetic flux density' },
      { symbol: 'theta', name: 'Angle', value: 90, unit: 'deg', description: 'Angle between velocity and magnetic field' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'q', label: 'Charge', min: -1e-12, max: 1e-12, default: 1.602e-19, unit: 'C' },
        { name: 'E', label: 'E Field', min: 0, max: 1000000, default: 100, unit: 'V/m' },
        { name: 'v', label: 'Velocity', min: 0, max: 3e8, default: 1e5, unit: 'm/s' },
        { name: 'B', label: 'B Field', min: 0, max: 20, default: 0.5, unit: 'T' },
        { name: 'theta', label: 'Angle', min: 0, max: 180, default: 90, unit: 'deg' }
      ],
      equations: [
        { outputName: 'FL', label: 'Lorentz Force', formula_js: 'q * (E + v * B * Math.sin(theta * Math.PI / 180))', unit: 'N' }
      ]
    }
  },
  {
    name: 'Magnetic Field of Solenoid',
    description: 'Calculates magnetic flux density inside a long solenoid.',
    category: 'Electromagnetism',
    formula_latex: 'B = \\mu_0 \\cdot \\frac{N}{L} \\cdot I',
    variables: [
      { symbol: 'mu0', name: 'Permeability', value: 1.257e-6, unit: 'H/m', description: 'Vacuum permeability' },
      { symbol: 'N', name: 'Turns count', value: 500, unit: '', description: 'Number of turns of coil wire' },
      { symbol: 'L', name: 'Coil Length', value: 0.2, unit: 'm', description: 'Length of solenoid body' },
      { symbol: 'I', name: 'Current', value: 2, unit: 'A', description: 'Current flowing through solenoid' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'mu0', label: 'Permeability', min: 1e-7, max: 1e-4, default: 1.257e-6, unit: 'H/m' },
        { name: 'N', label: 'Wire Turns', min: 1, max: 10000, default: 500, unit: '' },
        { name: 'L', label: 'Length', min: 0.001, max: 5, default: 0.2, unit: 'm' },
        { name: 'I', label: 'Current', min: 0.001, max: 100, default: 2, unit: 'A' }
      ],
      equations: [
        { outputName: 'B', label: 'Magnetic Field B', formula_js: 'mu0 * (N / L) * I', unit: 'T' }
      ]
    }
  },
  {
    name: 'Self-Inductance of Solenoid',
    description: 'Calculates structural inductance of an air-core solenoid.',
    category: 'Electromagnetism',
    formula_latex: 'L = \\frac{\\mu_0 \\cdot N^2 \\cdot A}{l}',
    variables: [
      { symbol: 'mu0', name: 'Permeability', value: 1.257e-6, unit: 'H/m', description: 'Vacuum permeability constant' },
      { symbol: 'N', name: 'Wire Turns', value: 200, unit: '', description: 'Number of wraps' },
      { symbol: 'A', name: 'Core Area', value: 0.000314, unit: 'm²', description: 'Core cross section area (r = 10mm)' },
      { symbol: 'l', name: 'Solenoid length', value: 0.1, unit: 'm', description: 'Axial length of solenoid' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'mu0', label: 'Permeability', min: 1.2e-6, max: 1.3e-6, default: 1.257e-6, unit: 'H/m' },
        { name: 'N', label: 'Turns count', min: 1, max: 10000, default: 200, unit: '' },
        { name: 'A', label: 'Core Area', min: 1e-6, max: 0.1, default: 0.000314, unit: 'm²' },
        { name: 'l', label: 'Coil Length', min: 0.001, max: 5, default: 0.1, unit: 'm' }
      ],
      equations: [
        { outputName: 'inductance', label: 'Inductance', formula_js: '(mu0 * Math.pow(N, 2) * A) / l', unit: 'H' }
      ]
    }
  },
  {
    name: 'Capacitance of Parallel Plates',
    description: 'Indicates capacitance of two flat parallel conductor plates.',
    category: 'Electromagnetism',
    formula_latex: 'C = \\epsilon_r \\cdot \\epsilon_0 \\cdot \\frac{A}{d}',
    variables: [
      { symbol: 'epsr', name: 'Dielectric Constant', value: 1, unit: '', description: 'Relative permittivity of medium (vacuum/air = 1)' },
      { symbol: 'eps0', name: 'Permittivity of vacuum', value: 8.854e-12, unit: 'F/m', description: 'Vacuum electric permittivity constant' },
      { symbol: 'A', name: 'Plate Area', value: 0.01, unit: 'm²', description: 'Overlapping area of plates (10x10 cm)' },
      { symbol: 'd', name: 'Gap distance', value: 0.001, unit: 'm', description: 'Separation distance (1 mm)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'epsr', label: 'Relative eps', min: 1, max: 10000, default: 1, unit: '' },
        { name: 'eps0', label: 'Vacuum permittivity', min: 8.8e-12, max: 8.9e-12, default: 8.854e-12, unit: 'F/m' },
        { name: 'A', label: 'Plate Area', min: 1e-6, max: 10, default: 0.01, unit: 'm²' },
        { name: 'd', label: 'Gap (d)', min: 1e-6, max: 0.5, default: 0.001, unit: 'm' }
      ],
      equations: [
        { outputName: 'C', label: 'Capacitance', formula_js: 'epsr * eps0 * (A / d)', unit: 'F' }
      ]
    }
  },
  {
    name: 'Magnetic Force on Current Wire',
    description: 'Calculates the magnetic force on a straight segment of wire inside a field.',
    category: 'Electromagnetism',
    formula_latex: 'F = I \\cdot L \\cdot B \\cdot \\sin(\\theta)',
    variables: [
      { symbol: 'I', name: 'Current', value: 5, unit: 'A', description: 'Electrical current in wire' },
      { symbol: 'L', name: 'Wire Length', value: 0.5, unit: 'm', description: 'Length of wire segment inside field' },
      { symbol: 'B', name: 'Field B', value: 0.4, unit: 'T', description: 'Magnetic flux density' },
      { symbol: 'theta', name: 'Angle', value: 90, unit: 'deg', description: 'Angle between current direction and field (deg)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'I', label: 'Current', min: 0, max: 100, default: 5, unit: 'A' },
        { name: 'L', label: 'Wire Length', min: 0.01, max: 10, default: 0.5, unit: 'm' },
        { name: 'B', label: 'Magnetic Field B', min: 0, max: 10, default: 0.4, unit: 'T' },
        { name: 'theta', label: 'Angle', min: 0, max: 180, default: 90, unit: 'deg' }
      ],
      equations: [
        { outputName: 'F', label: 'Magnetic Force', formula_js: 'I * L * B * Math.sin(theta * Math.PI / 180)', unit: 'N' }
      ]
    }
  },
  {
    name: 'Energy Stored in Inductor',
    description: 'Calculates potential energy loaded in magnetic field of inductor.',
    category: 'Electromagnetism',
    formula_latex: 'E_L = \\frac{1}{2} L I^2',
    variables: [
      { symbol: 'L', name: 'Inductance', value: 0.1, unit: 'H', description: 'Inductance value' },
      { symbol: 'I', name: 'Current', value: 3, unit: 'A', description: 'Current flowing through inductor' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'L', label: 'Inductance', min: 1e-6, max: 100, default: 0.1, unit: 'H' },
        { name: 'I', label: 'Current', min: 0, max: 100, default: 3, unit: 'A' }
      ],
      equations: [
        { outputName: 'EL', label: 'Stored Energy', formula_js: '0.5 * L * Math.pow(I, 2)', unit: 'J' }
      ]
    }
  },
  {
    name: 'Energy Stored in Capacitor',
    description: 'Calculates electrostatic potential energy loaded in electrical field of capacitor.',
    category: 'Electromagnetism',
    formula_latex: 'E_C = \\frac{1}{2} C V^2',
    variables: [
      { symbol: 'C', name: 'Capacitance', value: 100e-6, unit: 'F', description: 'Capacitance (100 µF)' },
      { symbol: 'V', name: 'Voltage', value: 12, unit: 'V', description: 'Voltage charge on capacitor' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'C', label: 'Capacitance', min: 1e-12, max: 1, default: 100e-6, unit: 'F' },
        { name: 'V', label: 'Voltage', min: 0, max: 1000, default: 12, unit: 'V' }
      ],
      equations: [
        { outputName: 'EC', label: 'Stored Energy', formula_js: '0.5 * C * Math.pow(V, 2)', unit: 'J' }
      ]
    }
  },

  // ─── CONTROL SYSTEMS ───────────────────────────────────────────────────────
  {
    name: 'Closed-Loop Transfer Function',
    description: 'System feedback loop output response transfer function.',
    category: 'Control Systems',
    formula_latex: 'T(s) = \\frac{G(s)}{1 + G(s) H(s)}',
    variables: [
      { symbol: 'G', name: 'Forward Path Gain', value: 10, unit: '', description: 'Forward gain function value' },
      { symbol: 'H', name: 'Feedback Path Gain', value: 0.5, unit: '', description: 'Feedback gain function value' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'G', label: 'Forward Gain G', min: 0, max: 1000, default: 10, unit: '' },
        { name: 'H', label: 'Feedback Gain H', min: 0, max: 10, default: 0.5, unit: '' }
      ],
      equations: [
        { outputName: 'T', label: 'System Gain T', formula_js: 'G / (1 + G * H)', unit: '' }
      ]
    }
  },
  {
    name: 'Second-Order Damping Ratio',
    description: 'Damping ratio defining decay rate of transient oscillations.',
    category: 'Control Systems',
    formula_latex: '\\zeta = \\frac{c}{2 \\sqrt{k m}}',
    variables: [
      { symbol: 'c', name: 'Damping Coefficient', value: 12, unit: 'N·s/m', description: 'Viscous resistance factor' },
      { symbol: 'k', name: 'Stiffness Constant', value: 100, unit: 'N/m', description: 'System spring rate stiffness' },
      { symbol: 'm', name: 'System Mass', value: 2, unit: 'kg', description: 'Inertia mass' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'c', label: 'Damping Coeff (c)', min: 0, max: 1000, default: 12, unit: 'N·s/m' },
        { name: 'k', label: 'Spring Rate (k)', min: 0.1, max: 10000, default: 100, unit: 'N/m' },
        { name: 'm', label: 'Mass (m)', min: 0.01, max: 500, default: 2, unit: 'kg' }
      ],
      equations: [
        { outputName: 'zeta', label: 'Damping Ratio', formula_js: 'c / (2 * Math.sqrt(k * m))', unit: '' }
      ]
    }
  },
  {
    name: 'Second-Order Natural Frequency',
    description: 'Resonance oscillation frequency of system without damping.',
    category: 'Control Systems',
    formula_latex: '\\omega_n = \\sqrt{\\frac{k}{m}}',
    variables: [
      { symbol: 'k', name: 'Spring Stiffness', value: 200, unit: 'N/m', description: 'Restoring spring stiffness coefficient' },
      { symbol: 'm', name: 'Moving Mass', value: 0.5, unit: 'kg', description: 'Inertia mass' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'k', label: 'Stiffness k', min: 0.1, max: 50000, default: 200, unit: 'N/m' },
        { name: 'm', label: 'Mass m', min: 0.001, max: 100, default: 0.5, unit: 'kg' }
      ],
      equations: [
        { outputName: 'omegan', label: 'Natural Freq (rad/s)', formula_js: 'Math.sqrt(k / m)', unit: 'rad/s' },
        { outputName: 'fn', label: 'Natural Freq (Hz)', formula_js: 'Math.sqrt(k / m) / (2 * Math.PI)', unit: 'Hz' }
      ]
    }
  },
  {
    name: 'Steady-State Error (Step Input)',
    description: 'System output error offset relative to setpoint after transients die down.',
    category: 'Control Systems',
    formula_latex: 'e_{ss} = \\frac{1}{1 + K_p}',
    variables: [
      { symbol: 'Kp', name: 'Position Error Constant', value: 9, unit: '', description: 'System static open loop position gain limit' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Kp', label: 'Static Gain Kp', min: 0, max: 1000, default: 9, unit: '' }
      ],
      equations: [
        { outputName: 'ess', label: 'Steady-State Error', formula_js: '1 / (1 + Kp)', unit: '' }
      ]
    }
  },
  {
    name: 'PID Controller Output (Ideal Parallel)',
    description: 'Instantaneous feedback control output calculation.',
    category: 'Control Systems',
    formula_latex: 'u = K_p \\cdot e + K_i \\cdot e_{int} + K_d \\cdot e_{der}',
    variables: [
      { symbol: 'Kp', name: 'Proportional gain', value: 2.5, unit: '', description: 'Proportional gain coefficient' },
      { symbol: 'Ki', name: 'Integral gain', value: 0.8, unit: '', description: 'Integral gain coefficient' },
      { symbol: 'Kd', name: 'Derivative gain', value: 0.1, unit: '', description: 'Derivative gain coefficient' },
      { symbol: 'e', name: 'Error', value: 5.0, unit: '', description: 'Current feedback error (setpoint - feedback)' },
      { symbol: 'eint', name: 'Accumulated Error', value: 10.0, unit: '', description: 'Integrated error accumulation over time' },
      { symbol: 'eder', name: 'Error Derivative', value: -1.2, unit: '', description: 'Rate of error change' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Kp', label: 'Proportional Kp', min: 0, max: 100, default: 2.5, unit: '' },
        { name: 'Ki', label: 'Integral Ki', min: 0, max: 50, default: 0.8, unit: '' },
        { name: 'Kd', label: 'Derivative Kd', min: 0, max: 50, default: 0.1, unit: '' },
        { name: 'e', label: 'Error', min: -100, max: 100, default: 5, unit: '' },
        { name: 'eint', label: 'Error Integral', min: -1000, max: 1000, default: 10, unit: '' },
        { name: 'eder', label: 'Error Derivative', min: -100, max: 100, default: -1.2, unit: '' }
      ],
      equations: [
        { outputName: 'u', label: 'PID Output', formula_js: 'Kp * e + Ki * eint + Kd * eder', unit: '' }
      ]
    }
  },
  {
    name: 'Control Peak Time (2nd Order)',
    description: 'Calculates time required for response to reach the first peak of overshoot.',
    category: 'Control Systems',
    formula_latex: 't_p = \\frac{\\pi}{\\omega_n \\sqrt{1 - \\zeta^2}}',
    variables: [
      { symbol: 'wn', name: 'Natural Frequency', value: 5.0, unit: 'rad/s', description: 'Undamped natural frequency' },
      { symbol: 'zeta', name: 'Damping Ratio', value: 0.4, unit: '', description: 'Damping ratio factor (< 1.0 underdamped)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'wn', label: 'Natural Freq wn', min: 0.1, max: 100, default: 5, unit: 'rad/s' },
        { name: 'zeta', label: 'Damping Ratio', min: 0.01, max: 0.99, default: 0.4, unit: '' }
      ],
      equations: [
        { outputName: 'tp', label: 'Peak Time', formula_js: 'Math.PI / (wn * Math.sqrt(1 - Math.pow(zeta, 2)))', unit: 's' }
      ]
    }
  },
  {
    name: 'Control Settling Time (2% Criterion)',
    description: 'Time required for response amplitude to settle within 2% of final value.',
    category: 'Control Systems',
    formula_latex: 't_s = \\frac{4}{\\zeta \\cdot \\omega_n}',
    variables: [
      { symbol: 'wn', name: 'Natural Frequency', value: 5.0, unit: 'rad/s', description: 'Undamped natural frequency' },
      { symbol: 'zeta', name: 'Damping Ratio', value: 0.4, unit: '', description: 'Damping ratio factor (< 1.0 underdamped)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'wn', label: 'Natural Freq wn', min: 0.1, max: 100, default: 5, unit: 'rad/s' },
        { name: 'zeta', label: 'Damping Ratio', min: 0.01, max: 0.99, default: 0.4, unit: '' }
      ],
      equations: [
        { outputName: 'ts', label: 'Settling Time', formula_js: '4 / (zeta * wn)', unit: 's' }
      ]
    }
  },
  {
    name: 'Control Maximum Percent Overshoot',
    description: 'Percentage peak value deviation from final target value during transient response.',
    category: 'Control Systems',
    formula_latex: 'M_p = 100 \\cdot e^{-\\frac{\\pi \\zeta}{\\sqrt{1 - \\zeta^2}}}',
    variables: [
      { symbol: 'zeta', name: 'Damping Ratio', value: 0.4, unit: '', description: 'Damping ratio factor (< 1.0 underdamped)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'zeta', label: 'Damping Ratio', min: 0.01, max: 0.99, default: 0.4, unit: '' }
      ],
      equations: [
        { outputName: 'Mp', label: 'Max Overshoot', formula_js: '100 * Math.exp(-(Math.PI * zeta) / Math.sqrt(1 - Math.pow(zeta, 2)))', unit: '%' }
      ]
    }
  },

  // ─── RF & ANTENNAS ─────────────────────────────────────────────────────────
  {
    name: 'Friis Transmission Link Equation',
    description: 'Calculates power received by an antenna at a distance from a transmitter.',
    category: 'RF & Antennas',
    formula_latex: 'P_r = P_t \\cdot G_t \\cdot G_r \\cdot \\left(\\frac{\\lambda}{4\\pi d}\\right)^2',
    variables: [
      { symbol: 'Pt', name: 'Transmit Power', value: 1, unit: 'W', description: 'RF power fed into transmit antenna' },
      { symbol: 'Gt', name: 'TX Gain (linear)', value: 2.15, unit: '', description: 'Gain of transmit antenna' },
      { symbol: 'Gr', name: 'RX Gain (linear)', value: 2.15, unit: '', description: 'Gain of receive antenna' },
      { symbol: 'f', name: 'Signal Frequency', value: 2.4e9, unit: 'Hz', description: 'Carrier signal frequency (e.g. 2.4 GHz WiFi)' },
      { symbol: 'd', name: 'Separation Distance', value: 100, unit: 'm', description: 'Distance between antennas' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Pt', label: 'TX Power (W)', min: 1e-6, max: 1000, default: 1, unit: 'W' },
        { name: 'Gt', label: 'TX Gain', min: 1, max: 10000, default: 2.15, unit: '' },
        { name: 'Gr', label: 'RX Gain', min: 1, max: 10000, default: 2.15, unit: '' },
        { name: 'f', label: 'Frequency', min: 100000, max: 1e11, default: 2.4e9, unit: 'Hz' },
        { name: 'd', label: 'Distance', min: 0.1, max: 1000000, default: 100, unit: 'm' }
      ],
      equations: [
        { outputName: 'lambda', label: 'Wavelength', formula_js: '299792458 / f', unit: 'm' },
        { outputName: 'Pr', label: 'RX Power', formula_js: 'Pt * Gt * Gr * Math.pow((299792458 / f) / (4 * Math.PI * d), 2)', unit: 'W' }
      ]
    }
  },
  {
    name: 'Free Space Path Loss (FSPL)',
    description: 'Signal attenuation across line-of-sight path in vacuum.',
    category: 'RF & Antennas',
    formula_latex: '\\text{FSPL} = \\left(\\frac{4 \\pi d f}{c}\\right)^2',
    variables: [
      { symbol: 'd', name: 'Distance', value: 1000, unit: 'm', description: 'Separation distance (1 km)' },
      { symbol: 'f', name: 'Frequency', value: 915e6, unit: 'Hz', description: 'Carrier frequency (915 MHz LoRa)' },
      { symbol: 'c', name: 'Speed of Light', value: 299792458, unit: 'm/s', description: 'Speed of electromagnetic waves' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'd', label: 'Distance', min: 0.1, max: 10000000, default: 1000, unit: 'm' },
        { name: 'f', label: 'Frequency', min: 100000, max: 1e11, default: 915e6, unit: 'Hz' },
        { name: 'c', label: 'Light Speed', min: 299792458, max: 299792458, default: 299792458, unit: 'm/s' }
      ],
      equations: [
        { outputName: 'fspl', label: 'Path Loss Ratio', formula_js: 'Math.pow((4 * Math.PI * d * f) / c, 2)', unit: '' },
        { outputName: 'fspl_dB', label: 'Path Loss (dB)', formula_js: '10 * (Math.log(Math.pow((4 * Math.PI * d * f) / c, 2)) / Math.log(10))', unit: 'dB' }
      ]
    }
  },
  {
    name: 'VSWR from Reflection Coefficient',
    description: 'Voltage Standing Wave Ratio measuring impedance match efficiency.',
    category: 'RF & Antennas',
    formula_latex: '\\text{VSWR} = \\frac{1 + |\\Gamma|}{1 - |\\Gamma|}',
    variables: [
      { symbol: 'gamma', name: 'Reflection magnitude', value: 0.2, unit: '', description: 'Amplitude magnitude of reflection coefficient (0 to 1)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'gamma', label: 'Reflect Coeff', min: 0, max: 0.999, default: 0.2, unit: '' }
      ],
      equations: [
        { outputName: 'vswr', label: 'VSWR', formula_js: '(1 + gamma) / (1 - gamma)', unit: ':1' }
      ]
    }
  },
  {
    name: 'Reflection Coefficient from Impedance',
    description: 'Reflection coefficient Gamma at load interface.',
    category: 'RF & Antennas',
    formula_latex: '\\Gamma = \\frac{Z_L - Z_0}{Z_L + Z_0}',
    variables: [
      { symbol: 'ZL', name: 'Load Impedance', value: 75, unit: 'Ω', description: 'Impedance of the load terminal' },
      { symbol: 'Z0', name: 'Line Impedance', value: 50, unit: 'Ω', description: 'Characteristic line impedance' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'ZL', label: 'Load Impedance', min: 0.1, max: 10000, default: 75, unit: 'Ω' },
        { name: 'Z0', label: 'Line Impedance', min: 0.1, max: 1000, default: 50, unit: 'Ω' }
      ],
      equations: [
        { outputName: 'gamma', label: 'Reflection Gamma', formula_js: '(ZL - Z0) / (ZL + Z0)', unit: '' }
      ]
    }
  },
  {
    name: 'Antenna Aperture Gain',
    description: 'Calculates maximum gain of aperture antenna.',
    category: 'RF & Antennas',
    formula_latex: 'G = \\frac{4 \\pi A_{eff}}{\\lambda^2}',
    variables: [
      { symbol: 'Aeff', name: 'Effective Area', value: 0.1, unit: 'm²', description: 'Effective physical aperture area' },
      { symbol: 'f', name: 'Frequency', value: 5.8e9, unit: 'Hz', description: 'RF frequency (5.8 GHz ISM)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Aeff', label: 'Aperture Area', min: 1e-4, max: 100, default: 0.1, unit: 'm²' },
        { name: 'f', label: 'Frequency', min: 1e6, max: 1e11, default: 5.8e9, unit: 'Hz' }
      ],
      equations: [
        { outputName: 'lambda', label: 'Wavelength', formula_js: '299792458 / f', unit: 'm' },
        { outputName: 'G', label: 'Linear Gain', formula_js: '(4 * Math.PI * Aeff) / Math.pow(299792458 / f, 2)', unit: '' },
        { outputName: 'GdB', label: 'Gain (dBi)', formula_js: '10 * (Math.log((4 * Math.PI * Aeff) / Math.pow(299792458 / f, 2)) / Math.log(10))', unit: 'dBi' }
      ]
    }
  },
  {
    name: 'Antenna Beamwidth Estimate',
    description: 'Half-Power Beamwidth (HPBW) estimation for a parabolic reflector.',
    category: 'RF & Antennas',
    formula_latex: '\\text{HPBW} = 70 \\cdot \\frac{\\lambda}{D}',
    variables: [
      { symbol: 'f', name: 'Frequency', value: 10e9, unit: 'Hz', description: 'RF frequency (10 GHz X-band)' },
      { symbol: 'D', name: 'Reflector Diameter', value: 0.6, unit: 'm', description: 'Physical diameter of parabolic dish' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'f', label: 'Frequency', min: 1e6, max: 1e11, default: 10e9, unit: 'Hz' },
        { name: 'D', label: 'Dish Diameter', min: 0.05, max: 50, default: 0.6, unit: 'm' }
      ],
      equations: [
        { outputName: 'lambda', label: 'Wavelength', formula_js: '299792458 / f', unit: 'm' },
        { outputName: 'hpbw', label: 'Beamwidth Angle', formula_js: '70 * (299792458 / f) / D', unit: 'deg' }
      ]
    }
  },
  {
    name: 'Quarter-Wave Transformer Match',
    description: 'Impedance matching line matching a load ZL to transmission line Z0.',
    category: 'RF & Antennas',
    formula_latex: 'Z_{match} = \\sqrt{Z_{in} \\cdot Z_L}',
    variables: [
      { symbol: 'Zin', name: 'Input target Z', value: 50, unit: 'Ω', description: 'Target matched input impedance' },
      { symbol: 'ZL', name: 'Load Impedance ZL', value: 100, unit: 'Ω', description: 'Impedance of terminating load' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'Zin', label: 'Input Target', min: 1, max: 10000, default: 50, unit: 'Ω' },
        { name: 'ZL', label: 'Load Impedance', min: 1, max: 10000, default: 100, unit: 'Ω' }
      ],
      equations: [
        { outputName: 'Zmatch', label: 'Transformer Z', formula_js: 'Math.sqrt(Zin * ZL)', unit: 'Ω' }
      ]
    }
  },
  {
    name: 'Microstrip Line Characteristic Impedance',
    description: 'Estimated characteristic impedance of a PCB microstrip line trace.',
    category: 'RF & Antennas',
    formula_latex: 'Z_0 = \\frac{87}{\\sqrt{\\epsilon_r + 1.41}} \\cdot \\ln\\left(\\frac{5.98 h}{0.8 w + t}\\right)',
    variables: [
      { symbol: 'epsr', name: 'FR4 Dielectric', value: 4.4, unit: '', description: 'Relative permittivity of substrate (e.g. FR4 = 4.4)' },
      { symbol: 'h', name: 'Substrate Height', value: 1.6, unit: 'mm', description: 'Substrate thickness (e.g. 1.6mm PCB)' },
      { symbol: 'w', name: 'Trace Width', value: 3.0, unit: 'mm', description: 'Width of copper conductor trace' },
      { symbol: 't', name: 'Trace Thickness', value: 0.035, unit: 'mm', description: 'Thickness of copper cladding (e.g. 1oz = 35um)' }
    ],
    can_make_interactive: true,
    parameter_playground_config: {
      parameters: [
        { name: 'epsr', label: 'Dielectric epsr', min: 1, max: 20, default: 4.4, unit: '' },
        { name: 'h', label: 'Height (h)', min: 0.05, max: 5, default: 1.6, unit: 'mm' },
        { name: 'w', label: 'Width (w)', min: 0.05, max: 10, default: 3, unit: 'mm' },
        { name: 't', label: 'Thick (t)', min: 0.005, max: 0.5, default: 0.035, unit: 'mm' }
      ],
      equations: [
        { outputName: 'Z0', label: 'Trace Impedance', formula_js: '(87 / Math.sqrt(epsr + 1.41)) * Math.log((5.98 * h) / (0.8 * w + t))', unit: 'Ω' }
      ]
    }
  }
]
