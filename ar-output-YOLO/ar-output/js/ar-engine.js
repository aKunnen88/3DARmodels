// ═══════════════════════════════════════════════════════════════
//  AR Engine — Arduino Component Detector
//  Uses: Roboflow YOLO + MindAR image tracking + MQTT + CSS3D
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { MindARThree } from 'https://unpkg.com/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { Line2 }         from 'three/addons/lines/Line2.js';
import { LineMaterial }  from 'three/addons/lines/LineMaterial.js';
import { LineGeometry }  from 'three/addons/lines/LineGeometry.js';

// ── State ──────────────────────────────────────────────────────
const state = {
  detections:       [],
  scanning:         true,
  lastDetectionTime: 0,
  detectionInterval: 300,
  markerRefreshedAt: 0,
  MARKER_STALE_MS:   1500,
};

// ── DOM refs ───────────────────────────────────────────────────
let video = null;
const loadScreen  = document.getElementById('loading-screen');
const hudStatus   = document.getElementById('hud-status');
const scanRing    = document.getElementById('scan-ring');
const panel       = document.getElementById('detail-panel');
const panelTitle  = document.getElementById('panel-title');
const panelBadge  = document.getElementById('panel-badge');
const panelDesc   = document.getElementById('panel-desc');
const panelSpecs  = document.getElementById('panel-specs');
const panelTip    = document.getElementById('panel-tip');
const panelIcon   = document.getElementById('panel-icon');
const closeBtn    = document.getElementById('close-panel');
const mPlaneUS    = document.getElementById('mplane-us');
const mPlaneLED   = document.getElementById('mplane-led');
const ledPulse    = document.getElementById('led-pulse');
const mqttDot     = document.getElementById('mqtt-dot');
const ovPanel     = document.getElementById('overview-panel');
const mPlane      = document.getElementById('measurement-plane');
const mPlaneReset = document.getElementById('mplane-reset-btn');

// ── MindAR / Three.js state ────────────────────────────────────
let mindarTargetVisible = false;
let mindarAnchorGroup   = null;
let mindarCamera        = null;
let cssRenderer         = null;
let worldUIGroup        = null;
let scene               = null;

// ── Panels (CSS3DObjects) ──────────────────────────────────────
const PANEL_SCALE = 0.0018;
const PILL_SCALE  = 0.0011;
let ovObj  = null;   // overview  – LEFT
let mpObj  = null;   // measurements – CENTER

// ── Beam / pill tracking ───────────────────────────────────────
let beamObjects   = [];   // { line, endcap, pillObj }
let lineMat       = null;

// ── Screen-space marker state (fallback) ──────────────────────
const markersEl    = document.getElementById('markers-container');
let   screenMarkers = [];   // { id, el, comp, curX, curY, targetX, targetY }
const LERP = 0.12;

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  try {
    await initMindAR();
    connectMQTT();
  } catch (err) {
    updateStatus('⚠ ' + err.message);
    hideLoader();
  }
}

