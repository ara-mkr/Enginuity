export const mechanicalTemplates = [
  {
    id: 'openscad-enclosure',
    name: 'OpenSCAD Parametric Enclosure',
    tagline: 'A fully parametric 3D-printable project enclosure in OpenSCAD.',
    category: 'Mechanical',
    difficulty: 'beginner',
    estimatedHours: 2,
    tags: ['3D Printing', 'CAD', 'OpenSCAD', 'Enclosure', 'Parametric'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="44" y="32" width="192" height="96" rx="6" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="72" cy="56" r="6" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="208" cy="56" r="6" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="72" cy="104" r="6" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="208" cy="104" r="6" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="72" cy="56" r="2.5" fill="#6b6d85"/>
  <circle cx="208" cy="56" r="2.5" fill="#6b6d85"/>
  <circle cx="72" cy="104" r="2.5" fill="#6b6d85"/>
  <circle cx="208" cy="104" r="3" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'A customized case designed for electronics. Modify length, width, height, and wall thickness to fit any circuit board setup.',
      tags: ['OpenSCAD', 'ParametricEnclosure', '3DPrinting', 'MechanicalDesign']
    },
    parameterPlayground: {
      description: 'Adjust box dimensions and wall thicknesses for 3D printing clearances.',
      parameters: [
        { name: 'length', label: 'Box Length (X)', min: 30, max: 200, default: 80, unit: 'mm' },
        { name: 'width', label: 'Box Width (Y)', min: 30, max: 200, default: 60, unit: 'mm' },
        { name: 'height', label: 'Box Height (Z)', min: 15, max: 100, default: 35, unit: 'mm' },
        { name: 'wall_thickness', label: 'Wall Thickness', min: 1.2, max: 5.0, default: 2.0, unit: 'mm' }
      ],
      equations: [
        { outputName: 'inner_length', label: 'Internal Length', formula_js: 'length - wall_thickness * 2', unit: 'mm' },
        { outputName: 'inner_width', label: 'Internal Width', formula_js: 'width - wall_thickness * 2', unit: 'mm' },
        { outputName: 'material_volume', label: 'Approx Material Vol', formula_js: 'length * width * height - (length - wall_thickness * 2) * (width - wall_thickness * 2) * (height - wall_thickness)', unit: 'mm³' }
      ]
    },
    starterCode: {
      language: 'scad',
      filename: 'enclosure.scad',
      content: `// Parametric Electronics Enclosure Box
length = 80;
width = 60;
height = 35;
wall_thickness = 2.0;
corner_radius = 4.0;

module rounded_box(l, w, h, r) {
    translate([r, r, 0])
    minkowski() {
        cube([l - r*2, w - r*2, h - 1]);
        cylinder(r=r, h=1, $fn=32);
    }
}

difference() {
    // Outer Shell
    rounded_box(length, width, height, corner_radius);

    // Inner Cavity
    translate([wall_thickness, wall_thickness, wall_thickness])
    rounded_box(length - wall_thickness*2, width - wall_thickness*2, height, corner_radius - wall_thickness/2);

    // Lid lip cut (simplified)
    translate([wall_thickness/2, wall_thickness/2, height - wall_thickness/2])
    rounded_box(length - wall_thickness, width - wall_thickness, wall_thickness, corner_radius - wall_thickness/4);
}`
    },
    bomStarter: [
      { quantity: 4, description: 'M3 Threaded Brass Heat-Set Inserts', value: 'M3x4mm', package: 'Brass-Insert', notes: 'Melted into corner mounts' },
      { quantity: 4, description: 'M3 Button Head Hex Screws', value: 'M3x10mm', package: 'Screw', notes: 'Secures top lid to inserts' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Material Selection for Enclosure', content: 'Chose PETG filament over PLA for better heat resistance and elasticity, ensuring clip-fit tabs do not snap.' }
    ],
    resources: [
      { title: 'OpenSCAD Cheat Sheet', url: 'https://openscad.org/cheatsheet/', type: 'reference' }
    ]
  },
  {
    id: 'gear-train',
    name: 'Spur Gear Ratio Train',
    tagline: 'Speed and center distance solver for a two-gear spur assembly.',
    category: 'Mechanical',
    difficulty: 'beginner',
    estimatedHours: 2,
    tags: ['Gears', 'Kinematics', 'Spur Gear', 'Mechanism', 'Pitch'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="96" cy="80" r="48" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="96" cy="80" r="36" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5" stroke-dasharray="6 3"/>
  <circle cx="96" cy="80" r="6" fill="#6b6d85"/>
  <circle cx="200" cy="80" r="30" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="200" cy="80" r="22" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5" stroke-dasharray="5 3"/>
  <circle cx="200" cy="80" r="4" fill="#1a1a2e" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="200" cy="80" r="3" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'A kinematics solver that computes spur gear geometry, pitch diameters, speed ratios, and axis center distances based on module and tooth count.',
      tags: ['Gears', 'SpurGears', 'GearRatio', 'CenterDistance']
    },
    parameterPlayground: {
      description: 'Adjust module, pinion size, and gear size to solve matching spacing.',
      parameters: [
        { name: 'module_val', label: 'Gear Module (m)', min: 0.5, max: 5.0, default: 1.5, unit: 'mm' },
        { name: 'teeth_pinion', label: 'Pinion Teeth (N1)', min: 8, max: 40, default: 12, unit: 'T' },
        { name: 'teeth_gear', label: 'Gear Teeth (N2)', min: 10, max: 120, default: 36, unit: 'T' },
        { name: 'input_rpm', label: 'Pinion Input Speed', min: 10, max: 5000, default: 1000, unit: 'RPM' }
      ],
      equations: [
        { outputName: 'gear_ratio', label: 'Gear Ratio', formula_js: 'teeth_gear / teeth_pinion', unit: ':1' },
        { outputName: 'center_distance', label: 'Center Distance', formula_js: 'module_val * (teeth_pinion + teeth_gear) / 2', unit: 'mm' },
        { outputName: 'output_rpm', label: 'Output Speed', formula_js: 'input_rpm / (teeth_gear / teeth_pinion)', unit: 'RPM' }
      ]
    },
    starterCode: {
      language: 'python',
      filename: 'gear_geometry.py',
      content: `# Spur Gear Geometry Solver
import math

def calculate_spur_gears(m, N1, N2, rpm_in):
    dp1 = m * N1  # Pitch diameter pinion
    dp2 = m * N2  # Pitch diameter gear

    ratio = N2 / N1
    rpm_out = rpm_in / ratio
    center_dist = (dp1 + dp2) / 2.0

    print(f"Pinion Pitch Dia: {dp1:.2f} mm")
    print(f"Gear Pitch Dia:   {dp2:.2f} mm")
    print(f"Gear Ratio:       {ratio:.2f}:1")
    print(f"Center Distance:  {center_dist:.2f} mm")
    print(f"Output Speed:     {rpm_out:.2f} RPM")

calculate_spur_gears(1.5, 12, 36, 1000)`
    },
    bomStarter: [
      { quantity: 1, description: '12T Brass Pinion Gear 1.5M', value: '12T 6mm Bore', package: 'Gear', notes: 'Input motor shaft mount' },
      { quantity: 1, description: '36T Steel Spur Gear 1.5M', value: '36T 8mm Bore', package: 'Gear', notes: 'Output shaft mount' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Tooth Count Selection', content: 'Selected N1=12 and N2=36 to achieve an exact 3:1 speed reduction while keeping the outer diameters small enough for our enclosure.' }
    ],
    resources: [
      { title: 'Standard Spur Gear Math', url: 'https://www.geargenerator.com/', type: 'reference' }
    ]
  },
  {
    id: 'cantilever-deflection',
    name: 'Cantilever Deflection Solver',
    tagline: 'Deflection and bending stress estimator for point-loaded cantilever beams.',
    category: 'Mechanical',
    difficulty: 'intermediate',
    estimatedHours: 3,
    tags: ['FEA', 'Solid Mechanics', 'Beam', 'Bending', 'Stress'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="52" width="16" height="56" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="8" y1="52" x2="44" y2="52" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="8" y1="60" x2="36" y2="60" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="8" y1="68" x2="36" y2="68" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="8" y1="76" x2="36" y2="76" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="8" y1="84" x2="36" y2="84" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="8" y1="92" x2="44" y2="92" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="36" y1="72" x2="260" y2="72" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="36" y1="80" x2="260" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <path d="M260,76 C240,76 200,80 180,100" stroke="#6b6d85" stroke-width="1" stroke-dasharray="4 3" fill="none"/>
  <line x1="260" y1="76" x2="260" y2="108" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="252" y1="108" x2="268" y2="108" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="255" y1="113" x2="265" y2="113" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="258" y1="118" x2="262" y2="118" stroke="#94a3b8" stroke-width="1.5"/>
</svg>`,
    projectContext: {
      description: 'Solid mechanics solver computing the maximum bending deflection and bending stress at the fixed root of a rectangular cantilever beam under a concentrated end-load.',
      tags: ['MechanicsOfMaterials', 'CantileverBeam', 'Deflection', 'BendingStress']
    },
    parameterPlayground: {
      description: 'Evaluate structural stiffness based on dimensions and material properties.',
      parameters: [
        { name: 'length_mm', label: 'Beam Length (L)', min: 10, max: 1000, default: 250, unit: 'mm' },
        { name: 'width_mm', label: 'Beam Width (b)', min: 2, max: 100, default: 20, unit: 'mm' },
        { name: 'height_mm', label: 'Beam Height (h)', min: 2, max: 100, default: 10, unit: 'mm' },
        { name: 'force_n', label: 'End Load (F)', min: 1, max: 5000, default: 100, unit: 'N' },
        { name: 'young_gpa', label: 'Young Modulus (E)', min: 1, max: 250, default: 69, unit: 'GPa' }
      ],
      equations: [
        { outputName: 'inertia_mm4', label: 'Inertia (I = bh³/12)', formula_js: '(width_mm * Math.pow(height_mm, 3)) / 12', unit: 'mm⁴' },
        { outputName: 'max_deflection_mm', label: 'Max Deflection (FL³ / 3EI)', formula_js: '(force_n * Math.pow(length_mm, 3)) / (3 * (young_gpa * 1000) * ((width_mm * Math.pow(height_mm, 3)) / 12))', unit: 'mm' },
        { outputName: 'bending_stress_mpa', label: 'Max Bending Stress (My/I)', formula_js: '(force_n * length_mm * (height_mm / 2)) / ((width_mm * Math.pow(height_mm, 3)) / 12)', unit: 'MPa' }
      ]
    },
    starterCode: {
      language: 'python',
      filename: 'beam_deflection.py',
      content: `# Rectangular Cantilever Beam Solver
def solve_beam(L, b, h, F, E_gpa):
    E_mpa = E_gpa * 1000.0
    # Moment of inertia for rectangle
    I = (b * (h ** 3)) / 12.0
    # Deflection at tip
    delta_max = (F * (L ** 3)) / (3.0 * E_mpa * I)
    # Stress at root
    sigma_max = (F * L * (h / 2.0)) / I

    print(f"Area Moment of Inertia: {I:.1f} mm^4")
    print(f"Max Tip Deflection:     {delta_max:.4f} mm")
    print(f"Max Root Bending Stress: {sigma_max:.2f} MPa")

solve_beam(250.0, 20.0, 10.0, 100.0, 69.0) # 69 GPa = Aluminum 6061`
    },
    bomStarter: [
      { quantity: 1, description: 'Aluminum 6061-T6 Flat Bar stock', value: '20mm x 10mm x 1m', package: 'Metal Stock', notes: 'Raw material for beam' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Material Stiffness Selection', content: 'Chose Aluminum 6061-T6 over Structural Steel to keep self-weight low while accepting slightly higher deflection under maximum load.' }
    ],
    resources: [
      { title: 'Standard Deflection Tables', url: 'https://www.engineeringtoolbox.com/cantilever-beams-d_1848.html', type: 'reference' }
    ]
  },
  {
    id: 'motor-stress',
    name: 'Motor Shaft Torsion Solver',
    tagline: 'Torsional shear stress and safety factor analysis for motor drive shafts.',
    category: 'Mechanical',
    difficulty: 'intermediate',
    estimatedHours: 3,
    tags: ['Torsion', 'Shear', 'Shaft', 'Safety Factor', 'Motors'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="68" width="240" height="24" rx="4" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="44" cy="80" r="28" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="44" cy="80" r="10" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <path d="M140,54 C150,58 150,102 140,106" stroke="#94a3b8" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M156,50 C170,56 170,104 156,110" stroke="#94a3b8" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <line x1="140" y1="54" x2="148" y2="46" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="156" y1="50" x2="164" y2="42" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
    projectContext: {
      description: 'Calculates torque from motor horsepower/RPM ratings and estimates torsional shear stress along the outer boundary of a solid circular transmission shaft.',
      tags: ['Torsion', 'DriveShaft', 'ShearStress', 'SafetyFactor']
    },
    parameterPlayground: {
      description: 'Evaluate shaft diameter constraints against material yield strength.',
      parameters: [
        { name: 'power_w', label: 'Motor Power', min: 10, max: 100000, default: 750, unit: 'W' },
        { name: 'rpm', label: 'Shaft Speed', min: 100, max: 10000, default: 3000, unit: 'RPM' },
        { name: 'diameter_mm', label: 'Shaft Diameter', min: 2, max: 100, default: 12, unit: 'mm' },
        { name: 'yield_strength_mpa', label: 'Yield Strength (τ_y)', min: 20, max: 800, default: 250, unit: 'MPa' }
      ],
      equations: [
        { outputName: 'torque_nm', label: 'Shaft Torque', formula_js: 'power_w / (2 * Math.PI * rpm / 60)', unit: 'N·m' },
        { outputName: 'shear_stress_mpa', label: 'Torsional Stress (16T/πd³)', formula_js: '(16 * (power_w / (2 * Math.PI * rpm / 60)) * 1000) / (Math.PI * Math.pow(diameter_mm, 3))', unit: 'MPa' },
        { outputName: 'safety_factor', label: 'Yield Safety Factor', formula_js: 'yield_strength_mpa / ((16 * (power_w / (2 * Math.PI * rpm / 60)) * 1000) / (Math.PI * Math.pow(diameter_mm, 3)))', unit: 'x' }
      ]
    },
    starterCode: {
      language: 'python',
      filename: 'shaft_torsion.py',
      content: `# Motor Shaft Torsional Shear Calculator
import math

def calculate_shaft(power_w, rpm, dia_mm, yield_mpa):
    omega = 2 * math.pi * rpm / 60.0
    torque = power_w / omega

    # Polar moment of inertia J = pi*d^4/32
    J = (math.pi * (dia_mm ** 4)) / 32.0
    # Outer radius c
    c = dia_mm / 2.0
    # Max shear stress tau = T * c / J (equivalent to 16T / pi*d^3)
    tau = (torque * 1000.0 * c) / J

    safety = yield_mpa / tau

    print(f"Torque:         {torque:.3f} N-m")
    print(f"Shear Stress:   {tau:.2f} MPa")
    print(f"Safety Factor:  {safety:.2f}x")

calculate_shaft(750, 3000, 12, 250)`
    },
    bomStarter: [
      { quantity: 1, description: 'Keyed carbon steel rod shaft', value: '12mm OD x 300mm', package: 'Shaft stock', notes: 'Medium carbon steel 1045' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Shaft Diameter Adjustment', content: 'Increased shaft diameter from 10mm to 12mm to push the torsion safety factor above 2.5x under stall torque peaks.' }
    ],
    resources: [
      { title: 'Torsional Stress Reference', url: 'https://www.engineeringtoolbox.com/torsion-shafts-d_947.html', type: 'reference' }
    ]
  },
  {
    id: 'drone-frame',
    name: 'Quadcopter Frame Sizing',
    tagline: 'Thrust-to-weight and span solver for custom quadcopter frames.',
    category: 'Mechanical',
    difficulty: 'advanced',
    estimatedHours: 6,
    tags: ['Aerodynamics', 'Drone', 'UAV', 'Frame Sizing', 'Thrust'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="48" y1="48" x2="232" y2="112" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="48" y1="112" x2="232" y2="48" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="48" cy="48" r="18" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="232" cy="48" r="18" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="48" cy="112" r="18" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="232" cy="112" r="18" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="122" y="62" width="36" height="36" rx="4" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'Calculates the spatial dimensions, layout footprint, and critical thrust-to-weight ratios of carbon-fiber quadcopter drone frames.',
      tags: ['DroneDesign', 'QuadcopterFrame', 'ThrustCalculation', 'UAVPhysics']
    },
    parameterPlayground: {
      description: 'Optimize arm length against propeller diameter and weight targets.',
      parameters: [
        { name: 'arm_length_mm', label: 'Arm Length (Center to Motor)', min: 100, max: 600, default: 220, unit: 'mm' },
        { name: 'motor_thrust_g', label: 'Max Thrust Per Motor', min: 100, max: 4000, default: 1200, unit: 'g' },
        { name: 'drone_weight_g', label: 'Total Takeoff Weight', min: 200, max: 5000, default: 1500, unit: 'g' }
      ],
      equations: [
        { outputName: 'total_thrust_g', label: 'Total Output Thrust', formula_js: 'motor_thrust_g * 4', unit: 'g' },
        { outputName: 'thrust_to_weight', label: 'Thrust-to-Weight Ratio', formula_js: '(motor_thrust_g * 4) / drone_weight_g', unit: ':1' },
        { outputName: 'prop_max_dia_inch', label: 'Max Propeller Diameter', formula_js: '((arm_length_mm * Math.sqrt(2)) / 25.4) - 0.5', unit: 'inch' }
      ]
    },
    starterCode: {
      language: 'python',
      filename: 'drone_calculator.py',
      content: `# UAV Design Helper: Quadcopter Sizing
import math

def analyze_drone(arm_len, max_t_motor, total_w):
    total_thrust = max_t_motor * 4
    tw_ratio = total_thrust / total_w

    # Motor to motor diagonal span
    diagonal_span = arm_len * 2
    # Propeller limit to prevent central overlapping
    max_prop_dia_mm = arm_len * math.sqrt(2) - 20
    max_prop_inch = max_prop_dia_mm / 25.4

    print(f"Diagonal Motor-to-Motor: {diagonal_span:.1f} mm")
    print(f"Max Prop Diameter:       {max_prop_inch:.1f} inches")
    print(f"Thrust-to-Weight Ratio:  {tw_ratio:.2f}:1")
    if tw_ratio < 2.0:
        print("WARNING: Low thrust-to-weight ratio. Target at least 2.0 for stable flight.")

analyze_drone(220.0, 1200.0, 1500.0)`
    },
    bomStarter: [
      { quantity: 4, description: 'Quadcopter Carbon Fiber Arm Plates', value: '4mm Matte Plate', package: 'Carbon stock', notes: 'Laser-cut arms' },
      { quantity: 4, description: 'Brushless DC Outrunner Motor', value: '2306 2400KV', package: 'Motor', notes: 'Propulsion motor' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Carbon Plate Thickness', content: 'Selected 4mm carbon plates for arms instead of 3mm to absorb high mechanical vibration from 2306 motors during tight corners.' }
    ],
    resources: [
      { title: 'Quadcopter Design Principles', url: 'https://www.ecalc.ch/', type: 'reference' }
    ]
  },
  {
    id: 'heat-sink',
    name: 'MOSFET Thermal Heat Sink Sizing',
    tagline: 'Calculate required heat sink thermal resistance for power switches.',
    category: 'Mechanical',
    difficulty: 'intermediate',
    estimatedHours: 4,
    tags: ['Thermal', 'Heat Transfer', 'Heat Sink', 'MOSFET', 'Cooling'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="60" y1="30" x2="60" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="88" y1="30" x2="88" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="116" y1="30" x2="116" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="144" y1="30" x2="144" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="172" y1="30" x2="172" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="200" y1="30" x2="200" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="228" y1="30" x2="228" y2="110" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="44" y1="110" x2="240" y2="110" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="100" y="110" width="80" height="20" rx="2" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
</svg>`,
    projectContext: {
      description: 'Thermal solver calculating junction temperatures of power electronics components based on power dissipation, thermal resistance networks, and heat sink attributes.',
      tags: ['ThermalDesign', 'HeatSinkCalculations', 'MOSFETCooling', 'ThermalResistance']
    },
    parameterPlayground: {
      description: 'Evaluate junction temperatures under steady-state heat dissipation.',
      parameters: [
        { name: 'power_w', label: 'Power Dissipation (Pd)', min: 1, max: 150, default: 25, unit: 'W' },
        { name: 'r_jc', label: 'Junction-to-Case (Rθjc)', min: 0.1, max: 5.0, default: 0.5, unit: '°C/W' },
        { name: 'r_cs', label: 'Case-to-Sink (Rθcs)', min: 0.1, max: 2.0, default: 0.2, unit: '°C/W' },
        { name: 'r_sa', label: 'Sink-to-Ambient (Rθsa)', min: 0.5, max: 15.0, default: 1.8, unit: '°C/W' },
        { name: 'ambient_temp', label: 'Ambient Temperature (Ta)', min: 15, max: 85, default: 25, unit: '°C' }
      ],
      equations: [
        { outputName: 'total_resistance', label: 'Total Rθ (Junction to Air)', formula_js: 'r_jc + r_cs + r_sa', unit: '°C/W' },
        { outputName: 'junction_temp', label: 'Junction Temp (Tj)', formula_js: 'ambient_temp + power_w * (r_jc + r_cs + r_sa)', unit: '°C' },
        { outputName: 'temp_rise', label: 'Heat Sink Temperature', formula_js: 'ambient_temp + power_w * r_sa', unit: '°C' }
      ]
    },
    starterCode: {
      language: 'python',
      filename: 'thermal_calc.py',
      content: `# MOSFET Thermal Junction Temperature Calculator
def calculate_thermal(Pd, r_jc, r_cs, r_sa, Ta):
    r_total = r_jc + r_cs + r_sa
    Tj = Ta + Pd * r_total
    T_sink = Ta + Pd * r_sa

    print(f"Total Thermal Resistance: {r_total:.2f} °C/W")
    print(f"Heat Sink Temperature:    {T_sink:.1f} °C")
    print(f"Junction Temperature:     {Tj:.1f} °C")
    if Tj > 150.0:
        print("CRITICAL WARNING: Junction temperature exceeds silicon safety limits (150°C)!")
    elif Tj > 120.0:
        print("WARNING: Junction temperature high. Consider active cooling or larger heat sink.")

calculate_thermal(25, 0.5, 0.2, 1.8, 25)`
    },
    bomStarter: [
      { quantity: 1, description: 'Aluminum Fin Extruded Heat Sink', value: '1.8 °C/W TO-220 size', package: 'HeatSink', notes: 'Pre-drilled mounting hole' },
      { quantity: 1, description: 'Thermal Interface Material Pad (TIM)', value: 'Sil-Pad 900S', package: 'Insulator-Pad', notes: 'Isolates case electrically' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'TIM Selection', content: 'Chose Sil-Pad dry insulator instead of thermal paste to avoid paste drying out over operating cycles and to guarantee electrical isolation.' }
    ],
    resources: [
      { title: 'Understanding Thermal Resistances', url: 'https://www.infineon.com/dgdl/Infineon-Thermal_resistance_theory_and_practice-ApplicationNotes-v01_00-EN.pdf?fileId=8ac78c8c7e71090d017edc8be92a15c3', type: 'reference' }
    ]
  },
  {
    id: 'planetary-gearbox',
    name: 'Planetary Gearbox Calculator',
    tagline: 'Velocity ratios and torque multipliers for epicyclic gear systems.',
    category: 'Mechanical',
    difficulty: 'expert',
    estimatedHours: 8,
    tags: ['Gears', 'Planetary', 'Epicyclic', 'Torque', 'Transmission'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="140" cy="80" r="64" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="140" cy="80" r="18" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="140" cy="38" r="12" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="107" cy="101" r="12" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="173" cy="101" r="12" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="140" cy="80" r="8" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'An epicyclic transmission analyzer detailing tooth relationships, carrier output speeds, and output torque multiplication when the ring gear is fixed.',
      tags: ['Gears', 'PlanetaryGears', 'ReductionRatio', 'EpicyclicGears']
    },
    parameterPlayground: {
      description: 'Optimize sun and planet sizes to achieve targeted torque reductions.',
      parameters: [
        { name: 'sun_teeth', label: 'Sun Gear Teeth (Ns)', min: 8, max: 40, default: 12, unit: 'T' },
        { name: 'planet_teeth', label: 'Planet Gear Teeth (Np)', min: 8, max: 50, default: 18, unit: 'T' },
        { name: 'input_torque_nm', label: 'Input Torque', min: 0.1, max: 100, default: 2.5, unit: 'N·m' }
      ],
      equations: [
        { outputName: 'ring_teeth', label: 'Derived Ring Teeth (Ns + 2Np)', formula_js: 'sun_teeth + 2 * planet_teeth', unit: 'T' },
        { outputName: 'reduction_ratio', label: 'Reduction Ratio (1 + Nr/Ns)', formula_js: '1 + (sun_teeth + 2 * planet_teeth) / sun_teeth', unit: ':1' },
        { outputName: 'output_torque', label: 'Output Torque (with loss)', formula_js: 'input_torque_nm * (1 + (sun_teeth + 2 * planet_teeth) / sun_teeth) * 0.95', unit: 'N·m' }
      ]
    },
    starterCode: {
      language: 'python',
      filename: 'planetary_solver.py',
      content: `# Planetary (Epicyclic) Gear Train Calculator
def solve_planetary(Ns, Np, torque_in):
    # For standard assembly, Ring teeth Nr = Ns + 2*Np
    Nr = Ns + 2 * Np
    # Speed reduction ratio (with Sun driving, Ring fixed, Carrier outputting)
    ratio = 1.0 + (Nr / Ns)
    # Output torque assuming 95% efficiency
    torque_out = torque_in * ratio * 0.95

    print(f"Sun Teeth:       {Ns} T")
    print(f"Planet Teeth:    {Np} T")
    print(f"Ring Teeth:      {Nr} T (Auto-solved)")
    print(f"Gear Reduction:  {ratio:.3f}:1")
    print(f"Output Torque:   {torque_out:.3f} N-m (at 95% eff)")

solve_planetary(12, 18, 2.5)`
    },
    bomStarter: [
      { quantity: 1, description: 'Sun Gear 12T 0.8M', value: '12T Sun', package: 'Gear', notes: 'Mounts on input shaft' },
      { quantity: 3, description: 'Planet Gears 18T 0.8M', value: '18T Planet', package: 'Gear', notes: 'Mounted on carrier pins' },
      { quantity: 1, description: 'Internal Ring Gear 48T 0.8M', value: '48T Ring', package: 'Ring-Gear', notes: 'Bolted to housing outer wall' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Epicyclic Ring Fitment', content: 'Validated Ns + 2Np = Nr (12 + 36 = 48) to guarantee pitch line alignments between sun, planets, and external ring.' }
    ],
    resources: [
      { title: 'Planetary Gear Carrier Math', url: 'https://www.machinedesign.com/mechanical-motion-systems/article/21831557/epicyclic-gear-math', type: 'reference' }
    ]
  }
];
