using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ARExplorer.Data;

namespace ARExplorer.Detection
{
    /// <summary>
    /// World-space AR marker bubble that floats near the detected object.
    /// Mirrors the web version's marker-ring + marker-dot + marker-label.
    /// 
    /// Prefab structure:
    ///   ARMarkerBubble (this script)
    ///   ├── Ring (SpriteRenderer or UI Image, pulsing animation)
    ///   ├── Dot (SpriteRenderer with icon text)
    ///   └── Label (TextMeshPro background panel)
    /// </summary>
    public class ARMarkerBubble : MonoBehaviour
    {
        [Header("UI References")]
        public SpriteRenderer ringRenderer;
        public SpriteRenderer dotRenderer;
        public TextMeshPro iconText;
        public TextMeshPro labelText;
        public SpriteRenderer labelBackground;

        [Header("Animation")]
        public float pulseSpeed = 2f;
        public float pulseScale = 0.15f;
        public float fadeOutDuration = 0.3f;
        public float billboardSmoothing = 5f;

        private System.Action _onTap;
        private bool _fadingOut;
        private float _fadeTimer;
        private Vector3 _initialScale;

        void Awake()
        {
            _initialScale = transform.localScale;
            // Start with scale 0 for spawn animation
            transform.localScale = Vector3.zero;
        }

        /// <summary>
        /// Initialize the marker with component data and a tap callback.
        /// </summary>
        public void Initialize(ComponentData comp, System.Action onTap)
        {
            _onTap = onTap;

            // Colors
            if (ringRenderer) ringRenderer.color = comp.markerColor;
            if (dotRenderer) dotRenderer.color = comp.markerColor;

            // Icon & label
            if (iconText) iconText.text = comp.icon;
            if (labelText) labelText.text = comp.displayName;

            if (labelBackground)
            {
                Color bgColor = comp.markerColor;
                bgColor.a = 0.85f;
                labelBackground.color = bgColor;
            }

            // Spawn animation
            LeanTween.scale(gameObject, _initialScale, 0.35f).setEaseOutBack();
        }

        void Update()
        {
            if (_fadingOut)
            {
                _fadeTimer += Time.deltaTime;
                float t = _fadeTimer / fadeOutDuration;
                transform.localScale = Vector3.Lerp(_initialScale, Vector3.zero, t);
                if (t >= 1f)
                    Destroy(gameObject);
                return;
            }

            // Billboard: always face the camera
            if (Camera.main != null)
            {
                Quaternion targetRot = Quaternion.LookRotation(
                    transform.position - Camera.main.transform.position
                );
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot,
                    Time.deltaTime * billboardSmoothing);
            }

            // Pulse ring animation
            if (ringRenderer)
            {
                float pulse = 1f + Mathf.Sin(Time.time * pulseSpeed) * pulseScale;
                ringRenderer.transform.localScale = Vector3.one * pulse;
            }
        }

        /// <summary>
        /// Called by Magic Leap controller raycast or gaze input.
        /// Hook this up to XR Interaction Toolkit's XRSimpleInteractable.
        /// </summary>
        public void OnSelect()
        {
            _onTap?.Invoke();

            // Optional haptic feedback (MLDevice removed in current ML SDK)
        }

        public void FadeOutAndDestroy()
        {
            if (_fadingOut) return;
            _fadingOut = true;
            _fadeTimer = 0f;
        }
    }
}

