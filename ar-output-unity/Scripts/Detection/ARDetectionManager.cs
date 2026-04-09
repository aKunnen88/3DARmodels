using UnityEngine;
using UnityEngine.XR.MagicLeap;
using ARExplorer.Data;
using Debug = UnityEngine.Debug;

namespace ARExplorer.Detection
{
    /// <summary>
    /// Main orchestrator: captures Magic Leap camera frames, feeds them
    /// to the classifier, and manages AR markers + detail panel.
    ///
    /// Attach this to an empty GameObject in your scene.
    /// </summary>
    public class ARDetectionManager : MonoBehaviour
    {
        [Header("References")]
        public ImageClassifier classifier;
        public ComponentDatabase componentDatabase;
        public ARMarkerBubble markerBubblePrefab;
        public DetailPanel detailPanel;
        public Transform markerParent;

        [Header("Detection Settings")]
        [Tooltip("Seconds between inference calls.")]
        public float detectionInterval = 0.3f;

        [Tooltip("Seconds before stale markers auto-clear.")]
        public float staleTimeout = 0.8f;

        [Tooltip("Seconds a class must be detected continuously before the detail panel opens.")]
        public float detailShowDelay = 1.0f;

        // ── State ──────────────────────────────────────────────────
        private float _lastDetectTime;
        private float _lastRefreshTime;
        private ARMarkerBubble _activeMarker;
        private string _activeClassKey;
        private ComponentData _activeComponent;
        private float _classFirstSeenTime;
        private bool _detailShown;

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
            Debug.Log("[ARDetection] Start() called.");
            if (classifier == null) { Debug.LogError("[ARDetection] Classifier is NULL - check Inspector!"); return; }
            classifier.OnClassification += HandleClassification;
            detailPanel?.Hide();
            InitMLCamera();
        }

        void Update()
        {
            if (!_cameraReady) return;

            // Apply pending camera frame on main thread
            if (_frameReady)
            {
                byte[] data;
                int w, h;
                lock (this)
                {
                    data = _pendingFrameData;
                    w = _pendingWidth;
                    h = _pendingHeight;
                    _frameReady = false;
                }

                if (_cameraTexture == null || _cameraTexture.width != w || _cameraTexture.height != h)
                    _cameraTexture = new Texture2D(w, h, TextureFormat.RGBA32, false);

                _cameraTexture.LoadRawTextureData(data);
                _cameraTexture.Apply();
            }

            float now = Time.time;

            // Run detection at interval
            if (now - _lastDetectTime > detectionInterval)
            {
                _lastDetectTime = now;
                if (_cameraTexture != null)
                    classifier.Classify(_cameraTexture);
            }

            // Auto-clear stale markers and hide detail panel
            if (_activeMarker != null && now - _lastRefreshTime > staleTimeout)
            {
                detailPanel?.Hide();
                ClearMarker();
            }

            // Auto-show detail panel after stable detection
            if (_activeComponent != null && !_detailShown &&
                now - _classFirstSeenTime >= detailShowDelay)
            {
                detailPanel?.Show(_activeComponent);
                _detailShown = true;
            }
        }

        void OnDestroy()
        {
            classifier.OnClassification -= HandleClassification;
            StopMLCamera();
        }

        // ═══════════════════════════════════════════════════════════
        //  Magic Leap Camera Setup
        // ═══════════════════════════════════════════════════════════

        private async void InitMLCamera()
        {
#if UNITY_EDITOR
            Debug.Log("[ARDetection] Editor mode — ML Camera skipped.");
            return;
#endif
            // Request camera permission
            if (!MLPermissions.CheckPermission(MLPermission.Camera).IsOk)
            {
                Debug.Log("[ARDetection] Requesting camera permission...");
                var permCallbacks = new MLPermissions.Callbacks();
                permCallbacks.OnPermissionGranted += OnPermissionGranted;
                permCallbacks.OnPermissionDenied += OnPermissionDenied;
                MLPermissions.RequestPermission(MLPermission.Camera, permCallbacks);
                return;
            }

            await StartCameraCapture();
        }

        private async void OnPermissionGranted(string permission)
        {
            if (permission == MLPermission.Camera)
                await StartCameraCapture();
        }

        private void OnPermissionDenied(string permission)
        {
            Debug.LogError($"[ARDetection] Camera permission denied: {permission}");
        }

