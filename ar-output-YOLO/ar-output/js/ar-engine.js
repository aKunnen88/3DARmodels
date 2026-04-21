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
const PANEL_SCALE        = 0.0018;
const PILL_SCALE         = 0.0011;
const SENSOR_PANEL_SCALE = 0.0028;   // larger — this is the hero panel
let ovObj  = null;   // overview  – LEFT
let mpObj  = null;   // measurements – CENTER

// ── Central sensor beam ────────────────────────────────────────
let sensorBeamGroup     = null;
let sensorSyncInterval  = null;
const sbpUSValue  = document.getElementById('sbp-us-value');
const sbpLedDot   = document.getElementById('sbp-led-dot');
const sbpLedState = document.getElementById('sbp-led-state');

// ── Beam / pill tracking ───────────────────────────────────────
let beamObjects   = [];   // { line, endcap, pillObj }
let lineMat       = null;

// ── Screen-space marker state (fallback) ──────────────────────
const markersEl    = document.getElementById('markers-container');
const beamCanvas   = document.getElementById('beam-canvas');
const beamCtx      = beamCanvas ? beamCanvas.getContext('2d') : null;
let   screenMarkers = [];   // { id, el, comp, detX, detY, curX, curY, targetX, targetY }
const LERP = 0.14;
const PILL_OFFSET_Y = 78;

// ── Screen-space sensor card ───────────────────────────────────
const ssSensorCard  = document.getElementById('ss-sensor-card');
const ssUSValue     = document.getElementById('ss-us-value');
const ssLedDot      = document.getElementById('ss-led-dot');
const ssLedState    = document.getElementById('ss-led-state');
let   ssSensorCardX = 0;   // current smoothed X
let   ssSensorCardY = 0;
let   ssTargetX     = 0;
let   ssTargetY     = 0;
let   ssVisible     = false;

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

  // Central sensor beam (hero data panel)
  setupSensorBeam();

  // World-anchored triptych panels
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

// ── Central sensor beam setup ──────────────────────────────────
function setupSensorBeam() {
  sensorBeamGroup = new THREE.Group();
  mindarAnchorGroup.add(sensorBeamGroup);
  sensorBeamGroup.visible = false;

  const BEAM_HEIGHT = 0.85;   // ~15 cm in anchor units
  const PANEL_Y     = BEAM_HEIGHT + 0.12;

  // Vertical white beam from base to top
  const beamGeom = new LineGeometry();
  beamGeom.setPositions([0, 0.02, 0,  0, BEAM_HEIGHT, 0]);
  const beam = new Line2(beamGeom, new LineMaterial({
    color: 0xffffff, linewidth: 3,
    transparent: true, opacity: 0.92,
    worldUnits: false,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  }));
  beam.computeLineDistances();
  sensorBeamGroup.add(beam);

  // Glowing base dot at breadboard surface
  const baseDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  baseDot.position.set(0, 0.02, 0);
  sensorBeamGroup.add(baseDot);

  // Soft outer ring at base
  const ringGeom = new LineGeometry();
  const segs = 32;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(Math.cos(a) * 0.04, 0.005, Math.sin(a) * 0.04);
  }
  ringGeom.setPositions(pts);
  const ring = new Line2(ringGeom, new LineMaterial({
    color: 0xffffff, linewidth: 1.5,
    transparent: true, opacity: 0.35,
    worldUnits: false,
    resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
  }));
  ring.computeLineDistances();
  sensorBeamGroup.add(ring);

  // Sensor data panel (CSS3DObject) at beam top
  const panelEl = document.getElementById('sensor-beam-panel');
  const panelObj = new CSS3DObject(panelEl);
  panelObj.position.set(0, PANEL_Y, 0);
  panelObj.scale.setScalar(SENSOR_PANEL_SCALE);
  sensorBeamGroup.add(panelObj);
  sensorBeamGroup.userData.panelObj = panelObj;
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

  // Show sensor beam with scale-in
  if (sensorBeamGroup) {
    sensorBeamGroup.visible = true;
    const po = sensorBeamGroup.userData.panelObj;
    if (po) tweenScale(po, 0, SENSOR_PANEL_SCALE, 550);
  }

  // Live sensor data loop
  clearInterval(sensorSyncInterval);
  sensorSyncInterval = setInterval(() => {
    if (sbpUSValue)  sbpUSValue.textContent  = latestUS === '—' ? '—' : latestUS;
    if (sbpLedState) sbpLedState.textContent = latestLED || '—';
    if (sbpLedDot) {
      sbpLedDot.classList.toggle('on', latestLED === 'ON');
    }
  }, 200);

  // Triptych panels
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
  clearInterval(sensorSyncInterval);
  if (sensorBeamGroup) sensorBeamGroup.visible = false;
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
  ssVisible = false;
  if (ssSensorCard) ssSensorCard.style.display = 'none';
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

    const [vx, vy, vw, vh] = pred.bbox;
    const { x: detX, y: detY } = getScreenCoords(vx + vw / 2, vy + vh / 2);

    // Pill floats above the detection; stays on screen
    const targetX = Math.max(40, Math.min(window.innerWidth - 40, detX));
    const targetY = Math.max(70, detY - PILL_OFFSET_Y);

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

      m = { id: markerId, el, comp, detX, detY, curX: targetX, curY: targetY, targetX, targetY };
      screenMarkers.push(m);
    }

    m.detX    = detX;
    m.detY    = detY;
    m.targetX = targetX;
    m.targetY = targetY;
  });
}