// ── MindAR + Three.js + CSS3D init ────────────────────────────
async function initMindAR() {
  const mindarThree = new MindARThree({
    container:      document.body,
    imageTargetSrc: 'targets.mind',
    uiLoading:      'no',
    uiScanning:     'no',
    uiError:        'no',
  });

  const { renderer, camera } = mindarThree;
  scene         = mindarThree.scene;
  mindarCamera  = camera;

  // Shared white beam material
  lineMat = new LineMaterial({
    color:       0xffffff,
    linewidth:   2.5,
    transparent: true,
    opacity:     0.88,
    worldUnits:  false,
    resolution:  new THREE.Vector2(window.innerWidth, window.innerHeight),
  });

  // ── CSS3DRenderer ──────────────────────────────────────────
  cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  Object.assign(cssRenderer.domElement.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100%',
    height:        '100%',
    zIndex:        '2',
    pointerEvents: 'none',
  });
  document.body.appendChild(cssRenderer.domElement);

  // ── MindAR anchor ─────────────────────────────────────────
  const imageAnchor = mindarThree.addAnchor(0);
  mindarAnchorGroup = imageAnchor.group;

  // World UI group lives inside the anchor → tracks with target
  worldUIGroup = new THREE.Group();
  mindarAnchorGroup.add(worldUIGroup);

  // World-anchored panels
  setupWorldPanels();

  imageAnchor.onTargetFound = onTargetFound;
  imageAnchor.onTargetLost  = onTargetLost;

  await mindarThree.start();

  // Transparent WebGL canvas — video shows through
  if (mindarThree.background) scene.remove(mindarThree.background);
  renderer.setClearColor(0x000000, 0);

  video = mindarThree.video;
  Object.assign(video.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    objectFit: 'cover', zIndex: '0',
    display: 'block', visibility: 'visible',
  });

  Object.assign(renderer.domElement.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    zIndex: '1', pointerEvents: 'none',
  });

  window.addEventListener('resize', onResize);
  onResize();

  hideLoader();
  updateStatus('Point at the Arduino opstelling');

  // ── Render loop ──────────────────────────────────────────
  renderer.setAnimationLoop(() => {
    renderer.render(scene, mindarCamera);
    cssRenderer.render(scene, mindarCamera);

    const now = performance.now();
    if (now - state.lastDetectionTime > state.detectionInterval) {
      state.lastDetectionTime = now;
      detect();
    }

    // Clear stale beams
    if (state.detections.length > 0 &&
        now - state.markerRefreshedAt > state.MARKER_STALE_MS) {
      state.detections = [];
      clearBeams();
    }

    // LERP screen-space markers
    tickScreenMarkers();

    // Billboard pills toward camera
    billboardPills();

    // Breathe animation on world panels
    breathePanels(now);

    // Sparkline
    updateSparkCanvas();
  });
}

// ── Resize ────────────────────────────────────────────────────
function onResize() {
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  if (lineMat) lineMat.resolution.set(window.innerWidth, window.innerHeight);
}

// ── World panels setup ─────────────────────────────────────────
function setupWorldPanels() {
  // Overview — LEFT, yaw inward
  ovObj = new CSS3DObject(ovPanel);
  ovObj.position.set(-0.52, 0.28, 0.08);
  ovObj.rotation.y = THREE.MathUtils.degToRad(20);
  ovObj.scale.setScalar(PANEL_SCALE);
  worldUIGroup.add(ovObj);

  // Measurements — CENTER, slight backward tilt
  mpObj = new CSS3DObject(mPlane);
  mpObj.position.set(0, 0.38, 0.18);
  mpObj.rotation.x = THREE.MathUtils.degToRad(-8);
  mpObj.scale.setScalar(PANEL_SCALE);
  worldUIGroup.add(mpObj);

  // Start hidden — will reveal on target found
  worldUIGroup.visible = false;
}

// ── Target found / lost ───────────────────────────────────────
function onTargetFound() {
  mindarTargetVisible = true;
  clearScreenMarkers();
  scanRing.classList.add('hidden');
  updateStatus('Arduino opstelling detected');
  // Stagger panel reveal
  worldUIGroup.visible = true;
  revealPanels();
  syncMPlaneValues();
  if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
}

function onTargetLost() {
  mindarTargetVisible = false;
  scanRing.classList.remove('hidden');
  updateStatus('Point at the Arduino opstelling');
  clearBeams();
  hideVerificationCallout();
  state.detections = [];
  worldUIGroup.visible = false;
  clearInterval(mPlaneSyncInterval);
}

// ── Panel entrance animation (scale + opacity tween) ──────────
function revealPanels() {
  const panels = [mpObj, ovObj];
  panels.forEach((p, i) => {
    if (!p) return;
    p.scale.setScalar(0);
    setTimeout(() => tweenScale(p, 0, PANEL_SCALE, 500), i * 130);
  });
}

