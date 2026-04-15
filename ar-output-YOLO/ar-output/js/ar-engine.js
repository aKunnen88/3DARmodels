// ═══════════════════════════════════════════════════════════════
//  AR Engine — Arduino Component Detector
//  Uses: TensorFlow.js + Teachable Machine + custom electronics DB
// ═══════════════════════════════════════════════════════════════

const state = {
  model: null,
  stream: null,
  animFrame: null,
  markers: [],
  detections: [],
  scanning: true,
  lastDetectionTime: 0,
  detectionInterval: 300,   // faster polling for snappier response
  lastActiveClass: null,    // track which class is currently shown
  markerRefreshedAt: 0,     // timestamp of last successful detection
  MARKER_STALE_MS: 1500,    // extended to 1.5s for Roboflow API latency
  LERP_FACTOR: 0.12,        // smooth "float" speed (0-1)
};

// ── DOM refs ───────────────────────────────────────────────────
const video       = document.getElementById('camera');
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

// ── Model URL ──────────────────────────────────────────────────
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/5HBj-fn_i/';

// ── Boot sequence ──────────────────────────────────────────────
async function boot() {
  try {
    await startCamera();
    updateStatus('Point at a component');
    hideLoader();
    requestAnimationFrame(renderLoop);
  } catch (err) {
    updateStatus('⚠️ ' + err.message);
  }
}
// ── Camera ─────────────────────────────────────────────────────
async function startCamera() {
  const constraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width:  { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false
  };
  state.stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = state.stream;
  await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * Maps raw video coordinates to screen coordinates accounting for object-fit: cover
 */
function getScreenCoords(vx, vy) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sw = window.innerWidth;
  const sh = window.innerHeight;

  const scale = Math.max(sw / vw, sh / vh);
  const offsetX = (vw * scale - sw) / 2;
  const offsetY = (vh * scale - sh) / 2;

  return {
    x: vx * scale - offsetX,
    y: vy * scale - offsetY
  };
}

// ── Main render loop ───────────────────────────────────────────
function renderLoop(ts) {
  state.animFrame = requestAnimationFrame(renderLoop);
  if (!video.videoWidth) return;

  const now = performance.now();
  if (now - state.lastDetectionTime > state.detectionInterval) {
    state.lastDetectionTime = now;
    detect();
  }

  // Auto-clear stale markers if no fresh detection arrived
  if (state.detections.length > 0 && now - state.markerRefreshedAt > state.MARKER_STALE_MS) {
    state.detections = [];
    clearAllMarkers();
    updateStatus('Point at a component');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Update and draw markers (LERP)
  state.markers.forEach(m => {
    m.curX += (m.targetX - m.curX) * state.LERP_FACTOR;
    m.curY += (m.targetY - m.curY) * state.LERP_FACTOR;
    m.el.style.left = `${m.curX}px`;
    m.el.style.top  = `${m.curY}px`;
  });

  drawDetections();
}

// ── Teachable Machine detection ────────────────────────────────
const RF_API_KEY = 'sCeSU3tBkqCWRttvc4p5';
const RF_MODEL   = 'my-first-project-iccnb/2'; // shown on your versions page

async function detect() {
  if (!state.scanning || video.paused) return;
  state.scanning = false;

  try {
    // Capture frame from video to canvas
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
        body: base64
      }
    );

    const data = await res.json();
    const preds = (data.predictions || []).map(p => ({
      class: p.class,
      score: p.confidence,
      bbox: [p.x - p.width/2, p.y - p.height/2, p.width, p.height]
    }));

    if (preds.length > 0) {
      state.detections = preds;
      state.markerRefreshedAt = performance.now();
      syncMarkers(preds);
      updateStatus(`${preds.length} component${preds.length > 1 ? 's' : ''} detected — tap!`);
    } else {
      // Let renderLoop handle stale cleanup if preds empty for a bit
    }

  } catch(e) {
    console.error(e);
  } finally {
    // Shorter timeout since network request acts as natural debounce
    setTimeout(() => { state.scanning = true; }, 100);
  }
}

