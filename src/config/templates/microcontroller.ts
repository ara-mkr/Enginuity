export const microcontrollerTemplates = [
  {
    id: 'esp32-wifi-sensor',
    name: 'ESP32 WiFi Sensor Node',
    tagline: 'An IoT edge sensor node with deep sleep, MQTT publishing, and battery monitoring.',
    category: 'Microcontroller',
    difficulty: 'beginner',
    estimatedHours: 4,
    tags: ['ESP32', 'IoT', 'WiFi', 'MQTT', 'Low Power'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="90" y="44" width="100" height="72" rx="3" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="60" x2="90" y2="60" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="80" x2="90" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="100" x2="90" y2="100" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="20" cy="60" r="2.5" fill="#6b6d85"/>
  <circle cx="20" cy="80" r="2.5" fill="#6b6d85"/>
  <circle cx="20" cy="100" r="2.5" fill="#6b6d85"/>
  <line x1="190" y1="60" x2="260" y2="60" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="190" y1="80" x2="260" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="190" y1="100" x2="260" y2="100" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="260" cy="100" r="3" fill="#94a3b8"/>
  <circle cx="260" cy="60" r="2.5" fill="#6b6d85"/>
  <circle cx="260" cy="80" r="2.5" fill="#6b6d85"/>
</svg>`,
    projectContext: {
      description: 'ESP32 IoT node that samples environmental sensors (temp/humidity), publishes readings via MQTT to a central broker, and goes into deep sleep to conserve battery.',
      tags: ['ESP32', 'IoT', 'WiFi', 'MQTT', 'AHT20', 'LowPower']
    },
    parameterPlayground: {
      description: 'Optimize sleep intervals and transmission retries against battery lifespan.',
      parameters: [
        { name: 'sleep_duration_sec', label: 'Deep Sleep Duration', min: 10, max: 3600, default: 60, unit: 's' },
        { name: 'wifi_retries', label: 'WiFi Max Retries', min: 1, max: 10, default: 5, unit: '' },
        { name: 'tx_power_dbm', label: 'RF Tx Power', min: 10, max: 20, default: 14, unit: 'dBm' },
        { name: 'battery_capacity_mah', label: 'Battery Capacity', min: 500, max: 3500, default: 2200, unit: 'mAh' }
      ],
      equations: [
        { outputName: 'avg_current_ma', label: 'Average Current Draw', formula_js: '((0.15 * tx_power_dbm) * (5 + wifi_retries * 0.5) + 0.015 * sleep_duration_sec) / (sleep_duration_sec + 2)', unit: 'mA' },
        { outputName: 'lifespan_days', label: 'Estimated Battery Life', formula_js: 'battery_capacity_mah / (((0.15 * tx_power_dbm) * (5 + wifi_retries * 0.5) + 0.015 * sleep_duration_sec) / (sleep_duration_sec + 2)) / 24', unit: 'days' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'wifi_sensor_node.ino',
      content: `// ESP32 WiFi MQTT Deep Sleep Node
#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.hivemq.com";

#define uS_TO_S_FACTOR 1000000ULL
#define TIME_TO_SLEEP  60  // Sleep duration in seconds

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, 1883);

  if (!client.connected()) {
    reconnect();
  }

  // Publish payload
  float temperature = 24.5; // Dummy reading
  char payload[50];
  snprintf(payload, 50, "{\\"temp\\": %.2f}", temperature);
  client.publish("enginguity/esp32/temp", payload);

  Serial.println("Data sent. Entering deep sleep...");
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * uS_TO_S_FACTOR);
  esp_deep_sleep_start();
}

void setup_wifi() {
  delay(10);
  WiFi.begin(ssid, password);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 10) {
    delay(500);
    retries++;
  }
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect("ESP32Client")) {
      break;
    }
  }
}

