window.STEPS_DB = [
  {
    id: 1, total: 6,
    title: "Place the Breadboard",
    description: "Place the breadboard flat in the camera view with the power rails visible. Keep it well lit so the AR guide can detect it before you add the components.",
    requires: ["breadboard"],
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
    title: "Add LED and Buzzer Outputs",
    description: "Connect the red LED anode to digital pin 4 through a 220 ohm resistor and its cathode to GND. Connect the active 5V piezo buzzer positive pin to digital pin 3 and negative pin to GND.",
    requires: ["redled", "buzzer"],
    verifyLabel: "Verify",
  },
  {
    id: 6, total: 6,
    title: "Upload and Test",
    description: "Upload the Arduino sketch. When an object is detected within 15 cm, the LED and active piezo buzzer should turn on.",
    requires: ["redled", "ultrasonesensor", "buzzer"],
    verifyLabel: "Complete!",
  },
];
