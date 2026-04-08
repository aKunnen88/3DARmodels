---
description: Add a new detectable object to the AR Explorer app (Teachable Machine + component DB entry)
---

# Add New AR Object Workflow

This workflow guides you through adding a new detectable object to the AR Explorer application.
It covers: Teachable Machine model training, class-name registration, and full component-db entry creation.

---

## Phase 1 — Gather Information (ASK the user)

Before writing any code, ask the user the following questions **one by one** and wait for answers:

1. **Object name**: "What is the name of the component you want to add? (e.g. Servo Motor, Buzzer, IR Sensor)"
2. **Full / technical name**: "What is the full technical name? (e.g. SG90 Micro Servo Motor)"
3. **Category badge**: "What category does it belong to? Choose one: `SENSOR`, `OUTPUT`, `PASSIVE`, `MCU`, `TOOL`, `DEVICE`, `DOCS`"
4. **Icon emoji**: "Pick an emoji icon for the AR bubble (e.g. 🔔 for buzzer, 🔄 for servo)"
5. **Short description**: "Give a 1-3 sentence description of what this component does and how it works."
6. **Specs** (up to 4): "List up to 4 key specs as `Label: Value` pairs. Example:\n   - Operating Voltage: 3.3 – 5 V\n   - Range: 0° – 180°"
7. **Pro tip**: "Any wiring tip or gotcha for beginners? Start with an emoji."
8. **Teachable Machine class name**: "What **exact** class name did you (or will you) use in Google Teachable Machine for this object? This must match exactly. Examples: `ServoMotor`, `Buzzer`, `IRSensor`. If you haven't trained yet, we'll decide the name now and you'll use it during training."

---

## Phase 2 — Teachable Machine Training Guidance

After collecting the info above, tell the user:

> ### 🧠 Teachable Machine Training
>
> Before the AR app can detect your new object, you need to retrain the model:
>
> 1. Open your existing project at **[Google Teachable Machine](https://teachablemachine.withgoogle.com/train/image)**
>    - Or load the current model from: `https://teachablemachine.withgoogle.com/models/5HBj-fn_i/`
> 2. **Add a new class** named exactly: `<THE CLASS NAME FROM STEP 8>`
>    - ⚠️ This must match EXACTLY (case-sensitive) — the AR engine converts it to lowercase with underscores internally
> 3. **Capture training samples** (minimum 50 images recommended):
>    - Vary angle, distance (15–30 cm), lighting, and background
>    - Include some partial views and rotated shots
>    - Avoid having other detectable components in frame
> 4. **Also update the `Background` class** with new background samples if your environment changed
> 5. Click **Train Model** and wait for it to finish
> 6. Click **Export Model** → choose **Tensorflow.js** → **Upload** → copy the new share URL
> 7. Tell me the new model URL so I can update `ar-engine.js`
>
> 💡 If the model URL changed, I will update the `MODEL_URL` constant in:
> `ar-output/ar-output/js/ar-engine.js` (line 34)

Wait for the user to confirm they've trained the model (or want to skip and add the DB entry first).

---

## Phase 3 — Update Model URL (if changed)

If the user provides a **new** Teachable Machine model URL:

1. Open `c:\Projects\BachelorProef\ar-output\ar-output\js\ar-engine.js`
2. Find the line: `const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/...';`
3. Replace the URL with the new one the user provided (keep the trailing `/`)

---

## Phase 4 — Add Component to Database

Open `c:\Projects\BachelorProef\ar-output\ar-output\js\components-db.js` and add a new entry.

### 4.1 — Determine the DB key

The key must match what `resolveComponent()` in `ar-engine.js` produces:
```
className.toLowerCase().replace(/\s+/g, '_')
```

So if the Teachable Machine class is `ServoMotor`, the DB key is `servomotor`.
If the class is `IR Sensor`, the DB key is `ir_sensor`.

### 4.2 — Insert the entry

Add the new entry **before** the `// ── COCO-SSD default classes` comment block (around line 133).

Use this exact template, filled in with the user's answers:

```javascript
  <db_key>: {
    id: "<db_key>",
    name: "<Object Name>",
    fullName: "<Full Technical Name>",
    icon: "<emoji>",
    badge: "<CATEGORY>",
    badgeColor: "<badge_color>",
    color: "<marker_color>",
    desc: "<description>",
    specs: [
      { label: "<Label1>", value: "<Value1>" },
      { label: "<Label2>", value: "<Value2>" },
      { label: "<Label3>", value: "<Value3>" },
      { label: "<Label4>", value: "<Value4>" }
    ],
    tip: "<pro_tip>"
  },
```

### 4.3 — Badge color reference

Pick `badgeColor` based on the category:

| Badge     | badgeColor  | marker color |
|-----------|-------------|--------------|
| SENSOR    | `#10b981`   | `#34d399`    |
| OUTPUT    | `#f59e0b`   | `#fbbf24`    |
| PASSIVE   | `#8b5cf6`   | `#a78bfa`    |
| MCU       | `#3b82f6`   | `#60a5fa`    |
| TOOL      | `#6b7280`   | `#9ca3af`    |
| DEVICE    | `#0ea5e9`   | `#38bdf8`    |
| DOCS      | `#f97316`   | `#fb923c`    |

If the user wants a custom color, let them pick — otherwise use the table above.

---

## Phase 5 — Verify

After making the changes:

1. Confirm the new entry is valid JSON/JS (no trailing commas, correct quotes)
2. Read back the key, name, and class mapping to the user:
   > ✅ **Done!** Here's the mapping:
   > - Teachable Machine class: `<ClassName>`
   > - Resolves to DB key: `<db_key>`
   > - Marker label: `<name>`
   > - Panel title: `<fullName>`
3. Remind the user to **deploy / refresh** the hosted site to see the changes
4. If the model URL was updated, mention that too

---

## File Reference

| File | Purpose |
|------|---------|
| `ar-output/ar-output/js/components-db.js` | Component knowledge base — add new entries here |
| `ar-output/ar-output/js/ar-engine.js` | AR engine — `MODEL_URL` (line 34) and `resolveComponent()` (line 156) |
| `ar-output/ar-output/index.html` | Main HTML — no changes needed for new objects |
| `ar-output/ar-output/css/style.css` | Styles — no changes needed for new objects |

---

## Quick Example

User says: *"I want to add a Servo Motor"*

→ After Q&A, the result would be:

```javascript
  servomotor: {
    id: "servomotor",
    name: "Servo Motor",
    fullName: "SG90 Micro Servo Motor",
    icon: "🔄",
    badge: "OUTPUT",
    badgeColor: "#f59e0b",
    color: "#fbbf24",
    desc: "A servo motor rotates to a precise angle (0°–180°) based on a PWM signal. It has three wires: power (red), ground (brown/black), and signal (orange/yellow). Used for robotic arms, pan-tilt cameras, and door locks.",
    specs: [
      { label: "Rotation Range", value: "0° – 180°" },
      { label: "Operating Voltage", value: "4.8 – 6 V" },
      { label: "Torque", value: "1.8 kg·cm" },
      { label: "Signal", value: "50 Hz PWM" }
    ],
    tip: "🔌 Pro tip: Connect signal to a PWM pin and use the Servo library: myServo.attach(9); myServo.write(90);"
  },
```

Teachable Machine class name: `ServoMotor` → resolves to `servomotor` ✅
