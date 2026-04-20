window.STEPS_DB = [
  {
    id: 1, total: 6,
    title: "Place the Arduino Uno",
    description: "Set the Arduino Uno on the breadboard base, USB port facing away from you. Align the pin headers with rows 1–5.",
    requires: [],
    verifyLabel: "Verify",
  },
  {
    id: 2, total: 6,
    title: "Mount the Ultrasonic Sensor",
    description: "Insert HC-SR04 into rows 6–9 of the breadboard, sensor eyes facing outward.",
    requires: ["ultrasonesensor"],
    verifyLabel: "Verify",
  },
  {
    id: 3, total: 6,
    title: "Wire VCC and GND",
    description: "Connect HC-SR04 VCC to Arduino 5V and GND to Arduino GND using jumper wires.",
    requires: ["ultrasonesensor"],
    verifyLabel: "Verify",
  },
  {
    id: 4, total: 6,
    title: "Connect Trigger and Echo",
    description: "Wire HC-SR04 TRIG to digital pin 9 and ECHO to digital pin 10 on the Arduino.",
    requires: ["ultrasonesensor"],
    verifyLabel: "Verify",
  },
  {
    id: 5, total: 6,
    title: "Add the LED Indicator",
    description: "Insert the red LED into row 12. Long leg (anode) to pin 13 via 220Ω resistor. Short leg to GND.",
    requires: ["redled"],
    verifyLabel: "Verify",
  },
  {
    id: 6, total: 6,
    title: "Upload and Test",
    description: "Upload the Arduino sketch. The LED should blink when an object is detected within 30 cm.",
    requires: ["redled", "ultrasonesensor"],
    verifyLabel: "Complete!",
  },
];
