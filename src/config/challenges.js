export const CHALLENGES = [
  {
    id: "ch-buck-converter",
    title: "12V to 5V Sync Buck Converter Design",
    category: "power",
    difficulty: "intermediate",
    points: 750,
    timeLimit: 60,
    postedDate: "2026-06-01T00:00:00Z",
    expiresDate: "2026-06-08T00:00:00Z",
    brief: `### Challenge Objective
Design a 12V to 5V synchronous buck converter. The system needs to deliver stable output under varying loads.

### Specifications
* Input Voltage (Vin): 12 V
* Output Voltage (Vout): 5 V
* Output Current (Iout): 1 A
* Target Ripple: &lt; 50 mV
* Switching Frequency (fsw): 200 - 500 kHz
* Target Efficiency: &gt; 90% at full load

Calculate the required inductance (L) and filter capacitance (C) values to meet the ripple criteria while keeping the switching frequency within boundaries.`,
    constraints: [
      "Inductor ripple current must be between 20% and 40% of full load current",
      "Filter capacitance ESR must be small enough to meet ripple limits",
      "Switching frequency must be between 200kHz and 500kHz"
    ],
    evaluation_criteria: [
      "Calculated inductor L fits standard ripple ratios",
      "Capacitor C and ESR chosen correctly",
      "Efficiency analysis covers switching and conduction losses"
    ],
    hints: [
      "Consider the relationship between switching frequency and inductor ripple current — higher frequency allows smaller L.",
      "Vout ripple is approximately delta_I_L * (ESR + 1 / (8 * fsw * C)). Optimize ESR.",
      "Sync buck conduction losses are dominated by Iout^2 * Rdson of low-side MOSFET."
    ],
    referenceLinks: [
      { title: "TI Buck Converter Design Guide", url: "https://www.ti.com/lit/an/slva477b/slva477b.pdf" },
      { title: "Inductor Ripple Current Guidelines", url: "https://www.coilcraft.com/en-us/edu/what-is-inductor-ripple-current/" }
    ],
    solutionShareUrl: null,
    submissionCount: 47
  },
  {
    id: "ch-fixed-pid",
    title: "Fixed-Point PID Controller in C",
    category: "algorithm",
    difficulty: "advanced",
    points: 900,
    timeLimit: 90,
    postedDate: "2026-05-25T00:00:00Z",
    expiresDate: "2026-06-01T00:00:00Z",
    brief: `### Challenge Objective
Write a fixed-point PID controller in pure C for an 8-bit microcontroller (like an AVR) that does not possess a floating-point unit (FPU).

### Specifications
* Use Q16.16 fixed-point scaling (32-bit signed values)
* Implement integral anti-windup clamping
* Derivative term must include a low-pass filter to reject noise
* Execute in fixed-period timesteps (dt = 1ms)`,
    constraints: [
      "No float or double types allowed in the code",
      "Fixed-point multiplications must check for overflow",
      "Integral terms must clamp to prevent windup"
    ],
    evaluation_criteria: [
      "Arithmetic uses correct bitwise shifts",
      "Anti-windup logic successfully clamps accumulator",
      "Clean filter code for derivative noise suppression"
    ],
    hints: [
      "In Q16.16, multiply is: ((int64_t)a * b) >> 16.",
      "Check scaling factor: 1.0 is represented as 1 << 16 = 65536.",
      "Clamp limits should correspond to the DAC/PWM limits shifted by 16."
    ],
    referenceLinks: [
      { title: "Fixed-Point Math Guide", url: "https://www.embedded.com/fixed-point-math-in-c/" }
    ],
    solutionShareUrl: null,
    submissionCount: 23
  },
  {
    id: "ch-active-lpf",
    title: "1kHz First-Order Active LPF Op-Amp",
    category: "analog",
    difficulty: "entry",
    points: 500,
    timeLimit: null,
    postedDate: "2026-05-18T00:00:00Z",
    expiresDate: null,
    brief: `### Challenge Objective
Design a first-order active low-pass filter with a cutoff frequency (fc) of exactly 1kHz.

### Specifications
* Op-Amp power: Single supply at 3.3V
* Midband Gain: 1 (0 dB)
* Cutoff frequency (fc): 1 kHz
* Input impedance: &gt; 10 kΩ

Determine the resistor (R) and capacitor (C) values using standard E24 series components. Bias the non-inverting input to Vcc/2 for single-supply operation.`,
    constraints: [
      "Filter cutoff must be 1kHz ± 5%",
      "Op-amp must be biased correctly for AC coupling",
      "Only E24 standard component values allowed"
    ],
    evaluation_criteria: [
      "Calculations show R and C matching fc=1/(2*pi*R*C)",
      "Biasing network maintains DC offset of 1.65V",
      "Passband gain meets gain specification"
    ],
    hints: [
      "Cutoff is fc = 1 / (2 * pi * R * C). If you pick C=10nF, what R is needed?",
      "Use two 10k resistors as a voltage divider to create the 1.65V virtual ground.",
      "Ensure input AC coupling capacitor is large enough to pass signals above 10Hz."
    ],
    referenceLinks: [
      { title: "Active Filter Cutoff Calculator", url: "https://www.analog.com/en/design-center/design-tools-and-calculators/active-filter-design-tool.html" }
    ],
    solutionShareUrl: null,
    submissionCount: 112
  },
  {
    id: "ch-motor-opt",
    title: "ATmega328P Motor Control Footprint Optimization",
    category: "digital",
    difficulty: "expert",
    points: 1200,
    timeLimit: 120,
    postedDate: "2026-05-11T00:00:00Z",
    expiresDate: null,
    brief: `### Challenge Objective
Optimize motor control firmware running on an ATmega328P to fit inside 512 bytes of Flash and use less than 32 bytes of RAM.

### Specifications
* Implement PWM speed control via Register manipulation (TCCR1A, OCR1A)
* Handle external encoder interrupts to count revolutions
* Limit RAM allocations by bypassing standard Arduino structures`,
    constraints: [
      "Binary size must fit within 512 bytes",
      "Do not use floating point arithmetic or division inside ISRs",
      "Bypass Arduino digitalRead/Write libraries; use direct PORTB registers"
    ],
    evaluation_criteria: [
      "Register configurations mapped correctly",
      "Encoder counts trigger in lightweight interrupts",
      "Minimum assembly/code size achieved"
    ],
    hints: [
      "Bypass standard ISRs by using ISR(PCINT0_vect, ISR_NAKED) or optimizing prologue.",
      "Replace variable division with bit-shifts: dividing by 8 is shifting right by 3.",
      "Keep static variables in registers if possible (using global register binding)."
    ],
    referenceLinks: [
      { title: "AVR Register Manipulations", url: "https://www.nongnu.org/avr-libc/user-manual/FAQ.html" }
    ],
    solutionShareUrl: null,
    submissionCount: 14
  },
  {
    id: "ch-audio-preamp",
    title: "Low-Noise Op-Amp Audio Preamplifier",
    category: "analog",
    difficulty: "intermediate",
    points: 700,
    timeLimit: 45,
    postedDate: "2026-05-04T00:00:00Z",
    expiresDate: null,
    brief: `Design a high-fidelity audio preamplifier using an NE5532 op-amp. The input signal is from a dynamic microphone with 2mV RMS. Output must be line-level (1V RMS) with total harmonic distortion (THD) under 0.05%.`,
    constraints: [
      "Gain must be precisely 500 (approx. 54dB)",
      "Bandwidth must cover the audible range (20Hz to 20kHz) at ±1dB",
      "Single 9V battery supply operation with virtual ground biasing"
    ],
    evaluation_criteria: [
      "Feedback resistor network keeps op-amp stable",
      "Frequency response rolls off below 20Hz and above 20kHz",
      "Low noise selection for input resistor values"
    ],
    hints: [
      "A gain of 500 in a single stage may exceed the Gain-Bandwidth Product (GBW) of the NE5532. Consider cascaded stages.",
      "Keep feedback resistors small to reduce thermal Johnson noise.",
      "Decouple the virtual ground rail with a capacitor (10uF) to avoid crosstalk."
    ],
    referenceLinks: [
      { title: "NE5532 Low Noise Dual Op-Amp", url: "https://www.ti.com/product/NE5532" }
    ],
    solutionShareUrl: null,
    submissionCount: 88
  },
  {
    id: "ch-spi-parsing",
    title: "High-Speed SPI Packet Parser",
    category: "algorithm",
    difficulty: "intermediate",
    points: 600,
    timeLimit: 30,
    postedDate: "2026-04-27T00:00:00Z",
    expiresDate: null,
    brief: `Write an efficient C function to decode framing and validate checksums for custom SPI sensor packets arriving at 10Mbps. The packet starts with a 0x7E sync byte, followed by 2 bytes of length, payload, and a 16-bit CRC.`,
    constraints: [
      "Must execute in under 200 CPU cycles per packet",
      "Zero allocations inside the parser",
      "Handle packet fragmentation and invalid checksum framing errors gracefully"
    ],
    evaluation_criteria: [
      "Circular buffer structure holds fragment data",
      "CRC16 lookup tables used for speed optimization",
      "Framing states recover automatically after bit slips"
    ],
    hints: [
      "Avoid byte-by-byte copies. Parse in-place inside the ring buffer.",
      "Use a state machine: FIND_SYNC -> READ_LEN -> READ_BODY -> CHECK_CRC.",
      "Precalculate CRC table to do CRC byte lookups in 4 cycles."
    ],
    referenceLinks: [
      { title: "CRC-CCITT Look-Up Table Algorithm", url: "https://barrgroup.com/embedded-systems/how-to/crc-calculation-c-code" }
    ],
    solutionShareUrl: null,
    submissionCount: 65
  },
  {
    id: "ch-led-matrix",
    title: "PWM LED Matrix Driver Duty Cycle Timings",
    category: "digital",
    difficulty: "entry",
    points: 400,
    timeLimit: null,
    postedDate: "2026-04-20T00:00:00Z",
    expiresDate: null,
    brief: `Design the timing sequence for an 8x8 LED matrix driver using shift registers. Achieve 8-bit color depth (256 brightness levels) per pixel using Binary Code Modulation (BCM) rather than traditional PWM to save MCU cycles.`,
    constraints: [
      "Scan frequency must be above 100Hz to prevent flicker",
      "BCM timer intervals must scale exponentially: t, 2t, 4t, ..., 128t",
      "Total multiplexing overhead must occupy less than 15% of CPU cycles"
    ],
    evaluation_criteria: [
      "Binary Code Modulation timing math is correct",
      "Multiplexing scan rate calculation eliminates visible flicker",
      "ISR registers shift data accurately"
    ],
    hints: [
      "BCM updates the display only 8 times per frame instead of 256 times for PWM.",
      "Verify that the shortest BCM period allows enough time to clock out 8 bytes of data.",
      "Enable SPI in double-buffered mode to transmit shift register bytes asynchronously."
    ],
    referenceLinks: [
      { title: "Binary Code Modulation Explained", url: "https://www.batsocks.co.uk/readme/art_bcm.htm" }
    ],
    solutionShareUrl: null,
    submissionCount: 94
  },
  {
    id: "ch-solar-mppt",
    title: "Solar Panel MPPT P&O Tracking Algorithm",
    category: "mixed",
    difficulty: "advanced",
    points: 850,
    timeLimit: 60,
    postedDate: "2026-04-13T00:00:00Z",
    expiresDate: null,
    brief: `Design a Perturb and Observe (P&O) Maximum Power Point Tracking (MPPT) algorithm for a solar battery charger. The microcontroller adjusts the PWM duty cycle of a buck converter to maximize panel output power.`,
    constraints: [
      "Prevent oscillation at steady-state peak power",
      "Respond to solar irradiance changes within 500ms",
      "Duty cycle adjustments must be clamped between 5% and 95%"
    ],
    evaluation_criteria: [
      "Power calculation correctly evaluates P = V * I",
      "Perturbation direction flips properly when delta P is negative",
      "Variable step size optimization suppresses peak oscillations"
    ],
    hints: [
      "Measure current (I) and voltage (V), calculate P. If P_new > P_old, continue in the same direction. Otherwise, reverse direction.",
      "If the panel voltage changes rapidly, the irradiance has changed. Temporarily increase step size.",
      "Verify duty cycle bounds are clamped to prevent converter saturation."
    ],
    referenceLinks: [
      { title: "Introduction to MPPT Algorithms", url: "https://www.mathworks.com/help/physmod/sps/ug/mppt-algorithms.html" }
    ],
    solutionShareUrl: null,
    submissionCount: 38
  },
  {
    id: "ch-buckboost",
    title: "Buck-Boost Loop Stabilizer",
    category: "power",
    difficulty: "advanced",
    points: 800,
    timeLimit: 90,
    postedDate: "2026-04-06T00:00:00Z",
    expiresDate: null,
    brief: `Calculate feedback compensator values (Type II or Type III error amplifier) for a non-inverting buck-boost converter. Ensure a phase margin of at least 45 degrees and gain margin > 10dB for load step transients.`,
    constraints: [
      "Crossover frequency must be 1/10 of switching frequency (crossover = 30kHz)",
      "Compensator must attenuate switching noise ripple at 300kHz",
      "Phase margin must be > 45 degrees at crossover"
    ],
    evaluation_criteria: [
      "Pole and zero locations chosen correctly to cancel power stage poles",
      "Phase boost calculation yields appropriate compensator type",
      "Resistor/Capacitor values calculated using standard components"
    ],
    hints: [
      "Buck-boost power stage has a Right-Half-Plane (RHP) zero in CCM. Compensator must roll off gain before the RHP zero frequency.",
      "A Type III compensator is required to boost phase by up to 180 degrees using two poles and two zeros.",
      "Select feedback resistor values to keep error amplifier current around 100uA."
    ],
    referenceLinks: [
      { title: "Feedback Loop Design for Buck-Boost", url: "https://www.ti.com/lit/an/slva057/slva057.pdf" }
    ],
    solutionShareUrl: null,
    submissionCount: 19
  },
  {
    id: "ch-active-bpf",
    title: "Op-Amp Active Bandpass Filter",
    category: "analog",
    difficulty: "intermediate",
    points: 650,
    timeLimit: 45,
    postedDate: "2026-03-30T00:00:00Z",
    expiresDate: null,
    brief: `Design a multiple-feedback (MFB) active bandpass filter. It must capture a pilot tone at 5kHz and filter out surrounding industrial frequency noise.`,
    constraints: [
      "Center frequency (fo) must be 5kHz ± 2%",
      "Quality factor (Q) must be 10 (crossover bandwidth = 500Hz)",
      "Passband gain at center frequency must be 10 (20dB)"
    ],
    evaluation_criteria: [
      "MFB topology equations solved correctly",
      "Sensitivity of fo to component tolerances is minimized",
      "Standard capacitor values selected with precision resistors"
    ],
    hints: [
      "MFB gain is Ao = -R2 / (2 * R1). Center frequency is fo = 1 / (2 * pi * C * sqrt(R1_parallel_R3 * R2)) where C1=C2=C.",
      "A high Q (like 10) makes the filter sensitive to component tolerance. Use 1% metal film resistors.",
      "Make sure the op-amp has sufficient Gain-Bandwidth Product (GBW > 20 * Q^2 * fo)."
    ],
    referenceLinks: [
      { title: "Multiple Feedback Bandpass Filter Design", url: "https://www.ti.com/lit/an/sloa088/sloa088.pdf" }
    ],
    solutionShareUrl: null,
    submissionCount: 42
  },
  {
    id: "ch-battery-soc",
    title: "Coulomb Counting Battery State-of-Charge Estimator",
    category: "mixed",
    difficulty: "intermediate",
    points: 750,
    timeLimit: 60,
    postedDate: "2026-03-23T00:00:00Z",
    expiresDate: null,
    brief: `Develop a state-of-charge (SoC) estimation algorithm for a 10Ah Lithium-Iron-Phosphate (LiFePO4) battery pack. Combine coulomb counting (current integration) with periodic Open-Circuit Voltage (OCV) table correction.`,
    constraints: [
      "Current measurement ADC drifts must be calibrated out dynamically",
      "Estimated SoC must be updated every 100ms",
      "OCV corrections must trigger only when current has been under 50mA for 10 minutes (relaxation state)"
    ],
    evaluation_criteria: [
      "Integration accumulator prevents math overflow over time",
      "OCV lookup table uses linear interpolation",
      "Coulomb counting recalibrates at 0% and 100% boundary voltage trippoints"
    ],
    hints: [
      "Integrate current: SoC = SoC_initial + (1/NominalCapacity) * integral(I * dt).",
      "LiFePO4 OCV curve is extremely flat between 20% and 80%. Rely purely on Coulomb Counting in this region.",
      "Implement a small deadband in the current measurement to prevent cumulative integration of sensor noise."
    ],
    referenceLinks: [
      { title: "LiFePO4 Open Circuit Voltage Table Guide", url: "https://www.embedded.com/estimating-state-of-charge-in-lithium-ion-batteries/" }
    ],
    solutionShareUrl: null,
    submissionCount: 31
  },
  {
    id: "ch-clock-divider",
    title: "Digital Clock Frequency Divider in Verilog",
    category: "digital",
    difficulty: "entry",
    points: 450,
    timeLimit: null,
    postedDate: "2026-03-16T00:00:00Z",
    expiresDate: null,
    brief: `Write a Verilog module to divide a 50MHz oscillator clock down to exactly 1Hz, producing a square wave with a 50% duty cycle.`,
    constraints: [
      "Output signal must have exactly 50% duty cycle",
      "Write register overflow checks inside the sequential process blocks",
      "Synchronize reset triggers to the master clock edge"
    ],
    evaluation_criteria: [
      "Divide counter correctly counts up to 25,000,000 to toggle clock",
      "Synthesis reports zero race conditions or latch creations",
      "Reset logic acts synchronously"
    ],
    hints: [
      "Since 50MHz/1Hz = 50,000,000, toggle the output clock pin every 25,000,000 clock pulses.",
      "A 25-bit counter is required to hold values up to 25,000,000 (2^25 = 33,554,432).",
      "Always generate clock dividers by clocking registers using the source clock; never daisy-chain divider outputs directly."
    ],
    referenceLinks: [
      { title: "Clock Division Guidelines in Verilog", url: "https://www.fpga4fun.com/MusicBox2.html" }
    ],
    solutionShareUrl: null,
    submissionCount: 82
  }
]
