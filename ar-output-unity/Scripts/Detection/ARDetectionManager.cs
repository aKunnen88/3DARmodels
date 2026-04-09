using UnityEngine;
using UnityEngine.XR.MagicLeap;
using ARExplorer.Data;
using Debug = UnityEngine.Debug;

namespace ARExplorer.Detection
{
    /// <summary>
    /// Main orchestrator: captures Magic Leap camera frames, feeds them
    /// to the classifier, and manages AR info cards.
    ///
    /// Attach this to an empty GameObject in your scene.
    /// ARMarkerBubble handles both the collapsed pill AND the expanded detail
    /// card — no separate DetailPanel GameObject needed.
    /// </summary>
    public class ARDetectionManager : MonoBehaviour
    {
        [Header("References")]
        public ImageClassifier classifier;
        public ComponentDatabase componentDatabase;
        public ARMarkerBubble markerBubblePrefab;
        public Transform markerParent;

        [Header("Detection Settings")]
        [Tooltip("Seconds between inference calls.")]
        public float detectionInterval = 0.25f;

        [Tooltip("Seconds before a stale marker is cleared (raise this if cards flicker).")]
        public float staleTimeout = 1.5f;

        [Header("Placement")]
        [Tooltip("Distance (metres) at which AR cards float.")]
        public float markerDistance = 1.5f;

        [Tooltip("How quickly the card position lerps toward the new detected bbox. 0 = instant snap.")]
        [Range(0f, 20f)]
        public float positionLerpSpeed = 4f;

        // ── State ──────────────────────────────────────────────────
        private float _lastDetectTime;
        private float _lastRefreshTime;
        private ARMarkerBubble _activeMarker;
        private string _activeClassKey;
        private Vector3 _targetMarkerPos;

        // ── Magic Leap Camera ──────────────────────────────────────
        private MLCamera _mlCamera;
        private MLCamera.CaptureConfig _captureConfig;
        private Texture2D _cameraTexture;
        private bool _cameraReady;
        private byte[] _pendingFrameData;
        private int _pendingWidth;
        private int _pendingHeight;
        private bool _frameReady;

        // ═══════════════════════════════════════════════════════════
        //  Lifecycle
        // ═══════════════════════════════════════════════════════════

        void Start()
        {
            Debug.Log("[ARDetection] Start()");
            if (classifier == null)
            {
                Debug.LogError("[ARDetection] Classifier is NULL — check Inspector!");
                return;
            }
            classifier.OnClassification += HandleClassification;
            InitMLCamera();
        }

        void Update()
        {
            if (!_cameraReady) return;

            // ── Apply pending camera frame on main thread ──────────
            if (_frameReady)
            {
                byte[] data; int w, h;
                lock (this)
                {
                    data = _pendingFrameData;
                    w    = _pendingWidth;
                    h    = _pendingHeight;
                    _frameReady = false;
                }

                if (_cameraTexture == null || _cameraTexture.width != w || _cameraTexture.height != h)
                    _cameraTexture = new Texture2D(w, h, TextureFormat.RGBA32, false);

                _cameraTexture.LoadRawTextureData(data);
                _cameraTexture.Apply();
            }

            float now = Time.time;

            // ── Run inference at interval ──────────────────────────
            if (now - _lastDetectTime > detectionInterval && _cameraTexture != null)
            {
                _lastDetectTime = now;
                classifier.Classify(_cameraTexture);
            }

            // ── Smoothly move active card toward latest detection ──
            if (_activeMarker != null)
            {
                if (positionLerpSpeed > 0f)
                    _activeMarker.transform.position = Vector3.Lerp(
                        _activeMarker.transform.position,
                        _targetMarkerPos,
                        Time.deltaTime * positionLerpSpeed);
                else
                    _activeMarker.transform.position = _targetMarkerPos;
            }

            // ── Clear stale marker ─────────────────────────────────
            if (_activeMarker != null && now - _lastRefreshTime > staleTimeout)
                ClearMarker();
        }

        void OnDestroy()
        {
            if (classifier != null)
                classifier.OnClassification -= HandleClassification;
            StopMLCamera();
        }

        // ═══════════════════════════════════════════════════════════
        //  Magic Leap Camera
        // ═══════════════════════════════════════════════════════════

        private async void InitMLCamera()
        {
#if UNITY_EDITOR
            Debug.Log("[ARDetection] Editor mode — ML Camera skipped.");
            return;
#endif
            if (!MLPermissions.CheckPermission(MLPermission.Camera).IsOk)
            {
                var cb = new MLPermissions.Callbacks();
                cb.OnPermissionGranted += OnPermissionGranted;
                cb.OnPermissionDenied  += OnPermissionDenied;
                MLPermissions.RequestPermission(MLPermission.Camera, cb);
                return;
            }
            await StartCameraCapture();
        }

        private async void OnPermissionGranted(string permission)
        {
            if (permission == MLPermission.Camera)
                await StartCameraCapture();
        }

        private void OnPermissionDenied(string permission) =>
            Debug.LogError($"[ARDetection] Camera permission denied: {permission}");