function tweenScale(obj, from, to, ms) {
  const start = performance.now();
  function tick() {
    const t = Math.min((performance.now() - start) / ms, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    obj.scale.setScalar(from + (to - from) * ease);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Breathe animation ─────────────────────────────────────────
function breathePanels(now) {
  if (!worldUIGroup.visible) return;
  const breathe = 1 + Math.sin(now * 0.0008) * 0.008;
  if (ovObj && ovObj.scale.x > 0.0001) {
    const s = PANEL_SCALE * breathe;
    ovObj.scale.setScalar(s);
  }
  if (mpObj && mpObj.scale.x > 0.0001) {
    const s = PANEL_SCALE * breathe;
    mpObj.scale.setScalar(s);
  }
}

// ── Screen-space markers (shown when MindAR target not locked) ────────────
function clearScreenMarkers() {
  screenMarkers.forEach(m => {
    m.el.classList.add('fade-out');
    setTimeout(() => m.el.remove(), 250);
  });
  screenMarkers = [];
}

function syncScreenMarkers(preds) {
  const counts  = {};
  const activeIds = new Set();

  preds.forEach(p => {
    const id = resolveComponent(p.class).id;
    counts[id] = (counts[id] || 0) + 1;
    activeIds.add(`sm-${id}-${counts[id]}`);
  });

  // Remove stale
  screenMarkers = screenMarkers.filter(m => {
    if (!activeIds.has(m.id)) {
      m.el.classList.add('fade-out');
      setTimeout(() => m.el.remove(), 250);
      return false;
    }
    return true;
  });

  // Add / update
  const cur = {};
  preds.forEach((pred) => {
    const comp = resolveComponent(pred.class);
    cur[comp.id] = (cur[comp.id] || 0) + 1;
    const markerId = `sm-${comp.id}-${cur[comp.id]}`;

    const [vx, vy, vw, vh]           = pred.bbox;
    const { x: targetX, y: targetY } = getScreenCoords(vx + vw / 2, vy + vh / 2);

    let m = screenMarkers.find(x => x.id === markerId);
    if (!m) {
      const el = document.createElement('div');
      el.className = 'ar-marker';

      const pill = document.createElement('div');
      pill.className = 'ar-marker-pill';
      pill.textContent = comp.icon;
      pill.addEventListener('click',    ()  => openPanel(comp));
      pill.addEventListener('touchend', (e) => { e.preventDefault(); openPanel(comp); });

      const label = document.createElement('div');
      label.className = 'ar-marker-label';
      label.textContent = comp.name;

      el.appendChild(pill);
      el.appendChild(label);
      markersEl.appendChild(el);

      m = { id: markerId, el, comp, curX: targetX, curY: targetY, targetX, targetY };
      screenMarkers.push(m);
    }

    m.targetX = targetX;
    m.targetY = targetY;
  });
}

function tickScreenMarkers() {
  screenMarkers.forEach(m => {
    m.curX += (m.targetX - m.curX) * LERP;
    m.curY += (m.targetY - m.curY) * LERP;
    m.el.style.left = `${m.curX}px`;
    m.el.style.top  = `${m.curY}px`;
  });
}

// ── Leader beam helpers ────────────────────────────────────────
function clearBeams() {
  beamObjects.forEach(({ line, endcap, pillObj }) => {
    worldUIGroup.remove(line);
    worldUIGroup.remove(endcap);
    worldUIGroup.remove(pillObj);
    line.geometry.dispose();
    endcap.geometry.dispose();
    // Remove pill DOM element from CSS3D renderer tree
    if (pillObj.element && pillObj.element.parentNode) {
      pillObj.element.parentNode.removeChild(pillObj.element);
    }
  });
  beamObjects = [];
}

function getOrbitalPosition(index, count) {
  const radius  = 0.38;
  const total   = Math.max(count, 1);
  const angle   = (index / total) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    0.22 + Math.abs(Math.sin(angle)) * 0.08,
    0.12
  );
}

// Project a screen pixel onto the anchor's z=0 plane (local coords)
function screenToAnchorLocal(sx, sy) {
  const ndcX = (sx / window.innerWidth)  *  2 - 1;
  const ndcY = (sy / window.innerHeight) * -2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), mindarCamera);

  const anchorWorldPos = new THREE.Vector3();
  mindarAnchorGroup.getWorldPosition(anchorWorldPos);
  const normalWorld = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(mindarAnchorGroup.quaternion);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normalWorld, anchorWorldPos);

  const worldHit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, worldHit)) return null;

  // world → anchor-local → worldUIGroup-local (same transform chain)
  return mindarAnchorGroup.worldToLocal(worldHit);
}

