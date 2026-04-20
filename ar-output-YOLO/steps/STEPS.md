# AR Explorer — Professional 3D UI Redesign Plan

> **Goal:** Transform the current `ar-output-YOLO/ar-output` Arduino AR Explorer into a spatial, cinematic AR experience. Components detected by YOLO get **white leader beams** projecting from the physical opstelling to numbered callouts (like the "Vision Guide" laptop repair overlay). Information lives on **clean, glassy, curved floating panels** arranged around the target in world space (like the spatial "Goals" board reference). A floating AI dock provides context-aware guidance.
>
> **Audience:** Claude Sonnet 4.6 executing autonomously. Each step is self-contained with exact file paths, acceptance criteria, and code hints.
>
> **Working directory:** `ar-output-YOLO/ar-output/`
> **Do not touch:** `targets.mind`, Roboflow API keys, MQTT credentials — those are configured and working.

---

## Design Pillars (keep in mind across every step)

1. **World-anchored, not screen-glued.** Every info element lives in 3D space relative to the MindAR anchor — when the user moves, panels stay put in the room.
2. **Glassmorphism + neutral palette.** Frosted white/off-white panels, subtle inner glow, 1px rgba(255,255,255,0.25) borders, backdrop-blur, soft drop shadows. Accent color: cool cyan `#7DD3FC`. No gradients wilder than 15° hue shift.
3. **White leader beams** (not colored) connect physical component → floating callout. Thin (2–3px visual), slightly glowing, with a small dot at the physical end and a numbered pill at the panel end.
4. **Typography:** Inter or SF Pro stack, 600 weight for titles, 400 for body, generous letter-spacing (0.02em) on ALL-CAPS labels.
5. **Motion:** Everything eases in with `cubic-bezier(0.22, 1, 0.36, 1)` over 400–600ms. Panels *breathe* (subtle 2% scale loop). Leader beams draw in sequence, not all at once.
6. **Minimum text.** Each floating panel shows ONE thing well. No dense spec dumps in the primary view — those move to expansion.

---

## Phase 0 — Scaffolding & Shared Primitives

### Step 0.1 — Add a `three-extras.js` module for shared 3D helpers

**File:** `ar-output-YOLO/ar-output/js/three-extras.js` *(new)*

Create reusable helpers used across later steps. Export as ES module.

- `createGlassPanel({ width, height, radius=0.08, tint=0xffffff })` — returns a `THREE.Group` containing:
  - A rounded-rectangle `ShapeGeometry` with a `MeshBasicMaterial` (color `tint`, transparent, opacity 0.18).
  - A thin outline (`EdgesGeometry` → `LineBasicMaterial`, opacity 0.35).
  - An inner soft-glow plane (slightly larger, opacity 0.05) for faux-blur bloom.
  - A `.setContent(htmlElement)` method that rasterizes a DOM element via `CSS3DObject` *or* `html-to-canvas` → texture. **Prefer `CSS3DRenderer`** since we already have DOM styling — import from `three/addons/renderers/CSS3DRenderer.js`.
- `createLeaderBeam(startVec3, endVec3, { color=0xffffff, opacity=0.9 })` — returns a `THREE.Line` (or `TubeGeometry` for thickness) plus a small glowing `SphereGeometry` endcap at `startVec3`. Include an `animate(t)` method that draws the line progressively (use `setDrawRange`).
- `createNumberedPill(number, color=0xfde047)` — returns a `THREE.Group` with a circular badge (yellow by default, like the reference laptop callouts) showing the number, floating as a billboarded `Sprite` so it always faces the camera.

**Acceptance:** importing these helpers in a console test scene renders a glass panel + beam + pill correctly.

---

