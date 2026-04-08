using UnityEngine;
using UnityEngine.XR.MagicLeap;
using ARExplorer.Data;

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

        // ── State ──────────────────────────────────────────────────
        private float _lastDetectTime;
        private float _lastRefreshTime;
        private ARMarkerBubble _activeMarker;
        private string _activeClassKey;
        private ComponentData _activeComponent;

        // ── Magic Leap Camera ──────────────────────────────────────
        private MLCamera _mlCamera;
        private MLCamera.CaptureConfig _captureConfig;
        private Texture2D _cameraTexture;
        private bool _cameraReady;

        // ═══════════════════════════════════════════════════════════
        //  Lifecycle
        // ═══════════════════════════════════════════════════════════

        void Start()
        {
            classifier.OnClassification += HandleClassification;
            detailPanel?.Hide();
            InitMLCamera();
        }

        void Update()
        {
            if (!_cameraReady) return;

            float now = Time.time;

            // Run detection at interval
            if (now - _lastDetectTime > detectionInterval)
            {
                _lastDetectTime = now;
                if (_cameraTexture != null)
                    classifier.Classify(_cameraTexture);
            }

            // Auto-clear stale markers
            if (_activeMarker != null && now - _lastRefreshTime > staleTimeout)
            {
                ClearMarker();
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
            // Request camera permission
            if (!MLPermissions.CheckPermission(MLPermission.Camera).IsOk)
            {
                Debug.Log("[ARDetection] Requesting camera permission...");
                MLPermissions.RequestPermission(MLPermission.Camera, OnPermissionGranted, OnPermissionDenied);
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
                _mlCamera, MLCamera.CaptureType.Image
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

            await _mlCamera.PrepareCapture(_captureConfig);
            await _mlCamera.PreCaptureAEAWBAsync();

            _mlCamera.OnRawVideoFrameAvailable += OnCameraFrame;
            await _mlCamera.CaptureVideoStartAsync();

            _cameraReady = true;
            Debug.Log("[ARDetection] ML Camera started.");
        }

        private void OnCameraFrame(MLCamera.CameraOutput output, MLCamera.ResultExtras extras,
            MLCamera.Metadata metadata)
        {
            if (output.Planes.Length == 0) return;

            var plane = output.Planes[0];
            int width = (int)plane.Width;
            int height = (int)plane.Height;

            if (_cameraTexture == null || _cameraTexture.width != width || _cameraTexture.height != height)
            {
                _cameraTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            }

            _cameraTexture.LoadRawTextureData(plane.Data);
            _cameraTexture.Apply();
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
            ComponentData comp = componentDatabase.Resolve(result.className);

            if (comp == null) return;

            _lastRefreshTime = Time.time;

            // If class changed, destroy old marker and create new one
            if (_activeClassKey != classKey)
            {
                ClearMarker();
                SpawnMarker(comp);
                _activeClassKey = classKey;
                _activeComponent = comp;
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
            _activeMarker.Initialize(comp, () => ShowDetail(comp));
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
        }

        private void ShowDetail(ComponentData comp)
        {
            detailPanel?.Show(comp);
        }
    }
}