// ── Draw bounding boxes on canvas ─────────────────────────────
function drawDetections() {
  state.detections.forEach(pred => {
    const [vx, vy, vw, vh] = pred.bbox;
    const comp = resolveComponent(pred.class);
    
    // Map center and corners to screen
    const tl = getScreenCoords(vx, vy);
    const br = getScreenCoords(vx + vw, vy + vh);
    
    const cx = tl.x, cy = tl.y, cw = br.x - tl.x, ch = br.y - tl.y;
    const arm = Math.min(cw, ch) * 0.22;
    
    ctx.save();
    drawCornerBrackets(cx, cy, cw, ch, arm, comp.color);
    ctx.restore();
  });
}

function drawCornerBrackets(x, y, w, h, arm, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.8;
  const corners = [
    [[x, y+arm],[x,y],[x+arm,y]],
    [[x+w-arm,y],[x+w,y],[x+w,y+arm]],
    [[x+w,y+h-arm],[x+w,y+h],[x+w-arm,y+h]],
    [[x+arm,y+h],[x,y+h],[x,y+h-arm]],
  ];
  corners.forEach(pts => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.lineTo(...pts[1]);
    ctx.lineTo(...pts[2]);
    ctx.stroke();
  });
}

// ── Resolve class name → component ────────────────────────────
// Single function — takes whatever Teachable Machine returns,
// lowercases it, and looks it up in the DB.
function resolveComponent(className) {
  const id = className.toLowerCase().replace(/\s+/g, '_');
  return window.COMPONENTS_DB[id] || window.COMPONENTS_DB['unknown'];
}

// ── Clear all markers immediately ──────────────────────────────
function clearAllMarkers() {
  state.markers.forEach(m => {
    m.el.classList.add('fade-out');
    setTimeout(() => m.el.remove(), 300);
  });
  state.markers = [];
}

// ── AR Marker bubbles ──────────────────────────────────────────
function syncMarkers(preds) {
  const classCounts = {};
  const activeIds = new Set();
  
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

  preds.forEach((pred) => {
    const comp = resolveComponent(pred.class);
    const classId = comp.id;
    currentCounts[classId] = (currentCounts[classId] || 0) + 1;
    const markerId = `marker-${classId}-${currentCounts[classId]}`;

    const [vx, vy, vw, vh] = pred.bbox;
    const { x: targetX, y: targetY } = getScreenCoords(vx + vw / 2, vy + vh / 2);

    let marker = state.markers.find(m => m.id === markerId);

    if (!marker) {
      const el = createMarkerEl(comp, pred.class, markerId);
      markersEl.appendChild(el);
      marker = { id: markerId, el, comp, curX: targetX, curY: targetY, targetX, targetY };
      state.markers.push(marker);
    }

    marker.targetX = targetX;
    marker.targetY = targetY;
    marker.comp = comp;
    marker.el.dataset.comp = comp.id;
  });
}

function createMarkerEl(comp, rawClass, id) {
  const el = document.createElement('div');
  el.className = 'ar-marker';
  el.id = id;
  el.innerHTML = `
    <div class="marker-ring" style="--mc:${comp.color}"></div>
    <div class="marker-ring delay" style="--mc:${comp.color}"></div>
    <div class="marker-dot" style="background:${comp.color}">
      <span class="marker-icon">${comp.icon}</span>
    </div>
    <div class="marker-label" style="border-color:${comp.color};color:${comp.color}">
      ${comp.name}
    </div>
  `;
  el.addEventListener('click', () => openPanel(comp));
  el.addEventListener('touchend', (e) => { e.preventDefault(); openPanel(comp); });
  return el;
}

// ── Detail panel ───────────────────────────────────────────────
function openPanel(comp) {
  panelIcon.textContent  = comp.icon;
  panelTitle.textContent = comp.fullName;
  panelBadge.textContent = comp.badge;
  panelBadge.style.background = comp.badgeColor;
  panelDesc.textContent  = comp.desc;
  panelTip.textContent   = comp.tip;

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
function updateStatus(msg) {
  hudStatus.textContent = msg;
}

function hideLoader() {
  loadScreen.classList.add('fade-out');
  setTimeout(() => loadScreen.remove(), 700);
}

// ── Start ──────────────────────────────────────────────────────
boot();