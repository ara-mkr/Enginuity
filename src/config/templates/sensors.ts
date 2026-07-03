export const sensorsTemplates = [
  {
    id: 'hx711-load-cell',
    name: 'HX711 Load Cell Amplifier',
    tagline: 'Precision weigh scale amplifier using the HX711 24-bit ADC.',
    category: 'Sensors',
    difficulty: 'beginner',
    estimatedHours: 3,
    tags: ['Weight', 'Scale', 'ADC', 'HX711', 'Load Cell'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="60" width="60" height="40" rx="3" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="80" y1="80" x2="110" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="110" y="55" width="60" height="50" rx="3" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="170" y1="80" x2="200" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="200" y="65" width="60" height="30" rx="3" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="200" cy="80" r="2.5" fill="#6b6d85"/>
  <circle cx="260" cy="80" r="3" fill="#94a3b8"/>
  <line x1="200" y1="80" x2="260" y2="80" stroke="#94a3b8" stroke-width="1.5"/>
</svg>`,
    projectContext: {
      description: 'A precision weigh scale interface using a strain-gauge load cell and the HX711 24-bit analog-to-digital converter designed for weigh scales and industrial control.',
      tags: ['HX711', 'LoadCell', 'ADC', 'ScaleCalibration']
    },
    parameterPlayground: {
      description: 'Calibrate load cell parameters, excitation voltage, and scale factor.',
      parameters: [
        { name: 'excitation_voltage', label: 'Excitation Voltage', min: 2.5, max: 5.0, default: 4.3, unit: 'V' },
        { name: 'load_cell_mv_v', label: 'Load Cell Sensitivity', min: 1.0, max: 3.0, default: 2.0, unit: 'mV/V' },
        { name: 'rated_capacity_kg', label: 'Rated Capacity', min: 1, max: 200, default: 5, unit: 'kg' },
        { name: 'adc_gain', label: 'HX711 ADC Gain', min: 64, max: 128, default: 128, unit: '' }
      ],
      equations: [
        { outputName: 'full_scale_output_mv', label: 'Full Scale Output', formula_js: 'excitation_voltage * load_cell_mv_v', unit: 'mV' },
        { outputName: 'resolution_g', label: 'Resolution (Theoretical)', formula_js: '(rated_capacity_kg * 1000) / Math.pow(2, 24)', unit: 'g' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'hx711_scale.ino',
      content: `// HX711 Weigh Scale Example
#include "HX711.h"

const int LOADCELL_DOUT_PIN = 2;
const int LOADCELL_SCK_PIN = 3;

HX711 scale;

void setup() {
  Serial.begin(115200);
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);

  Serial.println("Initializing scale calibration...");
  scale.set_scale(2280.f); // Calibration factor
  scale.tare();            // Reset scale to 0
  Serial.println("Readings ready.");
}

void loop() {
  if (scale.is_ready()) {
    long reading = scale.get_units(10);
    Serial.print("Weight: ");
    Serial.print(reading);
    Serial.println(" g");
  } else {
    Serial.println("HX711 not found.");
  }
  delay(1000);
}`
    },
    bomStarter: [
      { quantity: 1, description: 'HX711 24-bit ADC Breakout Board', value: 'HX711 Board', package: 'Module', notes: 'Amplifier and ADC' },
      { quantity: 1, description: '4-Wire Strain Gauge Load Cell (5kg)', value: 'Bar Type', package: 'Chassis', notes: 'Weight sensor' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Excitation Voltage Source', content: 'Used HX711 internal regulator (AVDD) to supply 4.3V to the load cell for low noise instead of raw VCC.' }
    ],
    resources: [
      { title: 'HX711 Datasheet', url: 'https://cdn.sparkfun.com/datasheets/Sensors/ForceFlex/hx711_english.pdf', type: 'datasheet' }
    ]
  },
  {
    id: 'mpu6050-imu',
    name: 'MPU6050 6-DOF IMU Sensor',
    tagline: 'Accurate motion tracking with accelerometer, gyroscope, and complementary filtering.',
    category: 'Sensors',
    difficulty: 'intermediate',
    estimatedHours: 4,
    tags: ['IMU', 'Gyroscope', 'Accelerometer', 'I2C', 'Motion'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="140" cy="80" r="50" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="60" y1="80" x2="220" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="140" y1="20" x2="140" y2="140" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="140" y1="80" x2="183" y2="43" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="183" cy="43" r="3" fill="#94a3b8"/>
  <circle cx="140" cy="80" r="4" fill="#6b6d85"/>
</svg>`,
    projectContext: {
      description: 'An inertial measurement unit tracker that reads roll/pitch values from the MPU6050 and applies a complementary filter to clean up noise.',
      tags: ['MPU6050', 'I2C', 'IMU', 'ComplementaryFilter']
    },
    parameterPlayground: {
      description: 'Tune sample rate and filter constants to smooth pitch/roll readings.',
      parameters: [
        { name: 'filter_alpha', label: 'Filter Alpha (Gyro Weight)', min: 0.8, max: 0.99, default: 0.96, unit: '' },
        { name: 'dt_ms', label: 'Loop Sample Interval', min: 5, max: 100, default: 10, unit: 'ms' }
      ],
      equations: [
        { outputName: 'accel_weight', label: 'Accel Weight', formula_js: '1.0 - filter_alpha', unit: '' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'imu_filter.ino',
      content: `// MPU6050 Motion Tracker with Complementary Filter
#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;
int16_t ax, ay, az, gx, gy, gz;
double pitch = 0, roll = 0;
unsigned long lastTime;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed");
  }
  lastTime = millis();
}

void loop() {
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

  unsigned long now = millis();
  double dt = (now - lastTime) / 1000.0;
  lastTime = now;

  // Calculate accelerometer angles
  double accelPitch = atan2(-ax, sqrt(ay*ay + az*az)) * 57.2958;
  double accelRoll = atan2(ay, az) * 57.2958;

  // Apply complementary filter (gyro rate in deg/s)
  double gyroPitchRate = gy / 131.0;
  double gyroRollRate = gx / 131.0;

  pitch = 0.96 * (pitch + gyroPitchRate * dt) + 0.04 * accelPitch;
  roll = 0.96 * (roll + gyroRollRate * dt) + 0.04 * accelRoll;

  Serial.print("Pitch: "); Serial.print(pitch);
  Serial.print(" | Roll: "); Serial.println(roll);
  delay(10);
}`
    },
    bomStarter: [
      { quantity: 1, description: 'MPU-6050 6-Axis Accelerometer & Gyro', value: 'GY-521 Module', package: 'Module', notes: 'I2C connection' },
      { quantity: 2, description: 'Pull-up Resistors', value: '4.7kΩ', package: '0603', notes: 'I2C bus SCL/SDA lines' }
    ],
    notebookEntries: [
      { type: 'OBSERVATION', title: 'IMU Drift Correction', content: 'Observed significant drift when using gyro data alone. Complementary filter with alpha=0.96 resolves the steady-state drift.' }
    ],
    resources: [
      { title: 'MPU6050 Register Map', url: 'https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Datasheet1.pdf', type: 'datasheet' }
    ]
  },
  {
    id: 'ina219-current',
    name: 'INA219 Power & Current Monitor',
    tagline: 'High-side bus voltage and current monitoring over I2C.',
    category: 'Sensors',
    difficulty: 'beginner',
    estimatedHours: 2,
    tags: ['Current', 'Power', 'INA219', 'I2C', 'Shunt'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="80" x2="80" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="80" y1="65" x2="80" y2="95" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="80" y1="95" x2="110" y2="65" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="110" y1="65" x2="110" y2="95" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="110" y1="80" x2="160" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <rect x="160" y="55" width="60" height="50" rx="3" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="220" y1="80" x2="260" y2="80" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="160" cy="80" r="2.5" fill="#6b6d85"/>
  <circle cx="260" cy="80" r="3" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'INA219 bidirectional current and power monitoring circuit with high precision shunt resistor to track system power consumption.',
      tags: ['INA219', 'CurrentSensor', 'I2C', 'ShuntResistor']
    },
    parameterPlayground: {
      description: 'Configure shunt resistance and max current limits.',
      parameters: [
        { name: 'r_shunt_ohms', label: 'Shunt Resistor Rshunt', min: 0.01, max: 0.5, default: 0.1, unit: 'Ω' },
        { name: 'max_expected_a', label: 'Max Expected Current', min: 0.1, max: 10, default: 3.2, unit: 'A' }
      ],
      equations: [
        { outputName: 'max_shunt_voltage', label: 'Max Shunt Voltage Drop', formula_js: 'max_expected_a * r_shunt_ohms', unit: 'V' },
        { outputName: 'lsb_resolution_ua', label: 'Current LSB Resolution', formula_js: '(max_expected_a / 32768) * 1000000', unit: 'µA' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'ina219_monitor.ino',
      content: `// INA219 Current & Power Monitoring Code
#include <Wire.h>
#include <Adafruit_INA219.h>

Adafruit_INA219 ina219;

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) {
    Serial.println("Failed to find INA219 chip");
    while (1) { delay(10); }
  }
  Serial.println("Measuring voltage and current...");
}

void loop() {
  float shuntvoltage = ina219.getShuntVoltage_mV();
  float busvoltage = ina219.getBusVoltage_V();
  float current_mA = ina219.getCurrent_mA();
  float power_mW = ina219.getPower_mW();

  Serial.print("Bus Voltage:   "); Serial.print(busvoltage); Serial.println(" V");
  Serial.print("Shunt Voltage: "); Serial.print(shuntvoltage); Serial.println(" mV");
  Serial.print("Current:       "); Serial.print(current_mA); Serial.println(" mA");
  Serial.print("Power:         "); Serial.print(power_mW); Serial.println(" mW");
  Serial.println("");

  delay(1000);
}`
    },
    bomStarter: [
      { quantity: 1, description: 'INA219 Bidirectional Current Sensor IC', value: 'INA219AIDGNT', package: 'SOT-23-8', notes: 'High-side current monitor' },
      { quantity: 1, description: 'Metal Strip Shunt Resistor 0.1 Ohm 1%', value: '0.1Ω 1W', package: '2512', notes: 'Sets max measurement range' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Shunt Resistor Optimization', content: 'Chose a 0.1 Ohm shunt to maximize resolution up to 3.2A. Shunt voltage drops 320mV at full load, which is within the INA219 +/-320mV limit.' }
    ],
    resources: [
      { title: 'INA219 TI Datasheet', url: 'https://www.ti.com/lit/ds/symlink/ina219.pdf', type: 'datasheet' }
    ]
  },
  {
    id: 'ultrasonic-array',
    name: 'Ultrasonic Distance Sensor Array',
    tagline: 'Multi-sensor HC-SR04 ultrasonic array with sequential ping scheduling.',
    category: 'Sensors',
    difficulty: 'beginner',
    estimatedHours: 3,
    tags: ['Distance', 'Sonar', 'HC-SR04', 'Array', 'Ping'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="90" cy="90" r="28" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="190" cy="90" r="28" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="90" cy="90" r="10" fill="#6b6d85"/>
  <circle cx="190" cy="90" r="10" fill="#6b6d85"/>
  <path d="M50,38 C80,22 200,22 230,38" stroke="#6b6d85" stroke-width="1.5" fill="none"/>
  <path d="M30,24 C72,4 208,4 250,24" stroke="#94a3b8" stroke-width="1.5" fill="none"/>
</svg>`,
    projectContext: {
      description: 'An array of HC-SR04 ultrasonic sensors triggering sequentially to prevent cross-talk interference while obtaining a multi-directional distance sweep.',
      tags: ['HCSR04', 'GPIO', 'Ultrasonic', 'SensorArray']
    },
    parameterPlayground: {
      description: 'Tune distance limits, temperature speed adjustments, and cycle delay.',
      parameters: [
        { name: 'ambient_temp_c', label: 'Ambient Temperature', min: -20, max: 50, default: 20, unit: '°C' },
        { name: 'sensor_spacing_cm', label: 'Sensor Spacing', min: 5, max: 100, default: 15, unit: 'cm' }
      ],
      equations: [
        { outputName: 'speed_of_sound_m_s', label: 'Speed of Sound', formula_js: '331.3 + 0.606 * ambient_temp_c', unit: 'm/s' },
        { outputName: 'min_cycle_time_ms', label: 'Safe Interval between Pings', formula_js: '(400 * 2) / (331.3 + 0.606 * ambient_temp_c) * 10', unit: 'ms' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'ultrasonic_array.ino',
      content: `// HC-SR04 Ultrasonic Array Sequential Pinging
#include <NewPing.h>

#define SONAR_NUM     3
#define MAX_DISTANCE 200 // Max distance to ping (in cm)
#define PING_INTERVAL 33 // Milliseconds between sensor pings (29ms min)

unsigned long pingTimer[SONAR_NUM]; // Holds the times when the next ping should happen
unsigned int cm[SONAR_NUM];         // Where the ping distances are stored
uint8_t currentSensor = 0;          // Keeps track of which sensor is active

NewPing sonar[SONAR_NUM] = {
  NewPing(2, 3, MAX_DISTANCE), // Trigger pin, echo pin, max distance
  NewPing(4, 5, MAX_DISTANCE),
  NewPing(6, 7, MAX_DISTANCE)
};

void setup() {
  Serial.begin(115200);
  pingTimer[0] = millis() + 75; // First ping at 75ms
  for (uint8_t i = 1; i < SONAR_NUM; i++) {
    pingTimer[i] = pingTimer[i - 1] + PING_INTERVAL;
  }
}

void loop() {
  for (uint8_t i = 0; i < SONAR_NUM; i++) {
    if (millis() >= pingTimer[i]) {
      pingTimer[i] += PING_INTERVAL * SONAR_NUM;
      sonar[currentSensor].timer_stop();
      currentSensor = i;
      cm[currentSensor] = 0;
      sonar[currentSensor].ping_timer(echoCheck);
    }
  }
}

void echoCheck() {
  if (sonar[currentSensor].check_timer()) {
    cm[currentSensor] = sonar[currentSensor].ping_result / US_ROUNDTRIP_CM;
    Serial.print("Sensor ");
    Serial.print(currentSensor);
    Serial.print(" = ");
    Serial.print(cm[currentSensor]);
    Serial.println("cm");
  }
}`
    },
    bomStarter: [
      { quantity: 3, description: 'HC-SR04 Ultrasonic Ranging Sensors', value: 'HC-SR04', package: 'Module', notes: '4-Pin distance transceiver' }
    ],
    notebookEntries: [
      { type: 'PLAN', title: 'Cross-talk Mitigation', content: 'Scheduled pings with a 33ms interval to allow reflections from previous sensors to dissipate before launching the next pulse.' }
    ],
    resources: [
      { title: 'HC-SR04 User Manual', url: 'https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf', type: 'reference' }
    ]
  }
];