function syncBeams(preds) {
  if (!mindarTargetVisible) {
    syncScreenMarkers(preds);
    return;
  }
  clearScreenMarkers();
  clearBeams();

  preds.forEach((pred, i) => {
    const comp = resolveComponent(pred.class);
    const [vx, vy, vw, vh] = pred.bbox;
    const { x: sx, y: sy } = getScreenCoords(vx + vw / 2, vy + vh / 2);

    const startPos = screenToAnchorLocal(sx, sy);
    if (!startPos) return;
    const endPos = getOrbitalPosition(i, preds.length);

    // Line2 beam
    const geom = new LineGeometry();
    geom.setPositions([
      startPos.x, startPos.y, startPos.z,
      endPos.x,   endPos.y,   endPos.z,
    ]);
    const mat  = lineMat.clone();
    const line = new Line2(geom, mat);
    line.computeLineDistances();
    worldUIGroup.add(line);

    // Origin endcap (glowing sphere at physical component)
    const endcapGeom = new THREE.SphereGeometry(0.009, 8, 8);
    const endcapMat  = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.92,
    });
    const endcap = new THREE.Mesh(endcapGeom, endcapMat);
    endcap.position.copy(startPos);
    worldUIGroup.add(endcap);

    // Callout pill (CSS3DObject)
    const pillDiv = document.createElement('div');
    pillDiv.className = 'callout-pill';
    pillDiv.textContent = comp.icon;
    pillDiv.style.pointerEvents = 'auto';
    pillDiv.addEventListener('click',    ()  => openPanel(comp));
    pillDiv.addEventListener('touchend', (e) => { e.preventDefault(); openPanel(comp); });

    const pillObj = new CSS3DObject(pillDiv);
    pillObj.position.copy(endPos);
    pillObj.scale.setScalar(PILL_SCALE);
    worldUIGroup.add(pillObj);

    beamObjects.push({ line, endcap, pillObj });
  });
}

// ── Billboard pills toward camera ─────────────────────────────
function billboardPills() {
  if (!worldUIGroup.visible) return;
  const parentQuat = new THREE.Quaternion();
  worldUIGroup.getWorldQuaternion(parentQuat);
  const invParent = parentQuat.clone().invert();
  const camQuat   = mindarCamera.quaternion.clone();
  const localQ    = invParent.multiply(camQuat);

  beamObjects.forEach(({ pillObj }) => {
    pillObj.quaternion.copy(localQ);
  });
}

// ── Coordinate mapping (video → screen, object-fit: cover) ────
function getScreenCoords(vx, vy) {
  const vw = video.videoWidth,  vh = video.videoHeight;
  const sw = window.innerWidth, sh = window.innerHeight;
  const scale   = Math.max(sw / vw, sh / vh);
  const offsetX = (vw * scale - sw) / 2;
  const offsetY = (vh * scale - sh) / 2;
  return { x: vx * scale - offsetX, y: vy * scale - offsetY };
}

// ── Roboflow YOLO detection ────────────────────────────────────
const RF_API_KEY = 'sCeSU3tBkqCWRttvc4p5';
const RF_MODEL   = 'my-first-project-iccnb/2';

async function detect() {
  if (!state.scanning || !video || !video.videoWidth || video.paused) return;
  state.scanning = false;
  try {
    const snap = document.createElement('canvas');
    snap.width  = video.videoWidth;
    snap.height = video.videoHeight;
    snap.getContext('2d').drawImage(video, 0, 0);
    const base64 = snap.toDataURL('image/jpeg', 0.8).split(',')[1];

    const res = await fetch(
      `https://detect.roboflow.com/${RF_MODEL}?api_key=${RF_API_KEY}&confidence=50&overlap=30`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: base64 }
    );
    const data  = await res.json();
    const preds = (data.predictions || []).map(p => ({
      class: p.class,
      score: p.confidence,
      bbox:  [p.x - p.width / 2, p.y - p.height / 2, p.width, p.height],
    }));

    if (preds.length > 0) {
      state.detections      = preds;
      state.markerRefreshedAt = performance.now();
      syncBeams(preds);
      updateStatus(`${preds.length} component${preds.length > 1 ? 's' : ''} detected — tap!`);
      stepController.checkVerify(preds);
    }
  } catch (e) {
    console.error(e);
  } finally {
    setTimeout(() => { state.scanning = true; }, 100);
  }
}

