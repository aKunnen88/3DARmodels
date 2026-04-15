// ═══════════════════════════════════════════════════════════════
//  AR Engine — Arduino Component Detector
//  Uses: Roboflow YOLO + MindAR.js image target tracking + MQTT
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { MindARThree } from 'https://unpkg.com/mind-ar@1.2.5/dist/mindar-image-three.prod.js';

const state = {
  markers: [],
  detections: [],
  scanning: true,
  lastDetectionTime: 0,
  detectionInterval: 300,
  markerRefreshedAt: 0,
  MARKER_STALE_MS: 1500,
  LERP_FACTOR: 0.12,
};

// ── DOM refs ───────────────────────────────────────────────────
let video = null; // assigned after MindAR starts
const canvas      = document.getElementById('overlay');
const ctx         = canvas.getContext('2d');
const loadScreen  = document.getElementById('loading-screen');
const hudStatus   = document.getElementById('hud-status');
const markersEl   = document.getElementById('markers-container');
const panel       = document.getElementById('detail-panel');
const panelTitle  = document.getElementById('panel-title');
const panelBadge  = document.getElementById('panel-badge');
const panelDesc   = document.getElementById('panel-desc');
const panelSpecs  = document.getElementById('panel-specs');
const panelTip    = document.getElementById('panel-tip');
const panelIcon   = document.getElementById('panel-icon');
const closeBtn    = document.getElementById('close-panel');
const mPlane      = document.getElementById('measurement-plane');
const mPlaneReset = document.getElementById('mplane-reset-btn');
const mPlaneUS    = document.getElementById('mplane-us');
const mPlaneLED   = document.getElementById('mplane-led');
const ovPanel     = document.getElementById('overview-panel');

// ── Positioning constants ──────────────────────────────────────
const PLANE_OFFSET = 160;  // px above anchor for measurement plane

// ── MindAR state ──────────────────────────────────────────────
let mindarTargetVisible = false;
let mindarAnchorGroup   = null;
let mindarCamera        = null;

// ── Overview panel — gyroscope world anchoring ────────────────
// Records phone orientation at app load, then keeps the panel
// at that fixed world direction. Panel drifts off-screen when
// the user looks away and comes back when they look at it again.
const currentOrient = { beta: 0, gamma: 0 };
const ovAnchor      = { beta0: null, gamma0: null, ready: false };
let   ovBaseX       = 0;   // screen X set at startup
let   ovBaseY       = 0;   // screen Y set at startup

const PPD_X = () => window.innerWidth  / 18;
const PPD_Y = () => window.innerHeight / 18;

window.addEventListener('deviceorientation', (e) => {
  if (e.beta === null) return;
  if (!ovAnchor.ready) {
    ovAnchor.beta0  = e.beta;
    ovAnchor.gamma0 = e.gamma;
    ovAnchor.ready  = true;
  }
  currentOrient.beta  = e.beta;
  currentOrient.gamma = e.gamma;
}, { passive: true });

// ── iOS motion permission ─────────────────────────────────────
// iOS 13+ blocks DeviceOrientationEvent unless requestPermission()
// is called from within a user gesture. Without this, gyroscope
// events never fire and the overview panel stays glued to screen.
async function requestSensorPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== 'granted') {
        console.warn('Motion permission denied — world anchoring disabled');
      }
    } catch (e) {
      console.warn('Motion permission error:', e);
    }
  }
  // Non-iOS: permission not needed, just continue
}

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  try {
    await initMindAR();
    connectMQTT();
  } catch (err) {
    updateStatus('⚠️ ' + err.message);
    hideLoader();
  }
}

