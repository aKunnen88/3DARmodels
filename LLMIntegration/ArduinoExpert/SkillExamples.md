#### WITHOUT SKILL
Explain how i should do the wiring
To wire a Live Ultrasonic Sensor with your Arduino, follow these steps: 1. Connect VCC pin of the ultrasonic sensor to 5V on your Arduino. 2. Connect GND pin of the ultrasonic sensor to ground on your Arduino. 3. Connect TRIG pin (usually designated as 'Trigger' or 'In') from the ultrasonic sensor to any digital input pin on the Arduino (e.g., D2). 4. Connect ECHO pin (often called 'Echo' or 'Out') from the ultrasonic sensor to another digital input pin on the Arduino (e.g., D3). Ensure all connections are made securely with appropriate wire gauge. Make sure not to connect more than 50kΩ between VCC and GND as it could damage the sensor. After wiring, you can upload a sketch to read the distance using functions provided by the Arduino library for ultrasonic sensors, usually `pulseIn()`.

#### WITH SKILL
Give me a scheme ov the wiring
Certainly! Here's a clear depiction of how to wire the HC-SR04 ultrasonic distance sensor with an Arduino Uno: ### Wiring Diagram 1. **HC-SR04 Wires**: - VCC → 5V (Arduino) - GND → GND (Arduino) - Trig → D9 (Digital Pin 9 on Arduino) - Echo → D10 (Digital Pin 10 on Arduino) 2. **Power and Ground Connections:** - Connect the VCC pin of HC-SR04 to +5V on the Arduino board. - Connect the GND pin of HC-SR04 to the ground (GND) pin. 3. **Trigger Signal (Trig Pin):** - The Trig input is connected directly from D9 to the TRIG pin of the sensor. 4. **Echo Sensor (Echo Pin):** - The Echo output goes through a logic level shifter or a pull-up resistor to ensure proper signal reception on Analog In A10 for the Arduino. ### Schematic Representation ``` Arduino UNO: +-------------------+ | | v v +---------+-------------+ VCC → 5V | | | GND → GND | 5V | Trig(9) --> | VCC → 5V (HC-SR04)

---

## How you can see the skill was used or not

### Pin numbers — the clearest proof

The most obvious difference is the pin numbers the model chose for Trig and Echo.

**Without skill:** the model suggests D2 for Trig and D3 for Echo. These are just guesses — the model has no idea which pins this project uses, so it picks common example pins from generic Arduino tutorials.

**With skill:** the model answers D9 for Trig and D10 for Echo. These are exactly the values written in `Skill.md`. The model did not guess — it read the injected reference and copied the correct values.

### Wrong warning invented without the skill

Without the skill the model adds: *"Make sure not to connect more than 50kΩ between VCC and GND as it could damage the sensor."* This is not a real HC-SR04 rule. It does not appear anywhere in the datasheet or in `Skill.md`. The model hallucinated it because it had no grounding information to fall back on.

With the skill this warning disappears entirely and is replaced by accurate, specific wiring steps.

### Sensor name

Without the skill the model only says "ultrasonic sensor" in generic terms. With the skill it correctly names the component as the **HC-SR04** — again taken directly from the injected context.

### Summary table

| What to look at | Without skill | With skill |
|---|---|---|
| Trig pin | D2 — guessed wrong | D9 — correct, from Skill.md |
| Echo pin | D3 — guessed wrong | D10 — correct, from Skill.md |
| Sensor name | "ultrasonic sensor" (generic) | HC-SR04 (specific) |
| Fake warning | Yes — 50kΩ rule that does not exist | No |

The skill works by prepending the full content of `Skill.md` to the system prompt before every message. The model cannot make up pins because the correct ones are already in front of it.