// ── Resolve class → component DB entry ────────────────────────
function resolveComponent(className) {
  const id = className.toLowerCase().replace(/\s+/g, '_');
  return window.COMPONENTS_DB[id] || window.COMPONENTS_DB['unknown'];
}

// ── Detail panel ───────────────────────────────────────────────
function openPanel(comp) {
  panelIcon.textContent       = comp.icon;
  panelTitle.textContent      = comp.fullName;
  panelBadge.textContent      = comp.badge;
  panelBadge.style.background = comp.badgeColor;
  panelDesc.textContent       = comp.desc;
  panelTip.textContent        = comp.tip;
  panelSpecs.innerHTML = comp.specs.map(s => `
    <div class="spec-row">
      <span class="spec-label">${s.label}</span>
      <span class="spec-value">${s.value}</span>
    </div>
  `).join('');
  panel.classList.remove('hidden');
  requestAnimationFrame(() => panel.classList.add('open'));
  if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
}

function closePanelFn() {
  panel.classList.remove('open');
  setTimeout(() => panel.classList.add('hidden'), 350);
}

closeBtn.addEventListener('click', closePanelFn);
document.getElementById('panel-bg-blur').addEventListener('click', closePanelFn);

// ── Helpers ────────────────────────────────────────────────────
function updateStatus(msg) { hudStatus.textContent = msg; }

function hideLoader() {
  loadScreen.classList.add('fade-out');
  setTimeout(() => loadScreen.remove(), 700);
}

// ── MQTT ──────────────────────────────────────────────────────
let latestUS   = '—';
let latestLED  = '—';
const usHistory = [];

function connectMQTT() {
  const client = mqtt.connect(
    'wss://0f23b53beddd48cebc845a657cd08ab6.s1.eu.hivemq.cloud:8884/mqtt',
    { username: 'CodeAcces', password: 'CodeAcces1', reconnectPeriod: 3000 }
  );
  client.on('connect', () => {
    client.subscribe('hospital/sensors/ultrasonic');
    mqttDot.classList.add('connected');
  });
  client.on('message', (_t, payload) => {
    const val = parseFloat(payload.toString());
    if (!isNaN(val)) {
      latestUS = val === -1 ? '—' : val.toFixed(1);
      usHistory.push(val === -1 ? null : val);
      if (usHistory.length > 40) usHistory.shift();
    }
  });
  client.on('error',        () => mqttDot.classList.remove('connected'));
  client.on('offline',      () => mqttDot.classList.remove('connected'));
  client.on('reconnect',    () => mqttDot.classList.remove('connected'));
}

// ── Measurement panel sync ────────────────────────────────────
let mPlaneSyncInterval = null;

function syncMPlaneValues() {
  clearInterval(mPlaneSyncInterval);
  mPlaneSyncInterval = setInterval(() => {
    mPlaneUS.innerHTML  = latestUS === '—' ? '—' : `${latestUS}<em>cm</em>`;
    mPlaneLED.textContent = latestLED;
    if (latestLED === 'ON') {
      ledPulse.classList.add('on');
    } else {
      ledPulse.classList.remove('on');
    }
  }, 200);
}

mPlaneReset.addEventListener('click', () => {
  clearInterval(mPlaneSyncInterval);
  worldUIGroup.visible = false;
});

// ── Sparkline canvas ──────────────────────────────────────────
const sparkCanvas = document.getElementById('us-spark');
const sparkCtx    = sparkCanvas ? sparkCanvas.getContext('2d') : null;