// ── MindAR + Three.js initialization ──────────────────────────
async function initMindAR() {
  const mindarThree = new MindARThree({
    container:      document.body,
    imageTargetSrc: 'targets.mind',
    uiLoading:      'no',
    uiScanning:     'no',
    uiError:        'no',
  });

  const { renderer, scene, camera } = mindarThree;
  mindarCamera = camera;

  // Anchor for target image at index 0
  const imageAnchor = mindarThree.addAnchor(0);
  mindarAnchorGroup = imageAnchor.group;

  imageAnchor.onTargetFound = () => {
    mindarTargetVisible = true;
    mPlane.classList.remove('hidden');
    mPlane.style.visibility = 'visible';
    updateStatus('Arduino setup detected');
    syncMPlaneValues();
    if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
  };

  imageAnchor.onTargetLost = () => {
    mindarTargetVisible = false;
    mPlane.classList.add('hidden');
    clearInterval(mPlaneSyncInterval);
    updateStatus('Point at the target image');
  };

  await mindarThree.start();

  // Remove MindAR's Three.js background plane (video texture doesn't work on iOS).
  // We show the camera feed via the raw <video> element instead.
  if (mindarThree.background) scene.remove(mindarThree.background);
  renderer.setClearColor(0x000000, 0); // Three.js canvas is now transparent

  // Make MindAR's video element fill the screen as camera background
  video = mindarThree.video;
  Object.assign(video.style, {
    position:   'fixed',
    top:        '0',
    left:       '0',
    width:      '100%',
    height:     '100%',
    objectFit:  'cover',
    zIndex:     '0',
    display:    'block',
    visibility: 'visible',
  });

  // Three.js canvas sits above video but is transparent — tracking only
  Object.assign(renderer.domElement.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100%',
    height:        '100%',
    zIndex:        '1',
    pointerEvents: 'none',
  });

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  hideLoader();
  updateStatus('Point at the target image');

  // Show overview panel immediately, anchored to the user's initial direction
  ovBaseX = window.innerWidth  / 2;
  ovBaseY = window.innerHeight / 2;
  ovPanel.style.left = `${ovBaseX}px`;
  ovPanel.style.top  = `${ovBaseY}px`;
  ovPanel.classList.remove('hidden');
  ovPanel.style.visibility = 'visible';

  // MindAR's animation loop replaces requestAnimationFrame
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);

    const now = performance.now();
    if (now - state.lastDetectionTime > state.detectionInterval) {
      state.lastDetectionTime = now;
      detect();
    }

    // Clear stale markers when no fresh detection arrives
    if (state.detections.length > 0 && now - state.markerRefreshedAt > state.MARKER_STALE_MS) {
      state.detections = [];
      clearAllMarkers();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // LERP marker positions
    state.markers.forEach(m => {
      m.curX += (m.targetX - m.curX) * state.LERP_FACTOR;
      m.curY += (m.targetY - m.curY) * state.LERP_FACTOR;
      m.el.style.left = `${m.curX}px`;
      m.el.style.top  = `${m.curY}px`;
    });

    drawDetections();

    if (mindarTargetVisible && mindarAnchorGroup) {
      updatePanelsFromMindAR();
    }
    updateOverviewPanel();
  });
}

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Projects MindAR anchor's 3D world position to 2D screen coords (measurement plane only)
function updatePanelsFromMindAR() {
  const worldPos = new THREE.Vector3();
  mindarAnchorGroup.getWorldPosition(worldPos);
  worldPos.project(mindarCamera);

  const screenX = ( worldPos.x + 1) / 2 * window.innerWidth;
  const screenY = (-worldPos.y + 1) / 2 * window.innerHeight;

  mPlane.style.left = `${screenX}px`;
  mPlane.style.top  = `${screenY - PLANE_OFFSET}px`;

  const onScreen = screenX > -240 && screenX < window.innerWidth  + 240 &&
                   screenY > -100 && screenY < window.innerHeight + 300;
  mPlane.style.visibility = onScreen ? 'visible' : 'hidden';
}

// Keeps overview panel at the direction the phone was facing at app load.
// When the user looks away it drifts off-screen; looking back brings it back.
function updateOverviewPanel() {
  if (!ovAnchor.ready) return;

  const dGamma = currentOrient.gamma - ovAnchor.gamma0;
  const dBeta  = currentOrient.beta  - ovAnchor.beta0;

  const sx = ovBaseX + (-dGamma * PPD_X());
  const sy = ovBaseY + ( dBeta  * PPD_Y());

  ovPanel.style.left = `${sx}px`;
  ovPanel.style.top  = `${sy}px`;

  const onScreen = sx > -240 && sx < window.innerWidth  + 240 &&
                   sy > -120 && sy < window.innerHeight + 120;
  ovPanel.style.visibility = onScreen ? 'visible' : 'hidden';
}

// ── Coordinate mapping (video → screen, object-fit: cover) ────
function getScreenCoords(vx, vy) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sw = window.innerWidth;
  const sh = window.innerHeight;

  const scale   = Math.max(sw / vw, sh / vh);
  const offsetX = (vw * scale - sw) / 2;
  const offsetY = (vh * scale - sh) / 2;

  return {
    x: vx * scale - offsetX,
    y: vy * scale - offsetY,
  };
}

// ── Roboflow YOLO detection ────────────────────────────────────
const RF_API_KEY = 'sCeSU3tBkqCWRttvc4p5';
const RF_MODEL   = 'my-first-project-iccnb/2';

