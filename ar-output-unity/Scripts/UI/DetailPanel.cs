using UnityEngine;
using TMPro;
using ARExplorer.Data;

namespace ARExplorer.Detection
{
    /// <summary>
    /// Full-screen detail panel that appears when the user taps/selects
    /// an AR marker bubble. Mirrors the web version's #detail-panel.
    /// 
    /// This should be on a World-Space Canvas or head-locked UI Canvas
    /// positioned in front of the user.
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

        [Header("Animation")]
        public float fadeInDuration = 0.25f;
        public float fadeOutDuration = 0.2f;

        private bool _visible;

        void Start()
        {
            if (closeButton != null)
                closeButton.onClick.AddListener(Hide);

            panelRoot?.SetActive(false);
        }

        /// <summary>
        /// Show the detail panel with the given component's data.
        /// </summary>
        public void Show(ComponentData comp)
        {
            if (comp == null) return;

            // Populate fields
            if (iconText) iconText.text = comp.icon;
            if (titleText) titleText.text = comp.fullName;
            if (badgeText) badgeText.text = comp.badge;
            if (badgeBackground) badgeBackground.color = comp.badgeColor;
            if (descriptionText) descriptionText.text = comp.description;
            if (tipText) tipText.text = comp.proTip;

            // Populate specs
            PopulateSpecs(comp.specs);

            // Show with fade-in
            panelRoot?.SetActive(true);
            if (canvasGroup != null)
            {
                canvasGroup.alpha = 0f;
                LeanTween.alphaCanvas(canvasGroup, 1f, fadeInDuration);
            }

            _visible = true;
        }

        /// <summary>
        /// Hide the detail panel.
        /// </summary>
        public void Hide()
        {
            if (!_visible) return;

            if (canvasGroup != null)
            {
                LeanTween.alphaCanvas(canvasGroup, 0f, fadeOutDuration).setOnComplete(() =>
                {
                    panelRoot?.SetActive(false);
                });
            }
            else
            {
                panelRoot?.SetActive(false);
            }

            _visible = false;
        }

        private void PopulateSpecs(SpecEntry[] specs)
        {
            if (specsContainer == null) return;

            // Clear existing rows
            foreach (Transform child in specsContainer)
                Destroy(child.gameObject);

            if (specs == null) return;

            foreach (var spec in specs)
            {
                if (specRowPrefab == null) continue;

                var row = Instantiate(specRowPrefab, specsContainer);
                var texts = row.GetComponentsInChildren<TextMeshProUGUI>();

                // Expect 2 TMP texts: [0] = label, [1] = value
                if (texts.Length >= 2)
                {
                    texts[0].text = spec.label;
                    texts[1].text = spec.value;
                }
            }
        }
    }
}