function updateSparkCanvas() {
  if (!sparkCtx || usHistory.length < 2) return;
  const w = sparkCanvas.offsetWidth  || 100;
  const h = sparkCanvas.offsetHeight || 32;
  if (sparkCanvas.width !== w)  sparkCanvas.width  = w;
  if (sparkCanvas.height !== h) sparkCanvas.height = h;

  const vals = usHistory.filter(v => v !== null);
  if (vals.length < 2) return;

  const min = Math.min(...vals);
  const max = Math.max(...vals) || min + 1;
  const step = w / (vals.length - 1);

  sparkCtx.clearRect(0, 0, w, h);
  sparkCtx.beginPath();
  sparkCtx.strokeStyle = 'rgba(125,211,252,0.7)';
  sparkCtx.lineWidth   = 1.5;
  sparkCtx.lineCap     = 'round';
  sparkCtx.lineJoin    = 'round';

  vals.forEach((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / (max - min)) * (h - 4) - 2;
    i === 0 ? sparkCtx.moveTo(x, y) : sparkCtx.lineTo(x, y);
  });
  sparkCtx.stroke();
}

// ── AI Panel ──────────────────────────────────────────────────
const LLM_API_KEY  = 'YOUR_API_KEY';
const LLM_API_URL  = 'https://api.openai.com/v1/chat/completions';
const LLM_MODEL    = 'gpt-4o-mini';

const aiPanel      = document.getElementById('ai-panel');
const aiPanelBg    = document.getElementById('ai-panel-bg');
const aiCloseBtn   = document.getElementById('ai-close-btn');
const aiInput      = document.getElementById('ai-input');
const aiSendBtn    = document.getElementById('ai-send-btn');
const aiResponseEl = document.getElementById('ai-response-text');

aiCloseBtn.addEventListener('click', closeAIPanel);
aiPanelBg.addEventListener('click',  closeAIPanel);
aiSendBtn.addEventListener('click',  sendAIMessage);
aiInput.addEventListener('keydown',  e => { if (e.key === 'Enter') sendAIMessage(); });

// Suggestion chips
document.querySelectorAll('.ai-suggestions .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    aiInput.value = chip.textContent.trim();
    openAIPanel();
    sendAIMessage();
  });
});

function openAIPanel() {
  aiPanel.classList.remove('hidden');
  requestAnimationFrame(() => aiPanel.classList.add('open'));
  setTimeout(() => aiInput.focus(), 450);
}

function closeAIPanel() {
  aiPanel.classList.remove('open');
  setTimeout(() => aiPanel.classList.add('hidden'), 400);
}

function buildSystemPrompt() {
  const detected = state.detections.map(d => resolveComponent(d.class).fullName).join(', ') || 'nothing yet';
  return `You are an expert Arduino and electronics assistant embedded in an AR app.
Currently detected: ${detected}. Ultrasonic: ${latestUS} cm. LED: ${latestLED}.
Be concise and practical. Plain text, no markdown.`;
}

async function sendAIMessage() {
  const question = aiInput.value.trim();
  if (!question) return;

  // Add user bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'ai-bubble ai-bubble-user';
  userBubble.textContent = question;
  aiResponseEl.parentElement.appendChild(userBubble);
  aiInput.value = '';

  // Add thinking bubble
  const thinkBubble = document.createElement('div');
  thinkBubble.className = 'ai-bubble ai-bubble-assistant';
  thinkBubble.innerHTML = `<div class="ai-thinking"><span></span><span></span><span></span></div>`;
  aiResponseEl.parentElement.appendChild(thinkBubble);

  const responseArea = document.getElementById('ai-response-area');
  responseArea.scrollTop = responseArea.scrollHeight;

  try {
    const res = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_API_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: question },
        ],
        max_tokens: 300,
      }),
    });
    const data = await res.json();
    thinkBubble.textContent = data.choices?.[0]?.message?.content || 'No response.';
    thinkBubble.classList.add('active');
  } catch {
    thinkBubble.textContent = 'Could not reach the AI. Check API key or connection.';
  }
  responseArea.scrollTop = responseArea.scrollHeight;
}

