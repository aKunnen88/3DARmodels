using UnityEngine;
using UnityEngine.XR.MagicLeap;
using TMPro;

/// <summary>
/// MagicLeapUIController — handles the Magic Leap 2 specific UI behaviour:
///   • World-locks the sensor panel 1.2m in front of the user's gaze
///   • Allows the Controller trigger to "grab" and reposition the panel
///   • Dims the panel when the user looks away (eye-tracking)
///
/// SETUP:
///   1. Attach to the root of your Canvas / World-Space panel.
///   2. For Editor testing: the panel stays static; press Play to simulate.
///   3. On Magic Leap: ensure MLPermissions includes EyeTracking and Controller.
/// </summary>
[RequireComponent(typeof(Canvas))]
public class MagicLeapUIController : MonoBehaviour
{
    [Header("Panel Behaviour")]
    [Tooltip("Distance (m) in front of the headset where the panel floats")]
    public float PanelDistance   = 1.2f;
    [Tooltip("How fast the panel smoothly follows when grabbed")]
    public float FollowSpeed     = 5f;
    [Tooltip("Dim the panel opacity when not looking at it")]
    public bool  DimWhenNotGazed = true;
    [Range(0.1f, 1f)] public float DimAlpha   = 0.25f;
    [Range(0.1f, 1f)] public float NormalAlpha = 0.9f;

    [Header("Runtime Info (read-only)")]
    [SerializeField] private bool  _isGrabbed   = false;
    [SerializeField] private float _currentAlpha = 1f;

    private Camera       _mainCamera;
    private CanvasGroup  _canvasGroup;
    private MLInput.Controller _controller;

    // ═══════════════════════════════════════════════════════════════════════
    void Start()
    {
        _mainCamera  = Camera.main;
        _canvasGroup = GetComponent<CanvasGroup>();
        if (_canvasGroup == null) _canvasGroup = gameObject.AddComponent<CanvasGroup>();

#if UNITY_ANDROID && !UNITY_EDITOR
        // Request Magic Leap permissions at runtime
        MLPermissions.RequestPermission(MLPermission.EyeTracking, new MLPermissions.Callbacks());

        if (MLInput.IsStarted)
        {
            _controller = MLInput.GetController(MLInput.Hand.Left);
            MLInput.OnControllerButtonDown += OnButtonDown;
        }
#endif
        // Position panel in front of camera at start
        SnapInFront();
    }

    void Update()
    {
#if UNITY_ANDROID && !UNITY_EDITOR
        if (_isGrabbed && _controller != null)
        {
            // Follow controller position while grabbed
            Vector3 target = _controller.Position +
                             _controller.Orientation * Vector3.forward * PanelDistance;
            transform.position = Vector3.Lerp(transform.position, target, FollowSpeed * Time.deltaTime);
            transform.LookAt(_mainCamera.transform);
            transform.Rotate(0, 180, 0);
        }

        // Eye-tracking: dim when gaze is away
        if (DimWhenNotGazed && MLEyes.IsStarted)
        {
            bool gazing = IsUserGazingAtPanel();
            float targetAlpha = gazing ? NormalAlpha : DimAlpha;
            _currentAlpha = Mathf.Lerp(_currentAlpha, targetAlpha, 4f * Time.deltaTime);
            _canvasGroup.alpha = _currentAlpha;
        }
#else
        // In Editor: always keep full opacity
        _canvasGroup.alpha = NormalAlpha;
#endif
    }

    // ── Snap panel 1.2m ahead of the camera ────────────────────────────────
    public void SnapInFront()
    {
        Transform cam = _mainCamera ? _mainCamera.transform : Camera.main.transform;
        transform.position = cam.position + cam.forward * PanelDistance;
        transform.LookAt(cam);
        transform.Rotate(0, 180, 0);
    }

#if UNITY_ANDROID && !UNITY_EDITOR
    private void OnButtonDown(byte controllerId, MLInput.Controller.Button button)
    {
        if (button == MLInput.Controller.Button.HomeTap)
        {
            _isGrabbed = !_isGrabbed;
            Debug.Log($"[MagicLeapUI] Panel grab {(_isGrabbed ? "ON" : "OFF")}");
        }
    }

    private bool IsUserGazingAtPanel()
    {
        if (!MLEyes.IsStarted) return true;
        // Check if the gaze ray hits anything within a reasonable angle of the panel
        Ray gazeRay = new Ray(MLEyes.FixationPoint, _mainCamera.transform.forward);
        Plane panelPlane = new Plane(-transform.forward, transform.position);
        float dist;
        if (panelPlane.Raycast(gazeRay, out dist))
        {
            Vector3 hitPoint = gazeRay.GetPoint(dist);
            float   angle    = Vector3.Angle(transform.position - _mainCamera.transform.position,
                                             hitPoint - _mainCamera.transform.position);
            return angle < 15f;
        }
        return false;
    }

    void OnDestroy()
    {
        if (MLInput.IsStarted) MLInput.OnControllerButtonDown -= OnButtonDown;
    }
#endif
}
