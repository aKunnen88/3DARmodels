// Arduino Components Knowledge Base
// Maps detected objects / keywords to component info

window.COMPONENTS_DB = {

  // ── Electronics (custom keyword matching via color/shape heuristics) ──────
  led: {
    id: "led",
    name: "LED",
    fullName: "Light Emitting Diode",
    icon: "💡",
    badge: "OUTPUT",
    badgeColor: "#f59e0b",
    color: "#fbbf24",
    desc: "An LED converts electrical energy directly into light. It has two legs: the longer one is the anode (+) and the shorter is the cathode (−). Always use a current-limiting resistor (220Ω–1kΩ) in series to prevent burnout.",
    specs: [
      { label: "Forward Voltage", value: "1.8 – 3.3 V" },
      { label: "Max Current", value: "20 mA" },
      { label: "Colors", value: "Red, Green, Blue, White, Yellow" },
      { label: "Package", value: "Through-hole / SMD" }
    ],
    tip: "🔌 Pro tip: Connect the long leg (anode) to a digital pin via a 220Ω resistor, and the short leg (cathode) to GND."
  },

  // Roboflow label "REDLed" → resolves to "redled"
  redled: {
    id: "redled",
    name: "LED (Red)",
    fullName: "Red Light Emitting Diode",
    icon: "💡",
    badge: "OUTPUT",
    badgeColor: "#f59e0b",
    color: "#fbbf24",
    desc: "A red LED converts electrical energy directly into red light. It has two legs: the longer one is the anode (+) and the shorter is the cathode (−). Red LEDs have the lowest forward voltage (~1.8 V) and are the most common type used in Arduino projects for status indicators and debugging.",
    specs: [
      { label: "Forward Voltage", value: "1.8 – 2.2 V" },
      { label: "Max Current", value: "20 mA" },
      { label: "Wavelength", value: "620 – 645 nm (Red)" },
      { label: "Resistor Needed", value: "220Ω (at 5 V)" }
    ],
    tip: "🔌 Pro tip: Connect the long leg (anode) to a digital pin via a 220Ω resistor, and the short leg (cathode) to GND. Use analogWrite() for dimming!"
  },

  photoresistor: {
    id: "photoresistor",
    name: "Photoresistor",
    fullName: "LDR – Light Dependent Resistor",
    icon: "☀️",
    badge: "SENSOR",
    badgeColor: "#10b981",
    color: "#34d399",
    desc: "A photoresistor (LDR) changes its resistance based on light intensity. In bright light, resistance drops; in darkness, it rises (up to several MΩ). Used as the light sensor in your bachelor project!",
    specs: [
      { label: "Dark Resistance", value: "1 MΩ (typical)" },
      { label: "Light Resistance", value: "1 – 10 kΩ" },
      { label: "Voltage", value: "3.3 – 5 V" },
      { label: "Response Time", value: "~20 ms" }
    ],
    tip: "🔌 Pro tip: Wire it in a voltage-divider with a 10kΩ resistor to GND, then read the middle point with analogRead()."
  },

  arduino: {
    id: "arduino",
    name: "Arduino",
    fullName: "Arduino Microcontroller Board",
    icon: "🔧",
    badge: "MCU",
    badgeColor: "#3b82f6",
    color: "#60a5fa",
    desc: "The Arduino is an open-source microcontroller platform. It reads sensors, controls actuators, and communicates over Serial/MQTT. Your project uses it to stream sensor data to InfluxDB via MQTT.",
    specs: [
      { label: "MCU", value: "ATmega328P / ESP32" },
      { label: "Digital I/O", value: "14 pins" },
      { label: "Analog In", value: "6 pins (10-bit ADC)" },
      { label: "Clock Speed", value: "16 MHz" }
    ],
    tip: "🔌 Pro tip: Use Serial.begin(115200) to match your project's BAUD_RATE and stream data to the PC."
  },

  resistor: {
    id: "resistor",
    name: "Resistor",
    fullName: "Carbon Film Resistor",
    icon: "⚡",
    badge: "PASSIVE",
    badgeColor: "#8b5cf6",
    color: "#a78bfa",
    desc: "Resistors limit current flow in a circuit. They're colour-coded — read the bands from left to right. Essential for protecting LEDs and creating voltage dividers for analog sensors.",
    specs: [
      { label: "Common Values", value: "220Ω, 1kΩ, 10kΩ" },
      { label: "Tolerance", value: "±5% (gold band)" },
      { label: "Power Rating", value: "0.25 W (typical)" },
      { label: "Type", value: "Through-hole / SMD" }
    ],
    tip: "🎨 Colour code: Brown-Black-Red = 1kΩ. Use a resistor calculator app or remember 'BB ROY of Great Britain had a Very Good Wife'."
  },

  capacitor: {
    id: "capacitor",
    name: "Capacitor",
    fullName: "Electrolytic Capacitor",
    icon: "🔋",
    badge: "PASSIVE",
    badgeColor: "#8b5cf6",
    color: "#c4b5fd",
    desc: "Capacitors store and release electrical energy. Electrolytic caps are polarized (mind the + leg!). They're used for power-supply decoupling, filtering, and timing circuits.",
    specs: [
      { label: "Common Values", value: "100nF, 10µF, 100µF" },
      { label: "Max Voltage", value: "6.3 – 63 V (rated)" },
      { label: "Type", value: "Ceramic / Electrolytic / Tantalum" },
      { label: "Polarized", value: "Yes (electrolytic)" }
    ],
    tip: "⚠️ Always check polarity on electrolytic caps — the white stripe marks the negative (−) leg."
  },

  breadboard: {
    id: "breadboard",
    name: "Breadboard",
    fullName: "Solderless Prototype Breadboard",
    icon: "🧩",
    badge: "TOOL",
    badgeColor: "#6b7280",
    color: "#9ca3af",
    desc: "Breadboards let you prototype circuits without soldering. Rows in the middle are connected horizontally in groups of 5. The long rails on the sides (+/−) are connected vertically for power.",
    specs: [
      { label: "Tie Points", value: "400 / 830 (full-size)" },
      { label: "Pitch", value: "2.54 mm" },
      { label: "Wire Gauge", value: "20–29 AWG" },
      { label: "Reusable", value: "Yes" }
    ],
    tip: "💡 Always connect power rails first: 5V (red) and GND (blue/black) from your Arduino before adding components."
  },

  ultrasonesensor: {
    id: "ultrasonesensor",
    name: "Ultrasone Sensor",
    fullName: "HC-SR04 Ultrasonic Distance Sensor",
    icon: "📡",
    badge: "SENSOR",
    badgeColor: "#10b981",
    color: "#34d399",
    desc: "The HC-SR04 ultrasonic sensor measures distance by sending a 40 kHz sound pulse and timing the echo. It has four pins: VCC, Trig, Echo, and GND. Ideal for obstacle detection, level measurement, and proximity sensing in Arduino projects.",
    specs: [
      { label: "Range", value: "2 cm – 400 cm" },
      { label: "Accuracy", value: "±3 mm" },
      { label: "Operating Voltage", value: "5 V" },
      { label: "Trigger Pulse", value: "10 µs HIGH" }
    ],
    tip: "🔌 Pro tip: Connect Trig to a digital pin, Echo to another. Use pulseIn(echoPin, HIGH) to measure the round-trip time, then divide by 58 to get distance in cm."
  },

  // ── COCO-SSD default classes mapped to electronics context ───────────────
  cell_phone: {
    id: "cell_phone",
    name: "Smartphone",
    fullName: "Mobile Phone / Tablet",
    icon: "📱",
    badge: "DEVICE",
    badgeColor: "#0ea5e9",
    color: "#38bdf8",
    desc: "You're using your phone as the AR viewer! The camera feed is processed in real-time using TensorFlow.js and COCO-SSD running entirely in your browser — no server needed.",
    specs: [
      { label: "Detection", value: "COCO-SSD (TF.js)" },
      { label: "Processing", value: "On-device (GPU/CPU)" },
      { label: "Model Size", value: "~6 MB" },
      { label: "FPS", value: "10–20 fps (mobile)" }
    ],
    tip: "💡 This entire AR system runs offline in your browser. No data is sent to any server."
  },

  laptop: {
    id: "laptop",
    name: "Laptop / PC",
    fullName: "Development Computer",
    icon: "💻",
    badge: "DEVICE",
    badgeColor: "#0ea5e9",
    color: "#38bdf8",
    desc: "Your development machine! It runs the Node.js bridge that reads Arduino serial data, publishes it to the HiveMQ MQTT broker, and writes it to InfluxDB for dashboarding.",
    specs: [
      { label: "MQTT Broker", value: "HiveMQ Cloud" },
      { label: "Database", value: "InfluxDB" },
      { label: "Serial Baud", value: "115200" },
      { label: "Platform", value: "Node.js" }
    ],
    tip: "🔌 Your project uses COM5 for serial — remember to update SERIAL_PORT in .env if the port changes."
  },

  book: {
    id: "book",
    name: "Datasheet / Manual",
    fullName: "Component Datasheet or Manual",
    icon: "📖",
    badge: "DOCS",
    badgeColor: "#f97316",
    color: "#fb923c",
    desc: "Datasheets are the bible of electronics. They contain pinouts, voltage ratings, timing diagrams, and application circuits. Always check the datasheet before wiring an unknown component.",
    specs: [
      { label: "Find at", value: "datasheet.live, alldatasheet.com" },
      { label: "Key sections", value: "Absolute Max Ratings, Pinout" },
      { label: "Format", value: "PDF" },
      { label: "Essential?", value: "Absolutely yes" }
    ],
    tip: "📚 Search '[component name] datasheet PDF' — always download the manufacturer's original, not a clone site."
  },

  // Fallback / unknown
  unknown: {
    id: "unknown",
    name: "Unknown Object",
    fullName: "Unrecognised Component",
    icon: "🔍",
    badge: "SCANNING",
    badgeColor: "#6b7280",
    color: "#9ca3af",
    desc: "This object wasn't matched to a known Arduino component. Try holding it closer to the camera, improve lighting, or point at specific electronics like LEDs, resistors, or the Arduino board.",
    specs: [
      { label: "Tip", value: "Improve lighting & angle" },
      { label: "Distance", value: "Keep object 15–30 cm away" }
    ],
    tip: "💡 Tap any detected object's bubble to learn more about it."
  }
};

// Map COCO-SSD class names → component IDs
window.CLASS_MAP = {
  "cell phone": "cell_phone",
  "laptop":     "laptop",
  "book":       "book",
  "keyboard":   "laptop",
  "mouse":      "laptop",
  "remote":     "arduino",
  "scissors":   "resistor",
  "bottle":     "capacitor",
  "cup":        "breadboard",
  "clock":      "photoresistor",
};

// Heuristic: map any detected rectangle with bright red/orange dominant colour → LED
window.COLOR_HINTS = {
  // populated at runtime by ar-engine.js canvas sampling
};