function tickScreenMarkers() {
  if (!beamCtx) return;

  if (beamCanvas.width  !== window.innerWidth)  beamCanvas.width  = window.innerWidth;
  if (beamCanvas.height !== window.innerHeight) beamCanvas.height = window.innerHeight;

  beamCtx.clearRect(0, 0, beamCanvas.width, beamCanvas.height);
  if (screenMarkers.length === 0) return;

  // ── Compute centroid of all detections ──────────────────────
  let sumX = 0, sumY = 0;
  screenMarkers.forEach(m => { sumX += m.detX; sumY += m.detY; });
  const centX = sumX / screenMarkers.length;
  const centY = sumY / screenMarkers.length;

  // ── Sensor card: float well above all component labels ──────
  const cardH   = 130;
  const BEAM_GAP = 18;
  ssTargetX = centX;
  // Keep card in top 25 % of screen so it never overlaps component pills
  const maxCardY = window.innerHeight * 0.25;
  ssTargetY = Math.min(maxCardY, Math.max(cardH + 12, centY - 580));

  ssSensorCardX += (ssTargetX - ssSensorCardX) * LERP;
  ssSensorCardY += (ssTargetY - ssSensorCardY) * LERP;

  if (!ssVisible) {
    // Snap to position immediately — don't LERP from (0,0)
    ssSensorCardX = ssTargetX;
    ssSensorCardY = ssTargetY;
    ssVisible = true;
    if (ssSensorCard) ssSensorCard.style.display = 'block';
  }
  if (ssSensorCard) {
    ssSensorCard.style.left = `${ssSensorCardX}px`;
    ssSensorCard.style.top  = `${ssSensorCardY}px`;
  }

  // ── Update sensor values ────────────────────────────────────
  if (ssUSValue)  ssUSValue.textContent  = latestUS === '—' ? '—' : latestUS;
  if (ssLedState) ssLedState.textContent = latestLED || '—';
  if (ssLedDot)   ssLedDot.classList.toggle('on', latestLED === 'ON');

  // ── Central beam: centroid → card bottom ────────────────────
  const beamTopY    = ssSensorCardY + cardH + BEAM_GAP;
  const beamBottomY = centY;

  beamCtx.save();
  beamCtx.lineCap = 'round';

  // Dark outline stroke for contrast on light/white backgrounds
  beamCtx.strokeStyle = 'rgba(0,0,0,0.55)';
  beamCtx.lineWidth   = 7;
  beamCtx.shadowBlur  = 0;
  beamCtx.beginPath();
  beamCtx.moveTo(ssSensorCardX, beamTopY);
  beamCtx.lineTo(centX, beamBottomY);
  beamCtx.stroke();

  // White core
  beamCtx.strokeStyle = 'rgba(255,255,255,0.95)';
  beamCtx.lineWidth   = 3;
  beamCtx.shadowColor = 'rgba(255,255,255,0.8)';
  beamCtx.shadowBlur  = 10;
  beamCtx.beginPath();
  beamCtx.moveTo(ssSensorCardX, beamTopY);
  beamCtx.lineTo(centX, beamBottomY);
  beamCtx.stroke();
  beamCtx.restore();

  // Base dot — dark ring + white fill for contrast
  beamCtx.beginPath();
  beamCtx.arc(centX, centY, 8, 0, Math.PI * 2);
  beamCtx.fillStyle = 'rgba(0,0,0,0.5)';
  beamCtx.fill();

  beamCtx.beginPath();
  beamCtx.arc(centX, centY, 5, 0, Math.PI * 2);
  beamCtx.fillStyle = 'rgba(255,255,255,0.98)';
  beamCtx.shadowColor = 'rgba(255,255,255,0.9)';
  beamCtx.shadowBlur  = 12;
  beamCtx.fill();
  beamCtx.shadowBlur = 0;

  // ── Per-marker pill beams ────────────────────────────────────
  screenMarkers.forEach(m => {
    m.curX += (m.targetX - m.curX) * LERP;
    m.curY += (m.targetY - m.curY) * LERP;
    m.el.style.left = `${m.curX}px`;
    m.el.style.top  = `${m.curY}px`;

    beamCtx.strokeStyle = 'rgba(255,255,255,0.75)';
    beamCtx.lineWidth   = 1.8;
    beamCtx.lineCap     = 'round';
    beamCtx.shadowBlur  = 4;
    beamCtx.shadowColor = 'rgba(255,255,255,0.4)';
    beamCtx.beginPath();
    beamCtx.moveTo(m.detX, m.detY);
    beamCtx.lineTo(m.curX, m.curY + 19);
    beamCtx.stroke();
    beamCtx.shadowBlur = 0;

    // Small dot at component
    beamCtx.fillStyle = 'rgba(255,255,255,0.9)';
    beamCtx.beginPath();
    beamCtx.arc(m.detX, m.detY, 3.5, 0, Math.PI * 2);
    beamCtx.fill();
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
// On localhost: call Roboflow directly (key only visible locally)
// On Vercel:    call /api/detect  → key stays server-side
const RF_API_KEY = 'sCeSU3tBkqCWRttvc4p5';  // used only on localhost
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

    let data;
    if (IS_LOCAL || IS_HTTP_LOCAL) {
      // Direct Roboflow call — works on localhost and LAN HTTP server (192.168.x.x)
      const res = await fetch(
        `https://detect.roboflow.com/${RF_MODEL}?api_key=${RF_API_KEY}&confidence=50&overlap=30`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: base64 }
      );
      data = await res.json();
    } else {
      // Vercel: proxy through /api/detect — key stays in environment variable
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      data = await res.json();
    }


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

// ── AI Panel — smart backend detection ───────────────────────
// • custom endpoint input → always used when set
// • localhost → tries Ollama (qwen2.5:3b) directly on port 11434
// • Vercel / any HTTPS host → calls /api/chat serverless function
const OLLAMA_URL    = 'http://localhost:11434/v1/chat/completions';
const OLLAMA_MODEL  = 'qwen2.5:3b';
const VERCEL_URL    = '/api/chat';
const VERCEL_MODEL  = 'qwen/qwen2.5-7b-instruct';

// Detect environment:
// • localhost / 127.0.0.1   → prefer Ollama directly (dev machine browser)
// • HTTP (local-server.js)  → /api/chat proxies to Ollama on the server
// • HTTPS (Vercel)          → /api/chat calls NVIDIA cloud API
const IS_LOCALHOST  = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const IS_HTTP_LOCAL = location.protocol === 'http:' && !IS_LOCALHOST; // e.g. 192.168.x.x:3001
const IS_LOCAL      = IS_LOCALHOST;
let   USE_OLLAMA    = IS_LOCALHOST;  // will be set false if Ollama ping fails
let   useArduinoSkill = false;       // ArduinoExpert skill toggle
let   customEndpointURL = localStorage.getItem('qwen_endpoint') || ''; // persisted across reloads

// Pre-flight: ping Ollama to see if it's actually running (only on localhost)
if (IS_LOCALHOST) {
  fetch('http://localhost:11434', { method: 'GET', signal: AbortSignal.timeout(1500) })
    .catch(() => { USE_OLLAMA = false; });
}

// ArduinoExpert skill — full content from LLMIntegration/ArduinoExpert/Skill.md
const ARDUINO_EXPERT_SKILL = `You are an Arduino hardware expert specializing in ultrasonic distance measurement. You have deep knowledge of the HC-SR04 ultrasonic sensor, Arduino Uno board, wiring, and the underlying electronics.

## Project Overview
This project uses an Arduino Uno board with an HC-SR04 ultrasonic distance sensor to measure distances in centimeters. The measured distance is sent over serial (115200 baud) every 100 ms.

## The HC-SR04 Ultrasonic Sensor
The HC-SR04 provides 2 cm to 400 cm non-contact distance measurement with ~3 mm accuracy.
How it works: Arduino sends a 10 µs HIGH pulse on Trig → sensor emits eight 40 kHz pulses → pulses bounce back → Echo pin goes HIGH for round-trip duration → distance (cm) = duration × 0.0343 / 2.

Pins: VCC (+5V DC), Trig (trigger input, 10 µs pulse), Echo (output, HIGH for round-trip time), GND.

## Arduino Uno Wiring
HC-SR04 VCC → Arduino 5V (NOT 3.3V — sensor requires exactly 5V)
HC-SR04 Trig → Arduino D9 (OUTPUT, sends trigger pulse)
HC-SR04 Echo → Arduino D10 (INPUT, reads echo duration via pulseIn)
HC-SR04 GND → Arduino GND (common ground reference)

## Arduino Code Reference
Serial.begin(115200) — fast serial for 10 Hz streaming
trigPin=9, echoPin=10
Trigger: digitalWrite(trigPin,LOW) → delayMicroseconds(2) → HIGH → delayMicroseconds(10) → LOW
Read: duration = pulseIn(echoPin, HIGH, 20000) [20ms timeout ≈ 3.4m max]
Calculate: distanceCm = duration * 0.0343 / 2
Send: Serial.println(-1) when timeout, else Serial.println((int)distanceCm)
Loop: delay(100) for 10 Hz rate

## Common Mistakes & Fixes
- Always -1: check VCC→5V, GND, Trig→D9, Echo→D10 wiring
- Wrong readings: Trig/Echo pins swapped — swap wires on D9 and D10
- Garbage serial output: set Serial Monitor baud to 115200
- Unstable readings: add 10 µF capacitor across VCC/GND on sensor, use short wires
- Half/double distance: ensure formula is duration * 0.0343 / 2
- 3.3V boards (ESP32): need level shifter or HC-SR04P variant

## When answering: reference exact pins (D9, D10, 5V, GND), explain the why, cite speed of sound (343 m/s at 20°C), warn about common mistakes.`;

const aiPanel      = document.getElementById('ai-panel');
const aiPanelBg    = document.getElementById('ai-panel-bg');
const aiCloseBtn   = document.getElementById('ai-close-btn');
const aiInput      = document.getElementById('ai-input');
const aiSendBtn    = document.getElementById('ai-send-btn');
const aiResponseEl = document.getElementById('ai-response-text');

// Show the model name in the panel header
const aiHeaderTitle = document.querySelector('.ai-header-title');
function updateAIHeaderLabel() {
  if (!aiHeaderTitle) return;
  let label;
  if (customEndpointURL) {
    label = 'qwen2.5 · local custom';
  } else if (IS_HTTP_LOCAL) {
    label = 'qwen2.5:3b · local server';
  } else {
    label = USE_OLLAMA ? 'qwen2.5:3b · local' : 'qwen2.5-7b · cloud';
  }
  const skillTag = useArduinoSkill ? ' <span style="color:var(--accent);font-size:9px;">⚡ skill</span>' : '';
  aiHeaderTitle.innerHTML = `<span class="dot"></span> AI Assistant <small style="font-size:10px;opacity:0.55;margin-left:6px;">${label}${skillTag}</small>`;
}
updateAIHeaderLabel();

aiCloseBtn.addEventListener('click', closeAIPanel);
aiPanelBg.addEventListener('click',  closeAIPanel);
aiSendBtn.addEventListener('click',  sendAIMessage);
aiInput.addEventListener('keydown',  e => { if (e.key === 'Enter') sendAIMessage(); });

// Skill toggle
const skillToggleCb  = document.getElementById('skill-toggle-cb');
skillToggleCb.addEventListener('change', () => {
  useArduinoSkill = skillToggleCb.checked;
  updateAIHeaderLabel();
});

// Endpoint config button + input
const aiEndpointBtn   = document.getElementById('ai-endpoint-btn');
const aiEndpointRow   = document.getElementById('ai-endpoint-row');
const aiEndpointInput = document.getElementById('ai-endpoint-input');

aiEndpointBtn.addEventListener('click', () => {
  const open = !aiEndpointRow.classList.contains('hidden');
  aiEndpointRow.classList.toggle('hidden', open);
  aiEndpointBtn.classList.toggle('active', !open);
  if (!open) aiEndpointInput.focus();
});

// Pre-fill from localStorage
if (customEndpointURL) {
  aiEndpointInput.value = customEndpointURL;
  updateAIHeaderLabel();
}

aiEndpointInput.addEventListener('input', () => {
  customEndpointURL = aiEndpointInput.value.trim();
  localStorage.setItem('qwen_endpoint', customEndpointURL);
  updateAIHeaderLabel();
});

aiEndpointInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    aiEndpointRow.classList.add('hidden');
    aiEndpointBtn.classList.remove('active');
    aiInput.focus();
  }
});

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
  const base = `You are an expert Arduino and electronics assistant embedded in an AR app.
Currently detected components: ${detected}.
Live ultrasonic sensor: ${latestUS} cm. LED state: ${latestLED}.
Be concise and practical. No markdown formatting — plain text only.`;
  if (useArduinoSkill) {
    return ARDUINO_EXPERT_SKILL + '\n\n---\n\n' + base;
  }
  return base;
}

