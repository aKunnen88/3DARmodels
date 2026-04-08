using UnityEngine;
using UnityEditor;

namespace ARExplorer.Data
{
    /// <summary>
    /// Editor-only utility: populates a ComponentDatabase asset with
    /// all default Arduino components (mirrors components-db.js).
    /// 
    /// Usage in Unity:
    ///   1. Create a ComponentDatabase asset (Assets → Create → AR Explorer → Component Database)
    ///   2. Select the asset
    ///   3. In the Inspector, right-click the component → "Load Default Components"
    ///      OR call DefaultComponentLoader.Populate(database) from an editor script.
    /// </summary>
#if UNITY_EDITOR
    public static class DefaultComponentLoader
    {
        [MenuItem("AR Explorer/Populate Default Components")]
        public static void PopulateSelected()
        {
            var db = Selection.activeObject as ComponentDatabase;
            if (db == null)
            {
                Debug.LogError("Select a ComponentDatabase asset first!");
                return;
            }
            Populate(db);
            EditorUtility.SetDirty(db);
            AssetDatabase.SaveAssets();
            Debug.Log("✅ Default components loaded into database.");
        }

        public static void Populate(ComponentDatabase db)
        {
            var list = db.GetAll();
            list.Clear();

            // ── LED (generic) ─────────────────────────────────────
            list.Add(new ComponentData
            {
                id = "led",
                displayName = "LED",
                fullName = "Light Emitting Diode",
                classLabel = "Led",
                icon = "💡",
                badge = "OUTPUT",
                badgeColor = HexColor("#f59e0b"),
                markerColor = HexColor("#fbbf24"),
                description = "An LED converts electrical energy directly into light. It has two legs: the longer one is the anode (+) and the shorter is the cathode (−). Always use a current-limiting resistor (220Ω–1kΩ) in series to prevent burnout.",
                specs = new[]
                {
                    new SpecEntry { label = "Forward Voltage", value = "1.8 – 3.3 V" },
                    new SpecEntry { label = "Max Current", value = "20 mA" },
                    new SpecEntry { label = "Colors", value = "Red, Green, Blue, White, Yellow" },
                    new SpecEntry { label = "Package", value = "Through-hole / SMD" }
                },
                proTip = "🔌 Connect the long leg (anode) to a digital pin via a 220Ω resistor, and the short leg (cathode) to GND."
            });

            // ── LED Red (Teachable Machine class: LEDRed) ─────────
            list.Add(new ComponentData
            {
                id = "ledred",
                displayName = "LED (Red)",
                fullName = "Red Light Emitting Diode",
                classLabel = "LEDRed",
                icon = "💡",
                badge = "OUTPUT",
                badgeColor = HexColor("#f59e0b"),
                markerColor = HexColor("#fbbf24"),
                description = "A red LED converts electrical energy directly into red light. Red LEDs have the lowest forward voltage (~1.8V) and are the most common type used in Arduino projects for status indicators and debugging.",
                specs = new[]
                {
                    new SpecEntry { label = "Forward Voltage", value = "1.8 – 2.2 V" },
                    new SpecEntry { label = "Max Current", value = "20 mA" },
                    new SpecEntry { label = "Wavelength", value = "620 – 645 nm (Red)" },
                    new SpecEntry { label = "Resistor Needed", value = "220Ω (at 5 V)" }
                },
                proTip = "🔌 Connect the long leg (anode) to a digital pin via a 220Ω resistor, and the short leg (cathode) to GND. Use analogWrite() for dimming!"
            });

            // ── Breadboard ────────────────────────────────────────
            list.Add(new ComponentData
            {
                id = "breadboard",
                displayName = "Breadboard",
                fullName = "Solderless Prototype Breadboard",
                classLabel = "BreadBoard",
                icon = "🧩",
                badge = "TOOL",
                badgeColor = HexColor("#6b7280"),
                markerColor = HexColor("#9ca3af"),
                description = "Breadboards let you prototype circuits without soldering. Rows in the middle are connected horizontally in groups of 5. The long rails on the sides (+/−) are connected vertically for power.",
                specs = new[]
                {
                    new SpecEntry { label = "Tie Points", value = "400 / 830 (full-size)" },
                    new SpecEntry { label = "Pitch", value = "2.54 mm" },
                    new SpecEntry { label = "Wire Gauge", value = "20–29 AWG" },
                    new SpecEntry { label = "Reusable", value = "Yes" }
                },
                proTip = "💡 Always connect power rails first: 5V (red) and GND (blue/black) from your Arduino before adding components."
            });

            // ── Ultrasone Sensor ──────────────────────────────────
            list.Add(new ComponentData
            {
                id = "ultrasonesensor",
                displayName = "Ultrasone Sensor",
                fullName = "HC-SR04 Ultrasonic Distance Sensor",
                classLabel = "UltrasoneSensor",
                icon = "📡",
                badge = "SENSOR",
                badgeColor = HexColor("#10b981"),
                markerColor = HexColor("#34d399"),
                description = "The HC-SR04 ultrasonic sensor measures distance by sending a 40 kHz sound pulse and timing the echo. It has four pins: VCC, Trig, Echo, and GND.",
                specs = new[]
                {
                    new SpecEntry { label = "Range", value = "2 cm – 400 cm" },
                    new SpecEntry { label = "Accuracy", value = "±3 mm" },
                    new SpecEntry { label = "Operating Voltage", value = "5 V" },
                    new SpecEntry { label = "Trigger Pulse", value = "10 µs HIGH" }
                },
                proTip = "🔌 Connect Trig to a digital pin, Echo to another. Use pulseIn(echoPin, HIGH) to measure the round-trip time, then divide by 58 to get distance in cm."
            });

            // ── Photoresistor ─────────────────────────────────────
            list.Add(new ComponentData
            {
                id = "photoresistor",
                displayName = "Photoresistor",
                fullName = "LDR – Light Dependent Resistor",
                classLabel = "Photoresistor",
                icon = "☀️",
                badge = "SENSOR",
                badgeColor = HexColor("#10b981"),
                markerColor = HexColor("#34d399"),
                description = "A photoresistor (LDR) changes its resistance based on light intensity. In bright light, resistance drops; in darkness, it rises (up to several MΩ).",
                specs = new[]
                {
                    new SpecEntry { label = "Dark Resistance", value = "1 MΩ (typical)" },
                    new SpecEntry { label = "Light Resistance", value = "1 – 10 kΩ" },
                    new SpecEntry { label = "Voltage", value = "3.3 – 5 V" },
                    new SpecEntry { label = "Response Time", value = "~20 ms" }
                },
                proTip = "🔌 Wire it in a voltage-divider with a 10kΩ resistor to GND, then read the middle point with analogRead()."
            });

            // ── Arduino ───────────────────────────────────────────
            list.Add(new ComponentData
            {
                id = "arduino",
                displayName = "Arduino",
                fullName = "Arduino Microcontroller Board",
                classLabel = "Arduino",
                icon = "🔧",
                badge = "MCU",
                badgeColor = HexColor("#3b82f6"),
                markerColor = HexColor("#60a5fa"),
                description = "The Arduino is an open-source microcontroller platform. It reads sensors, controls actuators, and communicates over Serial/MQTT.",
                specs = new[]
                {
                    new SpecEntry { label = "MCU", value = "ATmega328P / ESP32" },
                    new SpecEntry { label = "Digital I/O", value = "14 pins" },
                    new SpecEntry { label = "Analog In", value = "6 pins (10-bit ADC)" },
                    new SpecEntry { label = "Clock Speed", value = "16 MHz" }
                },
                proTip = "🔌 Use Serial.begin(115200) to match your project's BAUD_RATE and stream data to the PC."
            });

            // ── Resistor ──────────────────────────────────────────
            list.Add(new ComponentData
            {
                id = "resistor",
                displayName = "Resistor",
                fullName = "Carbon Film Resistor",
                classLabel = "Resistor",
                icon = "⚡",
                badge = "PASSIVE",
                badgeColor = HexColor("#8b5cf6"),
                markerColor = HexColor("#a78bfa"),
                description = "Resistors limit current flow in a circuit. They're colour-coded — read the bands from left to right.",
                specs = new[]
                {
                    new SpecEntry { label = "Common Values", value = "220Ω, 1kΩ, 10kΩ" },
                    new SpecEntry { label = "Tolerance", value = "±5% (gold band)" },
                    new SpecEntry { label = "Power Rating", value = "0.25 W (typical)" },
                    new SpecEntry { label = "Type", value = "Through-hole / SMD" }
                },
                proTip = "🎨 Colour code: Brown-Black-Red = 1kΩ."
            });

            // ── Capacitor ─────────────────────────────────────────
            list.Add(new ComponentData
            {
                id = "capacitor",
                displayName = "Capacitor",
                fullName = "Electrolytic Capacitor",
                classLabel = "Capacitor",
                icon = "🔋",
                badge = "PASSIVE",
                badgeColor = HexColor("#8b5cf6"),
                markerColor = HexColor("#c4b5fd"),
                description = "Capacitors store and release electrical energy. Electrolytic caps are polarized (mind the + leg!).",
                specs = new[]
                {
                    new SpecEntry { label = "Common Values", value = "100nF, 10µF, 100µF" },
                    new SpecEntry { label = "Max Voltage", value = "6.3 – 63 V (rated)" },
                    new SpecEntry { label = "Type", value = "Ceramic / Electrolytic / Tantalum" },
                    new SpecEntry { label = "Polarized", value = "Yes (electrolytic)" }
                },
                proTip = "⚠️ Always check polarity on electrolytic caps — the white stripe marks the negative (−) leg."
            });

            // ── Unknown (fallback) ────────────────────────────────
            list.Add(new ComponentData
            {
                id = "unknown",
                displayName = "Unknown Object",
                fullName = "Unrecognised Component",
                classLabel = "Unknown",
                icon = "🔍",
                badge = "SCANNING",
                badgeColor = HexColor("#6b7280"),
                markerColor = HexColor("#9ca3af"),
                description = "This object wasn't matched to a known Arduino component. Try holding it closer, improve lighting, or point at specific electronics.",
                specs = new[]
                {
                    new SpecEntry { label = "Tip", value = "Improve lighting & angle" },
                    new SpecEntry { label = "Distance", value = "Keep object 15–30 cm away" }
                },
                proTip = "💡 Gaze at any detected object's bubble to learn more about it."
            });

            db.InvalidateCache();
        }

        private static Color HexColor(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out Color c);
            return c;
        }
    }
#endif
}