        private async System.Threading.Tasks.Task StartCameraCapture()
        {
            MLCamera.ConnectContext connectContext = MLCamera.ConnectContext.Create();
            connectContext.CamId = MLCamera.Identifier.CV;
            connectContext.Flags = MLCamera.ConnectFlag.CamOnly;

            _mlCamera = await MLCamera.CreateAndConnectAsync(connectContext);
            if (_mlCamera == null)
            {
                Debug.LogError("[ARDetection] Failed to connect ML Camera.");
                return;
            }

            // Configure capture: 640x480 is sufficient for classification
            MLCamera.StreamCapability[] capabilities = MLCamera.GetImageStreamCapabilitiesForCamera(
                _mlCamera, MLCamera.CaptureType.Video
            );

            if (capabilities.Length == 0)
            {
                Debug.LogError("[ARDetection] No camera stream capabilities found.");
                return;
            }

            _captureConfig = new MLCamera.CaptureConfig();
            _captureConfig.CaptureFrameRate = MLCamera.CaptureFrameRate._30FPS;
            _captureConfig.StreamConfigs = new MLCamera.CaptureStreamConfig[1];
            _captureConfig.StreamConfigs[0] = MLCamera.CaptureStreamConfig.Create(
                capabilities[0], MLCamera.OutputFormat.RGBA_8888
            );

            _mlCamera.PrepareCapture(_captureConfig, out MLCamera.Metadata _);
            await _mlCamera.PreCaptureAEAWBAsync();

            _mlCamera.OnRawVideoFrameAvailable += OnCameraFrame;
            await _mlCamera.CaptureVideoStartAsync();

            _cameraReady = true;
            Debug.Log("[ARDetection] ML Camera started.");
        }

        // Called on background thread — copy bytes only, apply on main thread in Update
        private void OnCameraFrame(MLCamera.CameraOutput output, MLCamera.ResultExtras extras,
            MLCamera.Metadata metadata)
        {
            if (output.Planes.Length == 0) return;

            var plane = output.Planes[0];
            int width = (int)plane.Width;
            int height = (int)plane.Height;
            uint stride = plane.Stride > 0 ? plane.Stride : (uint)(width * 4);

            // Copy row by row to strip stride padding
            int rowBytes = width * 4;
            byte[] tightly = new byte[width * height * 4];
            for (int row = 0; row < height; row++)
            {
                int src = (int)(row * stride);
                int dst = row * rowBytes;
                System.Buffer.BlockCopy(plane.Data, src, tightly, dst, rowBytes);
            }

            lock (this)
            {
                _pendingFrameData = tightly;
                _pendingWidth = width;
                _pendingHeight = height;
                _frameReady = true;
            }
        }

        private void StopMLCamera()
        {
            if (_mlCamera != null)
            {
                _mlCamera.OnRawVideoFrameAvailable -= OnCameraFrame;
                _mlCamera.CaptureVideoStop();
                _mlCamera.Disconnect();
                _mlCamera = null;
            }
        }

        // ═══════════════════════════════════════════════════════════
        //  Detection Handling
        // ═══════════════════════════════════════════════════════════

        private void HandleClassification(ImageClassifier.ClassificationResult result)
        {
            if (result.isBackground)
            {
                // Nothing detected — clear after stale timeout (handled in Update)
                return;
            }

            string classKey = result.className.ToLower().Replace(" ", "_");
            if (componentDatabase == null) { Debug.LogError("[ARDetection] componentDatabase is NULL!"); return; }
            ComponentData comp = componentDatabase.Resolve(result.className);

            if (comp == null) return;

            _lastRefreshTime = Time.time;

            // If class changed, destroy old marker and create new one
            if (_activeClassKey != classKey)
            {
                detailPanel?.Hide();
                ClearMarker();
                SpawnMarker(comp);
                _activeClassKey = classKey;
                _activeComponent = comp;
                _classFirstSeenTime = Time.time;
                _detailShown = false;
            }
        }

        // ═══════════════════════════════════════════════════════════
        //  Marker Management
        // ═══════════════════════════════════════════════════════════

        private void SpawnMarker(ComponentData comp)
        {
            if (markerBubblePrefab == null) return;

            // Position marker 1.5m in front of user, centered in view
            Transform cam = Camera.main.transform;
            Vector3 pos = cam.position + cam.forward * 1.5f;

            _activeMarker = Instantiate(markerBubblePrefab, pos, Quaternion.identity, markerParent);
            _activeMarker.Initialize(comp, () => detailPanel?.Show(comp));
        }

        private void ClearMarker()
        {
            if (_activeMarker != null)
            {
                _activeMarker.FadeOutAndDestroy();
                _activeMarker = null;
            }
            _activeClassKey = null;
            _activeComponent = null;
            _detailShown = false;
        }
    }
}