        private async System.Threading.Tasks.Task StartCameraCapture()
        {
            var ctx = MLCamera.ConnectContext.Create();
            ctx.CamId = MLCamera.Identifier.CV;
            ctx.Flags = MLCamera.ConnectFlag.CamOnly;

            _mlCamera = await MLCamera.CreateAndConnectAsync(ctx);
            if (_mlCamera == null) { Debug.LogError("[ARDetection] Failed to connect ML Camera."); return; }

            var caps = MLCamera.GetImageStreamCapabilitiesForCamera(_mlCamera, MLCamera.CaptureType.Video);
            if (caps.Length == 0) { Debug.LogError("[ARDetection] No camera stream capabilities."); return; }

            _captureConfig = new MLCamera.CaptureConfig
            {
                CaptureFrameRate = MLCamera.CaptureFrameRate._30FPS,
                StreamConfigs    = new[] { MLCamera.CaptureStreamConfig.Create(caps[0], MLCamera.OutputFormat.RGBA_8888) }
            };

            _mlCamera.PrepareCapture(_captureConfig, out MLCamera.Metadata _);
            await _mlCamera.PreCaptureAEAWBAsync();
            _mlCamera.OnRawVideoFrameAvailable += OnCameraFrame;
            await _mlCamera.CaptureVideoStartAsync();

            _cameraReady = true;
            Debug.Log("[ARDetection] ML Camera started.");
        }

        // Background thread — copy bytes only
        private void OnCameraFrame(MLCamera.CameraOutput output, MLCamera.ResultExtras extras, MLCamera.Metadata meta)
        {
            if (output.Planes.Length == 0) return;
            var plane  = output.Planes[0];
            int width  = (int)plane.Width;
            int height = (int)plane.Height;
            uint stride = plane.Stride > 0 ? plane.Stride : (uint)(width * 4);
            int rowBytes = width * 4;
            byte[] tight = new byte[width * height * 4];
            for (int row = 0; row < height; row++)
                System.Buffer.BlockCopy(plane.Data, (int)(row * stride), tight, row * rowBytes, rowBytes);

            lock (this)
            {
                _pendingFrameData = tight;
                _pendingWidth  = width;
                _pendingHeight = height;
                _frameReady = true;
            }
        }

        private void StopMLCamera()
        {
            if (_mlCamera == null) return;
            _mlCamera.OnRawVideoFrameAvailable -= OnCameraFrame;
            _mlCamera.CaptureVideoStop();
            _mlCamera.Disconnect();
            _mlCamera = null;
        }

        // ═══════════════════════════════════════════════════════════
        //  Detection
        // ═══════════════════════════════════════════════════════════

        private void HandleClassification(ImageClassifier.ClassificationResult result)
        {
            if (result.isBackground) return;

            string classKey = result.className.ToLower().Replace(" ", "_");
            if (componentDatabase == null) { Debug.LogError("[ARDetection] componentDatabase is NULL!"); return; }
            ComponentData comp = componentDatabase.Resolve(result.className);
            if (comp == null) return;

            // Compute where the marker should float in world space
            Vector3 newPos = BboxToWorldPos(result.boundingBox);

            _lastRefreshTime = Time.time;

            if (_activeClassKey == classKey)
            {
                // Same object — just update target position, no respawn
                _targetMarkerPos = newPos;
            }
            else
            {
                // New object — replace marker
                ClearMarker();
                SpawnMarker(comp, newPos);
                _activeClassKey = classKey;
            }
        }

        // ═══════════════════════════════════════════════════════════
        //  Marker Management
        // ═══════════════════════════════════════════════════════════

        private void SpawnMarker(ComponentData comp, Vector3 worldPos)
        {
            if (markerBubblePrefab == null) return;

            _targetMarkerPos = worldPos;
            _activeMarker    = Instantiate(markerBubblePrefab, worldPos, Quaternion.identity, markerParent);
            _activeMarker.Initialize(comp);

            Debug.Log($"[ARDetection] Spawned card for '{comp.displayName}' at {worldPos}");
        }

        private void ClearMarker()
        {
            if (_activeMarker != null)
            {
                _activeMarker.FadeOutAndDestroy();
                _activeMarker = null;
            }
            _activeClassKey = null;
        }

        // ═══════════════════════════════════════════════════════════
        //  Helpers
        // ═══════════════════════════════════════════════════════════

        /// <summary>
        /// Convert a normalised YOLO bounding box to a world-space position.
        /// YOLO bbox: x/y = top-left (0-1), y=0 is top.
        /// Unity viewport: y=0 is bottom → invert Y.
        /// </summary>
        private Vector3 BboxToWorldPos(Rect bbox)
        {
            Camera cam = Camera.main;
            if (cam == null) return transform.position + transform.forward * markerDistance;

            float vpX = bbox.x + bbox.width  * 0.5f;
            float vpY = 1f - (bbox.y + bbox.height * 0.5f); // invert Y for Unity

            Ray ray = cam.ViewportPointToRay(new Vector3(vpX, vpY, 0f));
            return ray.origin + ray.direction * markerDistance;
        }
    }
}