void loop() {}`
    },
    bomStarter: [
      { quantity: 1, description: 'ESP32-WROOM-32E DevKit Board', value: 'ESP32-DevKitC', package: 'Module', notes: 'Core MCU with WiFi/BT' },
      { quantity: 1, description: 'AHT20 Temp & Humidity Sensor', value: 'AHT20', package: 'I2C-Module', notes: 'Sensor node feedback' },
      { quantity: 1, description: '18650 Li-Ion Rechargeable Battery', value: '3.7V 2200mAh', package: 'Cell', notes: 'Power source' },
      { quantity: 1, description: 'TP4056 Battery Charger Board with protection', value: 'TP4056', package: 'PCB-Module', notes: 'CC/CV battery management' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Adopt ESP32 Platform', content: 'We selected the ESP32 platform over ESP8266 or ATtiny due to native secure MQTT support and dual-core processing capabilities.' },
      { type: 'PLAN', title: 'Verify Deep Sleep Current Draw', content: 'Verify actual current draw during deep sleep is below 20uA using a high-precision digital multimeter.' }
    ],
    resources: [
      { title: 'ESP32 Datasheet', url: 'https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf', type: 'datasheet' },
      { title: 'PubSubClient Documentation', url: 'https://pubsubclient.knolleary.net/', type: 'reference' }
    ]
  },
  {
    id: 'stm32-motor-control',
    name: 'STM32 Motor Controller',
    tagline: 'Precision brushless motor speed controller using timer-based PWM and current sensing.',
    category: 'Microcontroller',
    difficulty: 'advanced',
    estimatedHours: 12,
    tags: ['STM32', 'Motor Control', 'PWM', 'HAL', 'ADC'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="80" y="40" width="120" height="80" rx="3" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="60" x2="80" y2="60" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="80" x2="80" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="100" x2="80" y2="100" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="20" cy="60" r="2.5" fill="#6b6d85"/>
  <circle cx="20" cy="80" r="2.5" fill="#6b6d85"/>
  <circle cx="20" cy="100" r="2.5" fill="#6b6d85"/>
  <line x1="200" y1="80" x2="236" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="256" cy="80" r="20" fill="#1a1a2e" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="256" y1="80" x2="268" y2="68" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
    projectContext: {
      description: 'Closed-loop brushless motor controller utilizing STM32 advanced-control timers (TIM1) for complementary PWM generation and triple ADC sampling for current feedback.',
      tags: ['STM32F4', 'BLDC', 'PWM', 'ADC', 'FOC']
    },
    parameterPlayground: {
      description: 'Tuning PID gains and PWM timing specs to stabilize speed loops.',
      parameters: [
        { name: 'pwm_freq_hz', label: 'PWM Carrier Freq', min: 8000, max: 50000, default: 20000, unit: 'Hz' },
        { name: 'dead_time_ns', label: 'MOSFET Dead Time', min: 100, max: 2000, default: 500, unit: 'ns' },
        { name: 'kp_gain', label: 'Proportional Gain Kp', min: 0.1, max: 10, default: 1.5, unit: '' },
        { name: 'ki_gain', label: 'Integral Gain Ki', min: 0.01, max: 2, default: 0.2, unit: '' }
      ],
      equations: [
        { outputName: 'rise_time_ms', label: 'Estimated Rise Time', formula_js: '100 / (kp_gain * (1 + ki_gain))', unit: 'ms' },
        { outputName: 'pwm_resolution_bits', label: 'PWM Resolution', formula_js: 'Math.log2(84000000 / pwm_freq_hz)', unit: 'bits' }
      ]
    },
    starterCode: {
      language: 'c',
      filename: 'motor_control.c',
      content: `// STM32 BLDC Complementary PWM & Current Sensing
#include "stm32f4xx_hal.h"

TIM_HandleTypeDef htim1;
ADC_HandleTypeDef hadc1;

void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_TIM1_Init(void);
static void MX_ADC1_Init(void);

int main(void) {
  HAL_Init();
  SystemClock_Config();
  MX_GPIO_Init();
  MX_TIM1_Init();
  MX_ADC1_Init();

  // Start complementary PWM outputs
  HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1);
  HAL_TIMEx_PWMN_Start(&htim1, TIM_CHANNEL_1);

  // Start ADC conversion triggered by TIM1
  HAL_ADC_Start_IT(&hadc1);

  while (1) {
    // Dynamic PID processing in ADC callback
  }
}