// ── Voice input ────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = document.getElementById('mic-btn');

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang  = 'en-US';
  recognition.interimResults = false;

  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('recording')) {
      recognition.stop();
    } else {
      if (aiPanel.classList.contains('hidden')) openAIPanel();
      recognition.start();
    }
  });

  recognition.addEventListener('start',  ()  => micBtn.classList.add('recording'));
  recognition.addEventListener('end',    ()  => micBtn.classList.remove('recording'));
  recognition.addEventListener('result', e   => { aiInput.value = e.results[0][0].transcript; sendAIMessage(); });
  recognition.addEventListener('error',  ()  => micBtn.classList.remove('recording'));
} else {
  micBtn.style.opacity = '0.4';
  micBtn.title = 'Speech not supported';
}

// ── Action Dock wiring ────────────────────────────────────────
document.getElementById('home-btn').addEventListener('click', () => {
  worldUIGroup.visible = !worldUIGroup.visible;
  document.getElementById('home-btn').classList.toggle('active', worldUIGroup.visible);
});

document.getElementById('ai-btn').addEventListener('click', () => {
  if (aiPanel.classList.contains('hidden')) openAIPanel();
  else closeAIPanel();
});

document.getElementById('step-btn').addEventListener('click', () => {
  stepController.toggle();
  document.getElementById('step-btn').classList.toggle('active', stepController.active);
});

document.getElementById('share-btn').addEventListener('click', () => {
  const url = location.href;
  if (navigator.share) {
    navigator.share({ title: 'Arduino AR Explorer', url });
  } else {
    navigator.clipboard?.writeText(url);
    updateStatus('Link copied!');
    setTimeout(() => updateStatus('Arduino opstelling detected'), 2000);
  }
});

// ── Verification callout (beam + panel after all steps done) ──────────────
let verifBeam    = null;
let verifEndcap  = null;
let verifPanelObj = null;
let verifSyncInterval = null;

const verifEl = document.getElementById('verification-panel');
const verifUS  = document.getElementById('verif-us');
const verifLedText = document.getElementById('verif-led-text');
const verifLedDot  = document.getElementById('verif-led-dot');

function showVerificationCallout() {
  if (!worldUIGroup) return;

  // Panel position: directly above breadboard center, tilted toward viewer
  const panelPos = new THREE.Vector3(0, 0.42, 0.22);
  // Beam: from (0,0,0) breadboard center up to panel
  const beamStart = new THREE.Vector3(0, 0.01, 0);

  // White beam
  const geom = new LineGeometry();
  geom.setPositions([
    beamStart.x, beamStart.y, beamStart.z,
    panelPos.x,  panelPos.y,  panelPos.z,
  ]);
  verifBeam = new Line2(geom, lineMat.clone());
  verifBeam.computeLineDistances();
  worldUIGroup.add(verifBeam);

  // Glowing endcap at breadboard center
  const capGeom = new THREE.SphereGeometry(0.013, 10, 10);
  const capMat  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  verifEndcap = new THREE.Mesh(capGeom, capMat);
  verifEndcap.position.copy(beamStart);
  worldUIGroup.add(verifEndcap);

  // CSS3D panel
  verifPanelObj = new CSS3DObject(verifEl);
  verifPanelObj.position.copy(panelPos);
  verifPanelObj.rotation.x = THREE.MathUtils.degToRad(-8);
  verifPanelObj.scale.setScalar(PANEL_SCALE);
  worldUIGroup.add(verifPanelObj);
  tweenScale(verifPanelObj, 0, PANEL_SCALE, 500);

  // Live value sync
  clearInterval(verifSyncInterval);
  verifSyncInterval = setInterval(() => {
    verifUS.innerHTML = latestUS === '—' ? '—' : `${latestUS}<em>cm</em>`;
    verifLedText.textContent = latestLED || '—';
    if (latestLED === 'ON') {
      verifLedDot.classList.add('on');
    } else {
      verifLedDot.classList.remove('on');
    }
  }, 200);
}