async function detect() {
  if (!state.scanning || !video || !video.videoWidth) return;
  if (video.paused) return;
  state.scanning = false;

  try {
    const snap = document.createElement('canvas');
    snap.width  = video.videoWidth;
    snap.height = video.videoHeight;
    snap.getContext('2d').drawImage(video, 0, 0);
    const base64 = snap.toDataURL('image/jpeg', 0.8).split(',')[1];

    const res = await fetch(
      `https://detect.roboflow.com/${RF_MODEL}?api_key=${RF_API_KEY}&confidence=50&overlap=30`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base64,
      }
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
      syncMarkers(preds);
      updateStatus(`${preds.length} component${preds.length > 1 ? 's' : ''} detected — tap!`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    setTimeout(() => { state.scanning = true; }, 100);
  }
}

// ── Draw bounding boxes ────────────────────────────────────────
function drawDetections() {
  state.detections.forEach(pred => {
    const [vx, vy, vw, vh] = pred.bbox;
    const comp = resolveComponent(pred.class);
    const tl   = getScreenCoords(vx, vy);
    const br   = getScreenCoords(vx + vw, vy + vh);
    const cx   = tl.x, cy = tl.y, cw = br.x - tl.x, ch = br.y - tl.y;
    ctx.save();
    drawCornerBrackets(cx, cy, cw, ch, Math.min(cw, ch) * 0.22, comp.color);
    ctx.restore();
  });
}

function drawCornerBrackets(x, y, w, h, arm, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  ctx.globalAlpha = 0.8;
  const corners = [
    [[x, y + arm], [x, y], [x + arm, y]],
    [[x + w - arm, y], [x + w, y], [x + w, y + arm]],
    [[x + w, y + h - arm], [x + w, y + h], [x + w - arm, y + h]],
    [[x + arm, y + h], [x, y + h], [x, y + h - arm]],
  ];
  corners.forEach(pts => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.lineTo(...pts[1]);
    ctx.lineTo(...pts[2]);
    ctx.stroke();
  });
}

// ── Resolve class → component DB entry ────────────────────────
function resolveComponent(className) {
  const id = className.toLowerCase().replace(/\s+/g, '_');
  return window.COMPONENTS_DB[id] || window.COMPONENTS_DB['unknown'];
}

// ── Markers ────────────────────────────────────────────────────
function clearAllMarkers() {
  state.markers.forEach(m => {
    m.el.classList.add('fade-out');
    setTimeout(() => m.el.remove(), 300);
  });
  state.markers = [];
}

function syncMarkers(preds) {
  const classCounts = {};
  const activeIds   = new Set();

  preds.forEach(p => {
    const classId = resolveComponent(p.class).id;
    classCounts[classId] = (classCounts[classId] || 0) + 1;
    activeIds.add(`marker-${classId}-${classCounts[classId]}`);
  });

  state.markers = state.markers.filter(m => {
    if (!activeIds.has(m.id)) {
      m.el.classList.add('fade-out');
      setTimeout(() => m.el.remove(), 300);
      return false;
    }
    return true;
  });

  const currentCounts = {};
  preds.forEach(pred => {
    const comp    = resolveComponent(pred.class);
    const classId = comp.id;
    currentCounts[classId] = (currentCounts[classId] || 0) + 1;
    const markerId = `marker-${classId}-${currentCounts[classId]}`;

    const [vx, vy, vw, vh]         = pred.bbox;
    const { x: targetX, y: targetY } = getScreenCoords(vx + vw / 2, vy + vh / 2);

    let marker = state.markers.find(m => m.id === markerId);
    if (!marker) {
      const el = createMarkerEl(comp, markerId);
      markersEl.appendChild(el);
      marker = { id: markerId, el, comp, curX: targetX, curY: targetY, targetX, targetY };
      state.markers.push(marker);
    }

    marker.targetX      = targetX;
    marker.targetY      = targetY;
    marker.comp         = comp;
    marker.el.dataset.comp = comp.id;
  });
}