async function sendAIMessage() {
  const question = aiInput.value.trim();
  if (!question) return;

  // User bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'ai-bubble ai-bubble-user';
  userBubble.textContent = question;
  aiResponseEl.parentElement.appendChild(userBubble);
  aiInput.value = '';

  // Thinking bubble
  const thinkBubble = document.createElement('div');
  thinkBubble.className = 'ai-bubble ai-bubble-assistant';
  thinkBubble.innerHTML = `<div class="ai-thinking"><span></span><span></span><span></span></div>`;
  aiResponseEl.parentElement.appendChild(thinkBubble);

  const responseArea = document.getElementById('ai-response-area');
  responseArea.scrollTop = responseArea.scrollHeight;

  try {
    // Route decision:
    // • localhost + Ollama running → call Ollama directly
    // • custom endpoint set        → call VERCEL_URL which proxies server-side to the
    //                                ngrok/local URL (avoids browser CORS + ngrok interstitial)
    // • everything else            → call VERCEL_URL → NVIDIA cloud
    const useLocal = USE_OLLAMA && !customEndpointURL;
    const endpoint = useLocal ? OLLAMA_URL : VERCEL_URL;
    const model    = customEndpointURL ? OLLAMA_MODEL : (useLocal ? OLLAMA_MODEL : VERCEL_MODEL);

    const requestBody = {
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: question },
      ],
      max_tokens: 300,
      stream: true,
    };

    if (customEndpointURL) requestBody.localEndpoint = customEndpointURL;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${res.status}: ${err.slice(0, 120)}`);
    }

    // Stream SSE tokens into the bubble as they arrive
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let fullText  = '';
    let started   = false;

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer   = lines.pop(); // keep any incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break outer;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) {
            if (!started) {
              thinkBubble.textContent = '';
              thinkBubble.classList.add('active');
              started = true;
            }
            fullText += delta;
            thinkBubble.textContent = fullText;
            responseArea.scrollTop  = responseArea.scrollHeight;
          }
        } catch { /* malformed chunk — skip */ }
      }
    }

    if (!started) {
      thinkBubble.textContent = 'No response received.';
      thinkBubble.classList.add('active');
    }

  } catch (err) {
    console.error('[AI]', err);
    const isDown = err.message.includes('Failed to fetch') || err.message.includes('NetworkError');
    if (isDown && customEndpointURL) {
      thinkBubble.innerHTML = `<b>Custom endpoint unreachable.</b><br>Check the URL in ⚙ settings.`;
    } else if (isDown && USE_OLLAMA) {
      USE_OLLAMA = false;
      updateAIHeaderLabel();
      thinkBubble.textContent = 'Ollama not reachable — switched to cloud. Resend your question.';
    } else {
      thinkBubble.innerHTML = isDown
        ? `<b>AI unavailable.</b><br>Use ⚙ to set your local Qwen endpoint or run Ollama on localhost.`
        : `Error: ${err.message}`;
    }
    thinkBubble.classList.add('active');
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