function hideVerificationCallout() {
  clearInterval(verifSyncInterval);
  if (verifBeam)    { worldUIGroup.remove(verifBeam);    verifBeam.geometry.dispose();    verifBeam = null; }
  if (verifEndcap)  { worldUIGroup.remove(verifEndcap);  verifEndcap.geometry.dispose();  verifEndcap = null; }
  if (verifPanelObj){ worldUIGroup.remove(verifPanelObj); verifPanelObj = null; }
}

// ── Step controller ────────────────────────────────────────────
const stepBanner  = document.getElementById('step-banner');
const sbCurrent   = document.getElementById('sb-current');
const sbTotal     = document.getElementById('sb-total');
const sbTitle     = document.getElementById('sb-title');
const sbStatus    = document.getElementById('sb-status');
const sbDesc      = document.getElementById('sb-desc');
const sbVerify    = document.getElementById('sb-verify');
const sbFill      = document.getElementById('sb-fill');

const stepController = {
  active:  false,
  current: 0,
  verified: false,

  toggle() {
    this.active = !this.active;
    if (this.active) {
      this.current = 0;
      this.verified = false;
      this.render();
      stepBanner.classList.add('visible');
    } else {
      stepBanner.classList.remove('visible');
    }
  },

  render() {
    if (!window.STEPS_DB) return;
    const step = window.STEPS_DB[this.current];
    if (!step) return;
    sbCurrent.textContent = step.id;
    sbTotal.textContent   = step.total;
    sbTitle.textContent   = step.title;
    sbDesc.textContent    = step.description;
    sbVerify.textContent  = step.verifyLabel;
    sbVerify.disabled     = false;
    sbFill.style.width    = `${(step.id / step.total) * 100}%`;
    this.setStatus('ready', 'Ready to scan');
  },

  setStatus(cls, text) {
    sbStatus.className = `sb-status ${cls}`;
    sbStatus.textContent = text;
  },

  checkVerify(preds) {
    if (!this.active || this.verified) return;
    const step = window.STEPS_DB?.[this.current];
    if (!step || step.requires.length === 0) return;

    const detected = preds.map(p => resolveComponent(p.class).id);
    const allFound = step.requires.every(r => detected.includes(r));

    if (allFound) {
      this.setStatus('done', 'Verified ✓');
    } else {
      const missing = step.requires.filter(r => !detected.includes(r));
      this.setStatus('waiting', `Waiting: ${missing.join(', ')}`);
    }
  },

  next() {
    if (!window.STEPS_DB) return;
    if (this.current < window.STEPS_DB.length - 1) {
      this.current++;
      this.verified = false;
      this.render();
    } else {
      this.setStatus('done', 'All steps complete!');
      sbVerify.textContent = 'Done';
      sbVerify.disabled    = true;
      sbFill.style.width   = '100%';
      showVerificationCallout();
    }
  },
};

sbVerify.addEventListener('click', () => {
  const step = window.STEPS_DB?.[stepController.current];
  if (!step) return;

  if (step.requires.length === 0) {
    stepController.setStatus('done', 'Verified ✓');
    setTimeout(() => stepController.next(), 700);
    return;
  }

  const detected = state.detections.map(p => resolveComponent(p.class).id);
  const allFound = step.requires.every(r => detected.includes(r));

  if (allFound) {
    stepController.setStatus('done', 'Verified ✓');
    stepController.verified = true;
    if (navigator.vibrate) navigator.vibrate([30, 20, 60]);
    setTimeout(() => stepController.next(), 900);
  } else {
    const missing = step.requires.filter(r => !detected.includes(r));
    stepController.setStatus('waiting', `Missing: ${missing.join(', ')}`);
    if (navigator.vibrate) navigator.vibrate(80);
  }
});

// ── iOS motion permission + startup gate ──────────────────────
async function requestSensorPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch {}
  }
}

const loaderRing = document.getElementById('loader-ring');
const loaderText = document.getElementById('loader-text');
const loaderSub  = document.getElementById('loader-sub');

loadScreen.addEventListener('click', async () => {
  loadScreen.classList.remove('tap-ready');
  loaderRing.style.opacity = '1';
  loaderText.textContent   = 'Initializing AR';
  loaderSub.textContent    = 'Loading tracking engine…';
  await requestSensorPermission();
  boot();
}, { once: true });