### Step 0.2 — Introduce a `CSS3DRenderer` alongside the existing WebGL renderer

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js`

- Import `CSS3DRenderer` from `three/addons/renderers/CSS3DRenderer.js`.
- Create a second renderer, size it to window, pointer-events: none, z-index: 2 (above the WebGL canvas). Add `renderer.domElement` to `document.body`.
- On every frame (`setAnimationLoop`), call `cssRenderer.render(scene, camera)` after `renderer.render(...)`.
- Add a new `worldUIGroup` (`THREE.Group`) to `mindarAnchorGroup` — all floating 3D UI will attach here so it inherits the MindAR tracking transform.

**Acceptance:** a test `CSS3DObject` placed at `worldUIGroup.position.set(0, 0.3, 0)` appears hovering above the detected target image, moves with it, and disappears when target is lost.

---

### Step 0.3 — Typography & global CSS tokens

**File:** `ar-output-YOLO/ar-output/css/style.css`

At the top of the file (inside `:root`), add / normalize:

```css
:root {
  --glass-bg:        rgba(255, 255, 255, 0.10);
  --glass-border:    rgba(255, 255, 255, 0.22);
  --glass-highlight: rgba(255, 255, 255, 0.35);
  --text-primary:    #F8FAFC;
  --text-secondary:  rgba(248, 250, 252, 0.72);
  --accent:          #7DD3FC;
  --beam:            rgba(255, 255, 255, 0.95);
  --pill-yellow:     #FDE047;
  --pill-ink:        #0B1220;
  --radius-card:     18px;
  --ease-smooth:     cubic-bezier(0.22, 1, 0.36, 1);
  --shadow-float:    0 20px 60px -20px rgba(0, 0, 0, 0.45),
                      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

@import url('https://rsms.me/inter/inter.css');
html { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
```

Create a reusable utility class `.glass-card`:

```css
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-float);
  color: var(--text-primary);
}
```

**Acceptance:** adding `class="glass-card"` to any existing panel gives it the unified frosted look.

---

## Phase 1 — White Leader Beams (the "Vision Guide" effect)

### Step 1.1 — Project YOLO detections into 3D anchor space

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js`

Currently `syncMarkers(preds)` places flat DOM markers at screen coords. We need the beam *start* to be in the world (on the physical component) and the *end* to be a floating panel in 3D.

- Add `function deriveAnchorLocal(screenX, screenY)` that raycasts from `mindarCamera` through the pixel into the plane of `mindarAnchorGroup`, returning a `THREE.Vector3` in **anchor-local** coordinates. Use `THREE.Raycaster.setFromCamera()` + a `THREE.Plane` at the anchor group's orientation.
- For each prediction, compute `localStart = deriveAnchorLocal(centerX, centerY)` once per detection update.
- Layout rule for the callout end position: start at `localStart + offsetRing(i)` where `offsetRing` distributes callouts in a ring around the opstelling, radius 0.35 (anchor units), angular step = `360°/detectionCount`, tilted forward (y += 0.12) so panels float above the board.

**Acceptance:** logging the derived start/end vectors for a test detection produces stable values that track when the phone moves.

---

### Step 1.2 — Render the white beam in 3D

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js` + `three-extras.js`

- For each detection, create (or reuse) a `createLeaderBeam(localStart, localEnd)` and add it to `worldUIGroup`.
- Material: `LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, linewidth: 2 })`. Because WebGL line width is fixed at 1 on most drivers, **fall back to `Line2` + `LineMaterial`** from `three/addons/lines/` for real thickness. Set `worldUnits: false, linewidth: 3`.
- Draw-in animation: on creation, set `geometry.setDrawRange(0, 0)` then tween to full in 350ms staggered 80ms per beam. Store a per-beam `progress` value on the object.
- At `localStart` place a small white glowing sphere (radius 0.008, `MeshBasicMaterial`, additive blending) — the "anchor dot" on the physical component.

**Acceptance:** detected components each get a crisp white line rising from their physical position into the air around the opstelling, drawn in sequence. Lines bend nicely with camera perspective.

---

### Step 1.3 — Numbered callout pills at the beam tips

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js`

- Replace the current DOM `.ar-marker` with a `CSS3DObject` containing a compact pill (`<div class="callout-pill">1</div>`), positioned at `localEnd` inside `worldUIGroup`.
- Pill CSS (add to `style.css`):

```css
.callout-pill {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--pill-yellow); color: var(--pill-ink);
  font-weight: 700; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.85) inset;
  cursor: pointer;
  transition: transform 220ms var(--ease-smooth);
}
.callout-pill:hover { transform: scale(1.12); }
.callout-pill.active { background: #fff; }
```