function createMarkerEl(comp, id) {
  const el = document.createElement('div');
  el.className = 'ar-marker';
  el.id = id;
  el.innerHTML = `
    <div class="marker-ring" style="--mc:${comp.color}"></div>
    <div class="marker-ring delay" style="--mc:${comp.color}"></div>
    <div class="marker-dot" style="--mc:${comp.color}">
      <span class="marker-icon">${comp.icon}</span>
    </div>
    <div class="marker-label" style="border-color:${comp.color};color:${comp.color}">
      ${comp.name}
    </div>
  `;
  el.addEventListener('click',    ()  => openPanel(comp));
  el.addEventListener('touchend', (e) => { e.preventDefault(); openPanel(comp); });
  return el;
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

function closePanel() {
  panel.classList.remove('open');
  setTimeout(() => panel.classList.add('hidden'), 350);
}

closeBtn.addEventListener('click', closePanel);
document.getElementById('panel-bg-blur').addEventListener('click', closePanel);

// ── Helpers ────────────────────────────────────────────────────
function updateStatus(msg) { hudStatus.textContent = msg; }

function hideLoader() {
  loadScreen.classList.add('fade-out');
  setTimeout(() => loadScreen.remove(), 700);
}

// ── MQTT ──────────────────────────────────────────────────────
let latestUS  = '— cm';
let latestLED = '—';

function connectMQTT() {
  const client = mqtt.connect(
    'wss://0f23b53beddd48cebc845a657cd08ab6.s1.eu.hivemq.cloud:8884/mqtt',
    { username: 'CodeAcces', password: 'CodeAcces1', reconnectPeriod: 3000 }
  );
  client.on('connect', () => client.subscribe('hospital/sensors/ultrasonic'));
  client.on('message', (_t, payload) => {
    const val = parseFloat(payload.toString());
    if (!isNaN(val)) latestUS = val === -1 ? '— cm' : `${val.toFixed(1)} cm`;
  });
  client.on('error', err => console.warn('MQTT:', err));
}

// ── Measurement plane ─────────────────────────────────────────
mPlaneReset.addEventListener('click', () => {
  mPlane.classList.add('hidden');
  clearInterval(mPlaneSyncInterval);
});

let mPlaneSyncInterval = null;
function syncMPlaneValues() {
  clearInterval(mPlaneSyncInterval);
  mPlaneSyncInterval = setInterval(() => {
    mPlaneUS.textContent  = latestUS;
    mPlaneLED.textContent = latestLED;
  }, 200);
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
const aiBtn        = document.getElementById('ai-btn');
const micBtn       = document.getElementById('mic-btn');

aiBtn.addEventListener('click', openAIPanel);
aiCloseBtn.addEventListener('click', closeAIPanel);
aiPanelBg.addEventListener('click', closeAIPanel);
aiSendBtn.addEventListener('click', sendAIMessage);
aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendAIMessage(); });

function openAIPanel() {
  aiPanel.classList.remove('hidden');
  requestAnimationFrame(() => aiPanel.classList.add('open'));
  aiInput.focus();
}

function closeAIPanel() {
  aiPanel.classList.remove('open');
  setTimeout(() => aiPanel.classList.add('hidden'), 380);
}

function buildSystemPrompt() {
  const detected = state.markers.map(m => m.comp.fullName).join(', ') || 'nothing yet';
  return `You are an expert Arduino and electronics assistant embedded in an AR app.
Current detected components: ${detected}.
Ultrasonic sensor reading: ${latestUS}.
LED active: ${latestLED}.
Be concise, helpful, and practical. Answer in plain text, no markdown.`;
}

async function sendAIMessage() {
  const question = aiInput.value.trim();
  if (!question) return;
  aiInput.value = '';
  aiResponseEl.innerHTML = `<div class="ai-thinking"><span></span><span></span><span></span></div>`;
  aiResponseEl.classList.remove('active');

  try {
    const res = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model:      LLM_MODEL,
        messages:   [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: question },
        ],
        max_tokens: 300,
      }),
    });
    const data   = await res.json();
    const answer = data.choices?.[0]?.message?.content || 'No response received.';
    aiResponseEl.textContent = answer;
    aiResponseEl.classList.add('active');
  } catch (err) {
    aiResponseEl.textContent = 'Could not reach the AI. Check your API key or connection.';
    console.error(err);
  }
}

// ── Voice input ────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition      = new SpeechRecognition();
  recognition.lang       = 'en-US';
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
  recognition.addEventListener('result', e   => {
    aiInput.value = e.results[0][0].transcript;
    sendAIMessage();
  });
  recognition.addEventListener('error',  e   => {
    console.warn('Speech error:', e.error);
    micBtn.classList.remove('recording');
  });
} else {
  micBtn.title   = 'Speech recognition not supported in this browser';
  micBtn.style.opacity = '0.4';
}

// ── Start ─────────────────────────────────────────────────────
// Gate startup behind a user tap so iOS will grant DeviceOrientation
// permission (required for gyroscope-based world anchoring).
const loaderRing = document.getElementById('loader-ring');
const loaderText = document.getElementById('loader-text');
const loaderSub  = document.getElementById('loader-sub');

loadScreen.addEventListener('click', async () => {
  // Switch to spinner / loading state
  loadScreen.classList.remove('tap-ready');
  loaderRing.style.opacity = '1';
  loaderText.textContent   = 'Initializing AR';
  loaderSub.textContent    = 'Loading AR tracking engine…';
  loaderSub.style.animation = 'none';

  // Request iOS motion permission — MUST be inside a user gesture
  await requestSensorPermission();

  boot();
}, { once: true });
