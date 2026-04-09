using UnityEngine;
using TMPro;
using ARExplorer.Data;

namespace ARExplorer.Detection
{
    /// <summary>
    /// Head-locked detail panel for Magic Leap 2.
    /// Auto-positions in front of the user when shown.
    /// No tap required — shows automatically on detection.
    /// </summary>
    public class DetailPanel : MonoBehaviour
    {
        [Header("UI References")]
        public TextMeshProUGUI iconText;
        public TextMeshProUGUI titleText;
        public TextMeshProUGUI badgeText;
        public UnityEngine.UI.Image badgeBackground;
        public TextMeshProUGUI descriptionText;
        public TextMeshProUGUI tipText;
        public Transform specsContainer;
        public GameObject specRowPrefab;
        public UnityEngine.UI.Button closeButton;

        [Header("Panel Root")]
        public CanvasGroup canvasGroup;
        public GameObject panelRoot;

        [Header("Head-lock Settings")]
        [Tooltip("Distance from the camera to place the panel.")]
        public float viewDistance = 0.8f;
        [Tooltip("How far below center (in meters) to offset the panel.")]
        public float verticalOffset = -0.05f;
        [Tooltip("Smooth follow speed for head-locking.")]
        public float followSpeed = 3f;
        [Tooltip("Angular deadzone — panel only moves when camera rotates beyond this many degrees.")]
        public float angleTolerance = 15f;

        [Header("Animation")]
        public float fadeInDuration = 0.25f;
        public float fadeOutDuration = 0.2f;

        private bool _visible;
        private bool _headLocking;

        void Start()
        {
            if (closeButton != null)
                closeButton.onClick.AddListener(Hide);

            if (panelRoot != null) panelRoot.SetActive(false);
        }

        void Update()
        {
            if (!_visible || !_headLocking) return;

            Camera cam = Camera.main;
            if (cam == null) return;

            Transform ct = cam.transform;

            // Target position: in front of camera, slightly below center
            Vector3 targetPos = ct.position
                + ct.forward * viewDistance
                + Vector3.up * verticalOffset;

            // Only reposition if we've rotated enough (deadzone to reduce jitter)
            float angle = Vector3.Angle(
                transform.position - ct.position,
                ct.forward
            );

            if (angle > angleTolerance)
            {
                transform.position = Vector3.Lerp(
                    transform.position, targetPos,
                    Time.deltaTime * followSpeed
                );
            }

            // Always face the camera
            transform.rotation = Quaternion.Lerp(
                transform.rotation,
                Quaternion.LookRotation(transform.position - ct.position),
                Time.deltaTime * followSpeed
            );
        }

        /// <summary>
        /// Show the detail panel with the given component's data.
        /// Automatically snaps to front of camera.
        /// </summary>
        public void Show(ComponentData comp)
        {
            if (comp == null) return;

            // Populate text fields
            if (iconText)        iconText.text        = comp.icon;
            if (titleText)       titleText.text       = comp.fullName;
            if (badgeText)       badgeText.text       = comp.badge;
            if (badgeBackground) badgeBackground.color = comp.badgeColor;
            if (descriptionText) descriptionText.text = comp.description;
            if (tipText)         tipText.text         = comp.proTip;

            PopulateSpecs(comp.specs);

            // Snap to camera before showing so it doesn't fly in from nowhere
            SnapToCamera();

            if (panelRoot != null) panelRoot.SetActive(true);

            if (canvasGroup != null)
            {
                canvasGroup.alpha = 0f;
                LeanTween.alphaCanvas(canvasGroup, 1f, fadeInDuration);
            }

            _visible = true;
            _headLocking = true;
        }

        /// <summary>
        /// Hide the detail panel.
        /// </summary>
        public void Hide()
        {
            if (!_visible) return;
            _visible = false;
            _headLocking = false;

            if (canvasGroup != null)
            {
                LeanTween.alphaCanvas(canvasGroup, 0f, fadeOutDuration).setOnComplete(() =>
                {
                    if (panelRoot != null) panelRoot.SetActive(false);
                });
            }
            else
            {
                if (panelRoot != null) panelRoot.SetActive(false);
            }
        }

        // ── Internal ──────────────────────────────────────────────

        private void SnapToCamera()
        {
            Camera cam = Camera.main;
            if (cam == null) return;

            transform.position = cam.transform.position
                + cam.transform.forward * viewDistance
                + Vector3.up * verticalOffset;

            transform.rotation = Quaternion.LookRotation(
                transform.position - cam.transform.position
            );
        }

        private void PopulateSpecs(SpecEntry[] specs)
        {
            if (specsContainer == null) return;

            foreach (Transform child in specsContainer)
                Destroy(child.gameObject);

            if (specs == null) return;

            foreach (var spec in specs)
            {
                if (specRowPrefab == null) continue;

                var row = Instantiate(specRowPrefab, specsContainer);
                var texts = row.GetComponentsInChildren<TextMeshProUGUI>();
                if (texts.Length >= 2)
                {
                    texts[0].text = spec.label;
                    texts[1].text = spec.value;
                }
            }
        }
    }
}