void HAL_ADC_ConvCpltCallback(ADC_HandleTypeDef* hadc) {
  uint32_t current_val = HAL_ADC_GetValue(hadc);
  // Perform FOC current loop updates here
}`
    },
    bomStarter: [
      { quantity: 1, description: 'STM32F446RE Nucleo Development Board', value: 'NUCLEO-F446RE', package: 'LQFP-64', notes: 'Core processor' },
      { quantity: 3, description: 'In-line Shunt Resistors', value: '0.005Ω 2W', package: '2512', notes: 'Phase current sensing' },
      { quantity: 3, description: 'Half-Bridge Gate Drivers', value: 'IR2101', package: 'SOIC-8', notes: 'MOSFET gate driving' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Switch to Shunt-based Current Sensing', content: 'Chose low-side shunt resistors instead of Hall-effect sensors to minimize cost and board space.' }
    ],
    resources: [
      { title: 'STM32F446 Reference Manual', url: 'https://www.st.com/resource/en/reference_manual/dm00135183-stm32f446xx-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf', type: 'datasheet' }
    ]
  },
  {
    id: 'arduino-pid-temp',
    name: 'Arduino PID Temperature Controller',
    tagline: 'A closed-loop heating chamber controller utilizing PID math and PWM output.',
    category: 'Microcontroller',
    difficulty: 'beginner',
    estimatedHours: 3,
    tags: ['Arduino', 'PID', 'Temperature', 'PWM', 'RTD'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <line x1="20" y1="40" x2="260" y2="40" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="20" y1="80" x2="260" y2="80" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="20" y1="120" x2="260" y2="120" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="80" y1="30" x2="80" y2="130" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="160" y1="30" x2="160" y2="130" stroke="#1a1a2e" stroke-width="0.5"/>
  <line x1="240" y1="30" x2="240" y2="130" stroke="#1a1a2e" stroke-width="0.5"/>
  <path d="M20,120 L60,120 L60,52 L100,52 C112,52 112,42 124,42 C136,42 136,52 156,52 L196,52 L196,60 L226,60 L226,68 L260,68" stroke="#6b6d85" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
  <circle cx="124" cy="42" r="3" fill="#94a3b8"/>
</svg>`,
    projectContext: {
      description: 'An Arduino system to regulate heat inside an isolated chamber using an NTC thermistor, a MOSFET heating element, and closed-loop PID control math.',
      tags: ['Arduino', 'PID', 'TemperatureControl', 'Thermistor']
    },
    parameterPlayground: {
      description: 'Optimize loop gains to minimize overshoot during rapid heating cycles.',
      parameters: [
        { name: 'kp', label: 'Proportional Gain Kp', min: 0.1, max: 20, default: 2.5, unit: '' },
        { name: 'ki', label: 'Integral Gain Ki', min: 0, max: 5, default: 0.5, unit: '' },
        { name: 'kd', label: 'Derivative Gain Kd', min: 0, max: 10, default: 1.2, unit: '' },
        { name: 'target_temp_c', label: 'Setpoint Temperature', min: 20, max: 150, default: 65, unit: '°C' }
      ],
      equations: [
        { outputName: 'overshoot_pct', label: 'Estimated Overshoot', formula_js: '100 * Math.exp(-(Math.PI * kp) / Math.sqrt(100 + Math.pow(kp, 2) + kd * 5))', unit: '%' },
        { outputName: 'steady_state_error', label: 'SS Error', formula_js: 'target_temp_c / (1 + kp * 10)', unit: '°C' }
      ]
    },
    starterCode: {
      language: 'cpp',
      filename: 'pid_temp_control.ino',
      content: `// Arduino Temperature PID Controller
#include <PID_v1.h>

const int tempPin = A0;
const int heaterPin = 3;

double Setpoint, Input, Output;
double Kp = 2.5, Ki = 0.5, Kd = 1.2;

PID myPID(&Input, &Output, &Setpoint, Kp, Ki, Kd, DIRECT);

void setup() {
  Serial.begin(9600);
  Setpoint = 65.0; // Target temperature
  myPID.SetMode(AUTOMATIC);
  myPID.SetOutputLimits(0, 255);
}

void loop() {
  int rawVal = analogRead(tempPin);
  // Thermistor conversion
  double Vout = rawVal * (5.0 / 1023.0);
  double R = 10000.0 * (5.0 / Vout - 1.0);
  Input = 1.0 / (1.0 / 298.15 + (1.0 / 3950.0) * log(R / 10000.0)) - 273.15;

  myPID.Compute();
  analogWrite(heaterPin, Output);

  Serial.print("Current Temp: ");
  Serial.print(Input);
  Serial.print(" | Duty Cycle: ");
  Serial.println(Output);
  delay(1000);
}`
    },
    bomStarter: [
      { quantity: 1, description: 'Arduino Uno R3 Board', value: 'ATmega328P', package: 'DIP-28', notes: 'Core processor' },
      { quantity: 1, description: 'NTC Thermistor 10k 3950', value: 'NTC-10k', package: 'Through-Hole', notes: 'Temperature sensing' },
      { quantity: 1, description: 'Power N-Channel MOSFET', value: 'IRF3205', package: 'TO-220', notes: 'Heating control element' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Select NTC Thermistor', content: 'Chose a 10k NTC thermistor over a PT100 RTD to simplify the sensor circuit by avoiding an RTD amplifier.' }
    ],
    resources: [
      { title: 'Arduino PID Library Manual', url: 'https://playground.arduino.cc/Code/PIDLibrary/', type: 'reference' }
    ]
  },
  {
    id: 'rpi-gpio-python',
    name: 'Raspberry Pi GPIO Controller',
    tagline: 'Control GPIO pins, execute PWM outputs, and debounce inputs with Python.',
    category: 'Microcontroller',
    difficulty: 'beginner',
    estimatedHours: 2,
    tags: ['Raspberry Pi', 'Python', 'GPIO', 'PWM', 'Linux'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="84" y="36" width="112" height="88" rx="3" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="56" x2="84" y2="56" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="76" x2="84" y2="76" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="96" x2="84" y2="96" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="20" y1="116" x2="84" y2="116" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="20" cy="56" r="2.5" fill="#6b6d85"/>
  <circle cx="20" cy="76" r="2.5" fill="#6b6d85"/>
  <circle cx="20" cy="96" r="2.5" fill="#6b6d85"/>
  <circle cx="20" cy="116" r="2.5" fill="#6b6d85"/>
  <line x1="196" y1="56" x2="260" y2="56" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="196" y1="76" x2="260" y2="76" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="196" y1="96" x2="260" y2="96" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="196" y1="116" x2="260" y2="116" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="260" cy="116" r="3" fill="#94a3b8"/>
  <circle cx="260" cy="56" r="2.5" fill="#6b6d85"/>
  <circle cx="260" cy="76" r="2.5" fill="#6b6d85"/>
  <circle cx="260" cy="96" r="2.5" fill="#6b6d85"/>
</svg>`,
    projectContext: {
      description: 'Develop a Python-based utility on Raspberry Pi to toggle state relays, handle hardware button presses, and adjust PWM duty cycle outputs.',
      tags: ['RPi', 'GPIO', 'Python', 'Relay', 'Debounce']
    },
    parameterPlayground: {
      description: 'Adjust debounce window and PWM frequency to minimize contact noise.',
      parameters: [
        { name: 'debounce_ms', label: 'Software Debounce', min: 10, max: 500, default: 200, unit: 'ms' },
        { name: 'pwm_freq_hz', label: 'PWM Frequency', min: 1, max: 2000, default: 100, unit: 'Hz' }
      ],
      equations: [
        { outputName: 'duty_pct', label: 'Maximum PWM Resolution', formula_js: '100 - pwm_freq_hz / 100', unit: '%' }
      ]
    },
    starterCode: {
      language: 'python',
      filename: 'gpio_controller.py',
      content: `import RPi.GPIO as GPIO
import time

LED_PIN = 18
BUTTON_PIN = 23

GPIO.setmode(GPIO.BCM)
GPIO.setup(LED_PIN, GPIO.OUT)
GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

# Setup PWM
pwm = GPIO.PWM(LED_PIN, 100) # 100 Hz
pwm.start(0)

def button_pressed_callback(channel):
    print("Button pressed! Increasing brightness.")
    for dc in range(0, 101, 10):
        pwm.ChangeDutyCycle(dc)
        time.sleep(0.05)

# Add event listener with software debounce
GPIO.add_event_detect(BUTTON_PIN, GPIO.FALLING,
                      callback=button_pressed_callback,
                      bouncetime=200)

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    pwm.stop()
    GPIO.cleanup()`
    },
    bomStarter: [
      { quantity: 1, description: 'Raspberry Pi 4 Model B', value: 'RPi 4B', package: 'SBC', notes: 'Host board' },
      { quantity: 1, description: '5V Relay Module Block', value: 'SRD-05VDC-SL-C', package: 'Module', notes: 'Isolation switch' }
    ],
    notebookEntries: [
      { type: 'OBSERVATION', title: 'Vibration in Button Signals', content: 'Observed contact bounce of ~8ms on cheap tactile push buttons. The 200ms software bounce setting filters this cleanly.' }
    ],
    resources: [
      { title: 'RPi.GPIO Library Reference', url: 'https://pypi.org/project/RPi.GPIO/', type: 'reference' }
    ]
  },
  {
    id: 'attiny-low-power',
    name: 'ATtiny85 Power-Efficient Sensor',
    tagline: 'Bare-metal C code to minimize sleep currents on an 8-pin ATtiny85.',
    category: 'Microcontroller',
    difficulty: 'intermediate',
    estimatedHours: 6,
    tags: ['ATtiny85', 'AVR', 'Bare-Metal', 'Low Power', 'Assembly'],
    thumbnail: `<svg viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
  <rect x="100" y="50" width="80" height="60" rx="3" fill="#1a1a2e" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="40" y1="65" x2="100" y2="65" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="40" y1="80" x2="100" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="40" y1="95" x2="100" y2="95" stroke="#6b6d85" stroke-width="1.5"/>
  <circle cx="40" cy="65" r="2.5" fill="#6b6d85"/>
  <circle cx="40" cy="80" r="2.5" fill="#6b6d85"/>
  <circle cx="40" cy="95" r="2.5" fill="#6b6d85"/>
  <line x1="180" y1="65" x2="240" y2="65" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="180" y1="80" x2="240" y2="80" stroke="#6b6d85" stroke-width="1.5"/>
  <line x1="180" y1="95" x2="240" y2="95" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="240" cy="95" r="3" fill="#94a3b8"/>
  <circle cx="240" cy="65" r="2.5" fill="#6b6d85"/>
  <circle cx="240" cy="80" r="2.5" fill="#6b6d85"/>
</svg>`,
    projectContext: {
      description: 'Implement low-power sensor reporting using an ATtiny85. Relies on internal watchdog timers, disabling ADC/peripherals before sleep, and waking via external interrupts.',
      tags: ['ATtiny85', 'AVR', 'Watchdog', 'SleepMode', 'C']
    },
    parameterPlayground: {
      description: 'Optimize CPU clock speed and watchdog settings to maximize cell lifespan.',
      parameters: [
        { name: 'clock_freq_mhz', label: 'Internal Clock Speed', min: 0.128, max: 8, default: 1, unit: 'MHz' },
        { name: 'sleep_cycles', label: 'Watchdog Sleep Cycles', min: 1, max: 20, default: 8, unit: 'x8s' }
      ],
      equations: [
        { outputName: 'current_active_ma', label: 'Active Current', formula_js: '0.8 * clock_freq_mhz', unit: 'mA' },
        { outputName: 'battery_lifespan_years', label: 'Estimated Lifespan', formula_js: '220 / (0.005 + (0.8 * clock_freq_mhz * (0.05 / (sleep_cycles * 8)))) / 8760', unit: 'years' }
      ]
    },
    starterCode: {
      language: 'c',
      filename: 'attiny_sleep.c',
      content: `// ATtiny85 Low-Power Watchdog Sleep
#include <avr/io.h>
#include <avr/sleep.h>
#include <avr/wdt.h>
#include <avr/interrupt.h>

ISR(WDT_vect) {
  // Watchdog interrupt code (runs every 8s)
}

void setup_sleep() {
  // Disable ADC to save power
  ADCSRA &= ~(1<<ADEN);

  // Set sleep mode to Power Down
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
}

void enter_sleep() {
  // Setup watchdog for 8 seconds
  MCUSR &= ~(1<<WDRF);
  WDTCR |= (1<<WDCE) | (1<<WDE);
  WDTCR = (1<<WDIE) | (1<<WDP3) | (1<<WDP0); // 8 seconds

  sei(); // Enable global interrupts

  sleep_enable();
  sleep_cpu();

  // -- SLEEPING HERE --

  sleep_disable();
  wdt_disable();
}

int main(void) {
  setup_sleep();
  while(1) {
    enter_sleep();
    // Wake up briefly, toggle LED or take reading
    DDRB |= (1<<PB0);
    PORTB |= (1<<PB0);
    for(volatile uint16_t i=0; i<1000; i++); // Short active window
    PORTB &= ~(1<<PB0);
  }
}`
    },
    bomStarter: [
      { quantity: 1, description: 'Microchip ATtiny85 Microcontroller', value: 'ATtiny85-20PU', package: 'DIP-8', notes: 'Core processing' },
      { quantity: 1, description: 'CR2032 3V Coin Cell Holder', value: 'CR2032 Socket', package: 'SMD-Holder', notes: 'Power source' }
    ],
    notebookEntries: [
      { type: 'DECISION', title: 'Disable ADC fully during sleep', content: 'We verified that leaving ADEN enabled consumes ~150uA even in deep sleep. Disabling it drops sleep current below 4uA.' }
    ],
    resources: [
      { title: 'ATtiny85 Datasheet', url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-2586-AVR-8-bit-Microcontroller-ATtiny25-ATtiny45-ATtiny85_Datasheet.pdf', type: 'datasheet' }
    ]
  }
]