- Tapping a pill opens the component's floating info panel (see Phase 2) anchored next to that pill. Old `openPanel()` logic is reused but the presentation surface changes.
- Keep the pill billboarded toward camera each frame: `pill.quaternion.copy(mindarCamera.quaternion)`.

**Acceptance:** every detected component has a yellow numbered pill at the end of its white beam. Tapping pill highlights it (white fill) and opens that component's floating panel.

---

### Step 1.4 — Delete/retire the old 2D overlay HUD elements

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js`, `index.html`, `style.css`

- Remove `drawCornerBrackets()`, the `#overlay` `<canvas>`, and the old `.ar-marker` DOM creation — all replaced by 3D primitives. Delete the corresponding CSS rules.
- Keep the `#overlay` tag out of the new layout. Keep `#hud` top bar minimal (just status).

**Acceptance:** no more flat screen-space bounding boxes; only the 3D world UI is visible during tracking.

---

## Phase 2 — Floating Curved Panels (the "Spatial Goals Board" effect)

### Step 2.1 — Design the panel layout around the opstelling

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js`

Define three primary floating panels that materialize once the target is detected:

| Slot | Content | Local position (anchor units) | Rotation |
|------|---------|--------------------------------|----------|
| LEFT | **Overview / Project description** | `(-0.55, 0.25, 0.15)` | `yaw +22°` |
| CENTER | **Live Measurements** (ultrasonic cm, LED status, MQTT health) | `(0, 0.35, 0.25)` | flat, pitch -10° |
| RIGHT | **AI Assistant** | `(0.55, 0.25, 0.15)` | `yaw -22°` |

The slight yaw on left/right panels creates the **curved triptych** look from the reference image — they face the user like a concave wall of glass.

- Each panel is a `CSS3DObject` attached to `worldUIGroup`, 400×260 CSS px, scaled down via `CSS3DObject.scale.set(0.0016, 0.0016, 0.0016)` so 1 CSS px ≈ 1.6mm in world units.

**Acceptance:** three panels appear in 3D space around the detected target, visually forming a curved arc facing the camera.

---

### Step 2.2 — Build the Overview panel (left)

**File:** `ar-output-YOLO/ar-output/index.html` + `style.css`

Replace existing `#overview-panel` content with:

```html
<div id="overview-panel" class="glass-card floating-panel hidden">
  <div class="fp-header">
    <span class="fp-eyebrow">PROJECT</span>
    <span class="fp-chip">LIVE</span>
  </div>
  <h2 class="fp-title">Arduino AR Explorer</h2>
  <p class="fp-body">
    Real-time component detection with YOLO, streaming sensor data via MQTT over WSS. Tap any callout to inspect.
  </p>
  <div class="fp-meta">
    <div><span>Model</span><strong>Roboflow YOLO</strong></div>
    <div><span>Broker</span><strong>HiveMQ Cloud</strong></div>
    <div><span>Runtime</span><strong>Web AR</strong></div>
  </div>
</div>
```

Style `.floating-panel`, `.fp-header`, `.fp-eyebrow`, `.fp-chip`, `.fp-title`, `.fp-body`, `.fp-meta` with:
- 24px inner padding
- Eyebrow: 11px, uppercase, letter-spacing 0.14em, `var(--text-secondary)`
- Title: 22px, weight 600, `var(--text-primary)`
- Body: 14px, line-height 1.55, `var(--text-secondary)`
- Meta row: 3 columns, tiny label + value stack, top border `1px solid var(--glass-border)`, 16px top margin/padding.
- Chip: tiny green dot + "LIVE" text, animated pulse.

**Acceptance:** left panel looks like a premium translucent info card readable against any camera background.

---

### Step 2.3 — Build the Live Measurements panel (center)

**File:** `ar-output-YOLO/ar-output/index.html` + `style.css`

Replace existing `#measurement-plane` with a richer card:

```html
<div id="measurement-plane" class="glass-card floating-panel hidden">
  <div class="fp-header">
    <span class="fp-eyebrow">OPSTELLING · LIVE</span>
    <button id="mplane-reset-btn" class="fp-icon-btn">✕</button>
  </div>
  <div class="metric-grid">
    <div class="metric">
      <span class="metric-label">Ultrasonic</span>
      <span class="metric-value" id="mplane-us">— <em>cm</em></span>
      <div class="metric-sparkline" id="us-spark"></div>
    </div>
    <div class="metric">
      <span class="metric-label">LED State</span>
      <span class="metric-value" id="mplane-led">—</span>
      <div class="led-indicator" id="led-pulse"></div>
    </div>
  </div>
  <div class="fp-footer">
    <span class="mqtt-dot connected"></span>
    <span>HiveMQ · <code>hospital/sensors/ultrasonic</code></span>
  </div>
</div>
```

- `.metric-grid`: 2 columns, gap 20px.
- `.metric-value`: 34px, weight 600, tabular-nums, `em` tag is 13px and `var(--text-secondary)`.
- `.metric-sparkline`: 60px tall mini canvas — append last 30 ultrasonic readings as a tiny line chart. Implement in `ar-engine.js` via a reusable `Sparkline` class (plain 2D canvas inside the CSS3D DOM).
- `.led-indicator`: 12px circle that pulses green when `latestLED === 'ON'`.
- `.fp-footer`: 12px font, secondary color, top border, kbd-style `<code>` chip in monospace.

**Acceptance:** ultrasonic readings animate smoothly, sparkline grows, LED indicator pulses when MQTT publishes `ON`.

---

### Step 2.4 — Build the AI Assistant panel (right)

**File:** `ar-output-YOLO/ar-output/index.html` + `style.css`

This replaces the bottom-sheet `#ai-panel` with a world-anchored version:

```html
<div id="ai-panel" class="glass-card floating-panel hidden">
  <div class="fp-header">
    <span class="fp-eyebrow">✦ AI ASSISTANT</span>
    <button id="ai-close-btn" class="fp-icon-btn">✕</button>
  </div>
  <div id="ai-response-area" class="ai-scroll">
    <div id="ai-response-text" class="ai-bubble ai-bubble-assistant">
      Ask me anything about the detected components or your circuit.
    </div>
  </div>
  <div id="ai-input-row" class="ai-composer">
    <input id="ai-input" type="text" placeholder="Ask about your circuit…" />
    <button id="ai-send-btn" aria-label="Send">↑</button>
  </div>
  <div class="ai-suggestions">
    <button class="chip">Explain this circuit</button>
    <button class="chip">Why 220Ω resistor?</button>
    <button class="chip">Next step?</button>
  </div>
</div>
```

- `.ai-bubble-assistant`: frosted inset, rounded 14px, soft cyan left border (3px) for the AI turn.
- `.ai-bubble-user`: align right, slightly warmer tint.
- `.ai-composer`: input + send button pinned at bottom; input is transparent with bottom border only, 15px.
- `.ai-suggestions`: horizontal row of tappable chip prompts — clicking autofills input and sends.
- Wire chip clicks to call `sendAIMessage()` with the chip text.

**Acceptance:** AI panel is a floating card that follows the opstelling, suggestion chips work, and responses render as left-aligned bubbles in a scrollable stack.

---

### Step 2.5 — Panel entrance/exit choreography

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js`

- On `imageAnchor.onTargetFound`: panels animate in sequence: center (0ms) → left (120ms) → right (240ms). Use per-panel `scale` + `opacity` tween (from `(0.88, 0)` to `(1.0, 1)`).
- On `imageAnchor.onTargetLost`: reverse sequence with 200ms stagger, hide completely at end.
- Add a tiny **idle breathe** loop: `panel.scale.y = 1 + Math.sin(t * 0.8) * 0.008` in the render loop, applied to the `CSS3DObject` scale. Keeps the scene feeling alive.

**Acceptance:** detecting the target feels cinematic: panels bloom in, breathe subtly, fold away when lost.

---

## Phase 3 — Floating Action Dock

### Step 3.1 — Replace the bottom action bar with a 3D dock

**File:** `ar-output-YOLO/ar-output/index.html` + `style.css`

Goal: match the floating bottom dock in the spatial reference (icons in a pill, glass surface).

Replace `#action-bar` markup with:

```html
<div id="action-dock" class="glass-card">
  <button class="dock-btn" id="home-btn" title="Overview">⌂</button>
  <button class="dock-btn" id="ai-btn" title="Ask AI">✦</button>
  <button class="dock-btn" id="mic-btn" title="Voice">🎙</button>
  <button class="dock-btn" id="step-btn" title="Steps">☰</button>
  <button class="dock-btn" id="share-btn" title="Share">↗</button>
</div>
```

Styling:
- Dock: centered bottom, `bottom: 28px`, padding 10px 16px, border-radius 999px, backdrop-blur, `display:flex; gap:6px`.
- `.dock-btn`: 44×44 circle, transparent background, hover → `background: var(--glass-highlight)`; icon 18px.
- Active state: cyan dot under the button.

Decision on world-vs-screen: keep this dock **screen-anchored** at bottom-center (it's a system-level control bar). Everything else is world-anchored.

**Acceptance:** dock matches the reference style: slim translucent pill with icon buttons, hover states feel tactile.

---

### Step 3.2 — Wire dock buttons

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js`

- `#home-btn` → toggle Overview panel visibility, recenter camera hint.
- `#ai-btn` → focus AI panel input (world-anchored panel from 2.4), add a soft highlight ring.
- `#mic-btn` → existing speech recognition toggle (keep current logic).
- `#step-btn` → open the **Step Guide overlay** (Phase 4).
- `#share-btn` → navigator.share({ title, url }) if available, else copy link.

**Acceptance:** every dock button has a working handler; disabled buttons show 40% opacity.

---

## Phase 4 — Guided Step Mode (the "Remove Back Cover" effect)

### Step 4.1 — Step data structure

**File:** `ar-output-YOLO/ar-output/js/steps-db.js` *(new)*

Define `window.STEPS_DB` as an ordered array describing a guided assembly/verification walkthrough:

```js
window.STEPS_DB = [
  {
    id: 1,
    total: 6,
    title: "Place the ultrasonic sensor",
    description: "Mount the HC-SR04 on rows 1–4 of the breadboard, pins facing the Arduino.",
    requires: ["ultrasonic"],      // YOLO class ids that must be visible
    verifyLabel: "Verify",
  },
  {
    id: 2, total: 6,
    title: "Wire VCC and GND",
    description: "Connect VCC to the 5V rail and GND to the ground rail.",
    requires: [],
    verifyLabel: "Verify",
  },
  // …fill in 4 more plausible steps
];
```

**Acceptance:** DB loads globally without errors.

---

### Step 4.2 — Step banner UI (matches "Step 2/8 · Remove Back Cover" reference)

**File:** `ar-output-YOLO/ar-output/index.html` + `style.css`

Add to body:

```html
<div id="step-banner" class="glass-card hidden">
  <div class="sb-top">
    <span class="sb-counter">Step <strong id="sb-current">1</strong>/<span id="sb-total">6</span></span>
    <span class="sb-title" id="sb-title"></span>
    <span class="sb-status" id="sb-status">Ready to scan</span>
  </div>
  <div class="sb-bottom">
    <p id="sb-desc"></p>
    <button id="sb-verify" class="btn-primary">Verify</button>
  </div>
  <div class="sb-progress"><div id="sb-fill"></div></div>
</div>
```

Styling:
- Pin bottom-center above the dock, width `min(720px, 92vw)`, 16px/20px padding.
- Counter: small, uppercase, letter-spacing 0.1em, cyan accent for `<strong>`.
- Title: 16px, weight 600.
- Status: right-aligned, cyan when "Ready to scan", green "Verified", amber "Waiting".
- Progress bar: 3px tall, cyan fill `width: (current/total * 100)%`, transitions width 400ms.
- `.btn-primary`: cyan background `var(--accent)`, ink text, pill shape, 10×22 padding.

**Acceptance:** banner visually echoes the laptop reference: step count + title on one row, description + Verify button on the row beneath.

---

### Step 4.3 — Step logic and verification loop

**File:** `ar-output-YOLO/ar-output/js/ar-engine.js`

- Add a `stepController` object with `current` index and methods `next()`, `render()`, `verify()`.
- `render()` fills banner DOM from `STEPS_DB[current]`.
- `verify()`: checks `state.detections` against `step.requires`. If all required classes are present, mark step verified (status goes green), wait 700ms, call `next()`. Else flash amber "Waiting for: X, Y".
- `#step-btn` in the dock toggles the banner visibility.
- Clicking a callout pill (from Phase 1.3) emphasizes the matching step requirement.

**Acceptance:** starting the app with `#step-btn` pressed walks the user through the guided assembly, only advancing when YOLO confirms the required components are visible.

---

## Phase 5 — Polish Pass

### Step 5.1 — Scanning state visuals

**File:** `style.css`, `ar-engine.js`

- When no target is tracked, show a center reticle: an animated square bracket "[  ]" expanding/contracting. Copy the style of reference's "Ready to start scanning" affordance — a thin circular indicator with rotating dashed ring.
- Text under it: "Point camera at the Arduino opstelling".
- Fades out when `onTargetFound` fires.

---

### Step 5.2 — First-run tooltip hints

**File:** `ar-engine.js`

- First time callouts appear, show a small tip near the first pill: "Tap a callout to learn more". Auto-dismiss after 5s or first interaction.
- Persist `localStorage.arExplorer.hasSeenHint = "1"` so it doesn't reappear.

---

### Step 5.3 — Micro-interactions

**File:** `style.css`

- Hover/tap scale (+3%) and soft cyan glow on every `.dock-btn`, `.callout-pill`, `.fp-icon-btn`, `.chip`, `.btn-primary`.
- 120ms delays on hover-out so it doesn't feel twitchy.
- Global: `* { -webkit-tap-highlight-color: transparent; }` — remove mobile tap flash.

---

### Step 5.4 — Performance guardrails

**File:** `ar-engine.js`

- Cap detection calls to 2/sec on low-power devices (detect via `navigator.hardwareConcurrency < 4`).
- Pause the `setAnimationLoop` work (skip panel breathe math, not render) when `document.hidden`.
- Dispose all Three.js geometries/materials on target lost → re-create on found (prevents GPU memory bloat across long sessions).

---

### Step 5.5 — Visual QA checklist

Before declaring done, verify in a real mobile browser:

- [ ] White leader beams render crisp (no aliasing, visible against both light and dark backgrounds).
- [ ] Curved-triptych panel layout reads correctly when user stands ~60cm from the opstelling.
- [ ] Panels do not z-fight with camera feed — CSS3D layer always in front of MindAR video.
- [ ] All text legible at arm's length; no panel smaller than 14px readable text.
- [ ] Loading screen → detection → panel bloom animation feels smooth (no jank > 16ms).
- [ ] Step banner fits one-handed iPhone reach zone.
- [ ] AI panel keyboard doesn't obscure input on iOS (use `visualViewport.height` to reposition).

---

## Deliverables Summary

New files created:
- `js/three-extras.js`
- `js/steps-db.js`
- `steps/STEPS.md` (this document)

Files heavily modified:
- `index.html` (markup for glass panels, dock, step banner)
- `css/style.css` (tokens, `.glass-card`, floating panels, dock, beam pill, step banner)
- `js/ar-engine.js` (CSS3DRenderer integration, 3D leader beams, world-anchored panels, step controller)

Files untouched:
- `targets.mind`
- `js/components-db.js` (content source only — no structural changes)
- `assets/` (reuse as-is)

---

## Execution Order for Sonnet 4.6

Run phases strictly sequentially (0 → 1 → 2 → 3 → 4 → 5). Within a phase, steps are also sequential — each step depends on the previous. After each step, test locally (open `index.html`, scan `targets.mind`) before advancing. Commit per step with message `feat(ar): <step id> <short title>`.

When ambiguity arises about placement or size, **prefer the reference images**: laptop "Vision Guide" for beam + pill geometry, spatial "Goals" triptych for the curved floating-panel arrangement. Favor generous whitespace, low-saturation surfaces, and restraint over decoration.
