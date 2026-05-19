using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ARExplorer.Data;

namespace ARExplorer.Detection
{
    /// <summary>
    /// Self-contained AR info card.
    ///
    /// Collapsed state : small pill floating near the detected object.
    /// Expanded state  : full detail card grows downward from the pill.
    ///
    /// Attach to an empty prefab — builds all UI at runtime. No Inspector
    /// wiring and no child objects required.
    /// </summary>
    public class ARMarkerBubble : MonoBehaviour
    {
        // ── Layout constants (canvas units; 1 unit = 1 mm at scale 0.001) ─
        const int CW      = 220;   // canvas width
        const int PILL_H  = 46;    // collapsed pill height
        const int GAP     = 5;     // gap between pill and card
        const int CARD_H  = 320;   // expanded card height
        const int CH      = PILL_H + GAP + CARD_H;  // total canvas height
        const int PAD     = 10;    // inner padding

        // ── Colour palette ─────────────────────────────────────────────
        static Color BG     => H("#04060d", 0.93f);
        static Color NEON   => H("#50c8ff");
        static Color TEXT   => H("#e2f0ff");
        static Color MUTED  => H("#7da5c7");
        static Color TIP_FG => H("#fbbf24");
        static Color TIP_BG => H("#fbbf24", 0.10f);
        static Color SPECBG => new Color(1f, 1f, 1f, 0.05f);
        static Color BORDER => H("#50c8ff", 0.22f);

        const int MAX_SPECS = 5;

        // ── Runtime state ──────────────────────────────────────────────
        private bool  _expanded;
        private bool  _fadingOut;
        private float _fadeTimer;
        private const float FadeOutDur = 0.22f;

        // canvas-level scale stored so pop-in animation can use it
        private Vector3 _restScale;

        // ── UI references ──────────────────────────────────────────────
        private CanvasGroup     _cg;
        private Image           _accentLine;
        private TextMeshProUGUI _pillIcon, _pillName;

        private GameObject      _card;
        private TextMeshProUGUI _cardTitle, _badgeTMP, _descTMP, _tipTMP;
        private Image           _badgeImg;
        private Transform       _specsHolder;
        private TextMeshProUGUI[] _specLbl = new TextMeshProUGUI[MAX_SPECS];
        private TextMeshProUGUI[] _specVal = new TextMeshProUGUI[MAX_SPECS];
        private GameObject[]      _specRow = new GameObject[MAX_SPECS];

        // ══════════════════════════════════════════════════════════════
        //  Lifecycle
        // ══════════════════════════════════════════════════════════════

        void Awake()
        {
            Build();
            _restScale = transform.localScale;   // captured after Build sets 0.001
            transform.localScale = Vector3.zero; // start hidden for pop-in
        }

        void Update()
        {
            if (_fadingOut)
            {
                _fadeTimer += Time.deltaTime;
                _cg.alpha = Mathf.Lerp(1f, 0f, _fadeTimer / FadeOutDur);
                if (_fadeTimer >= FadeOutDur) Destroy(gameObject);
                return;
            }

            // Billboard: always face the camera
            if (Camera.main != null)
                transform.rotation = Quaternion.LookRotation(
                    transform.position - Camera.main.transform.position);
        }

        // ══════════════════════════════════════════════════════════════
        //  Public API
        // ══════════════════════════════════════════════════════════════

        /// <summary>Set content and play the pop-in animation.</summary>
        public void Initialize(ComponentData comp)
        {
            Populate(comp);
            LeanTween.scale(gameObject, _restScale, 0.28f).setEaseOutBack();
        }

        /// <summary>True while the detail card is open.</summary>
        public bool IsExpanded => _expanded;

        /// <summary>Toggle collapsed ↔ expanded.</summary>
        public void OnSelect()
        {
            if (_expanded) Collapse();
            else           Expand();
        }

        public void FadeOutAndDestroy()
        {
            if (_fadingOut) return;
            _fadingOut = true;
            _fadeTimer = 0f;
            if (_expanded) _card.SetActive(false); // skip collapse anim on cleanup
        }

        // ══════════════════════════════════════════════════════════════
        //  Expand / Collapse
        // ══════════════════════════════════════════════════════════════

        void Expand()
        {
            _expanded = true;
            _card.SetActive(true);
            // Scale from 0 → 1 in card local space, growing from its top pivot
            _card.transform.localScale = Vector3.zero;
            LeanTween.scale(_card, Vector3.one, 0.22f).setEaseOutBack();
        }

        void Collapse()
        {
            _expanded = false;
            LeanTween.scale(_card, Vector3.zero, 0.16f)
                .setEaseInBack()
                .setOnComplete(() => { if (_card) _card.SetActive(false); });
        }

        // ══════════════════════════════════════════════════════════════
        //  Populate
        // ══════════════════════════════════════════════════════════════

        void Populate(ComponentData comp)
        {
            // Pill
            if (_pillIcon)   _pillIcon.text  = comp.icon;
            if (_pillName)   _pillName.text  = comp.displayName;
            if (_accentLine) _accentLine.color = comp.markerColor;

            // Card
            if (_cardTitle) _cardTitle.text  = !string.IsNullOrEmpty(comp.fullName) ? comp.fullName : comp.displayName;
            if (_badgeTMP)  _badgeTMP.text   = comp.badge;
            if (_badgeImg)  _badgeImg.color  = comp.badgeColor;
            if (_descTMP)   _descTMP.text    = comp.description;
            if (_tipTMP)    _tipTMP.text     = comp.proTip;

            int n = comp.specs != null ? Mathf.Min(comp.specs.Length, MAX_SPECS) : 0;
            for (int i = 0; i < MAX_SPECS; i++)
            {
                _specRow[i].SetActive(i < n);
                if (i < n)
                {
                    _specLbl[i].text = comp.specs[i].label;
                    _specVal[i].text = comp.specs[i].value;
                }
            }
        }

        // ══════════════════════════════════════════════════════════════
        //  Builder
        // ══════════════════════════════════════════════════════════════

        void Build()
        {
            // ── World-space canvas ─────────────────────────────────────
            var canvas      = gameObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            // TrackedDeviceGraphicRaycaster is required for XR ray-cast interaction
            // (Magic Leap 2 controller / hand rays via XRUIInputModule).
            gameObject.AddComponent<UnityEngine.XR.Interaction.Toolkit.UI.TrackedDeviceGraphicRaycaster>();
            _cg = gameObject.AddComponent<CanvasGroup>();

            var canvasRT      = GetComponent<RectTransform>();
            canvasRT.sizeDelta = new Vector2(CW, CH);
            // Pivot at top-centre: the canvas "anchor" point floats at object position,
            // pill hangs from there, card grows downward.
            canvasRT.pivot    = new Vector2(0.5f, 1f);
            transform.localScale = Vector3.one * 0.001f;

            BuildPill();
            _card = BuildCard();
            _card.SetActive(false);
        }

        // ── Pill ──────────────────────────────────────────────────────

        void BuildPill()
        {
            var pill   = GO("Pill", transform);
            var pillRT = pill.AddComponent<RectTransform>();
            // Anchor to top, full width
            pillRT.anchorMin        = new Vector2(0, 1);
            pillRT.anchorMax        = new Vector2(1, 1);
            pillRT.pivot            = new Vector2(0.5f, 1f);
            pillRT.anchoredPosition = Vector2.zero;
            pillRT.sizeDelta        = new Vector2(0, PILL_H);

            // Border (behind BG)
            var border   = GO("Border", pill.transform);
            var brt      = Stretch(border, pill.transform);
            brt.offsetMin = new Vector2(-1, -1);
            brt.offsetMax = new Vector2(1, 1);
            border.AddComponent<Image>().color = BORDER;
            border.transform.SetAsFirstSibling();

            // BG
            var bg = GO("BG", pill.transform);
            Stretch(bg, pill.transform);
            bg.AddComponent<Image>().color = BG;

            // Left accent line (4 px, component colour)
            var acc   = GO("Accent", pill.transform);
            var art   = acc.AddComponent<RectTransform>();
            art.anchorMin        = new Vector2(0, 0);
            art.anchorMax        = new Vector2(0, 1);
            art.pivot            = new Vector2(0, 0.5f);
            art.offsetMin        = Vector2.zero;
            art.offsetMax        = new Vector2(4, 0);
            _accentLine          = acc.AddComponent<Image>();
            _accentLine.color    = NEON;

            // Icon
            _pillIcon = Label("Icon", pill.transform, 17, TEXT, TextAlignmentOptions.MidlineLeft);
            _pillIcon.enableWordWrapping = false;
            var iRT = _pillIcon.GetComponent<RectTransform>();
            iRT.anchorMin        = new Vector2(0, 0);
            iRT.anchorMax        = new Vector2(0, 1);
            iRT.pivot            = new Vector2(0, 0.5f);
            iRT.anchoredPosition = new Vector2(9, 0);
            iRT.sizeDelta        = new Vector2(26, 0);

            // Name
            _pillName = Label("Name", pill.transform, 13, TEXT, TextAlignmentOptions.MidlineLeft);
            _pillName.enableWordWrapping = false;
            var nRT = _pillName.GetComponent<RectTransform>();
            nRT.anchorMin = new Vector2(0, 0);
            nRT.anchorMax = new Vector2(1, 1);
            nRT.offsetMin = new Vector2(39, 0);
            nRT.offsetMax = new Vector2(-24, 0);

            // Expand hint ▼
            var hint = Label("Hint", pill.transform, 9, MUTED, TextAlignmentOptions.MidlineRight);
            hint.text            = "▼";
            hint.enableWordWrapping = false;
            var hRT = hint.GetComponent<RectTransform>();
            hRT.anchorMin        = new Vector2(1, 0);
            hRT.anchorMax        = new Vector2(1, 1);
            hRT.pivot            = new Vector2(1, 0.5f);
            hRT.anchoredPosition = new Vector2(-7, 0);
            hRT.sizeDelta        = new Vector2(18, 0);

            // Clickable button on the whole pill
            var btn  = pill.AddComponent<Button>();
            var cols = btn.colors;
            cols.highlightedColor = new Color(0.314f, 0.784f, 1f, 0.08f);
            cols.pressedColor     = new Color(0.314f, 0.784f, 1f, 0.18f);
            btn.colors = cols;
            btn.onClick.AddListener(OnSelect);
        }

        // ── Card ──────────────────────────────────────────────────────

        GameObject BuildCard()
        {
            var card   = GO("Card", transform);
            var cardRT = card.AddComponent<RectTransform>();
            // Anchored below the pill
            cardRT.anchorMin        = new Vector2(0, 1);
            cardRT.anchorMax        = new Vector2(1, 1);
            cardRT.pivot            = new Vector2(0.5f, 1f); // top-pivot → grows downward
            cardRT.anchoredPosition = new Vector2(0, -(PILL_H + GAP));
            cardRT.sizeDelta        = new Vector2(0, CARD_H);

            // Border
            var border = GO("Border", card.transform);
            var brt    = Stretch(border, card.transform);
            brt.offsetMin = new Vector2(-1, -1);
            brt.offsetMax = new Vector2(1, 1);
            border.AddComponent<Image>().color = BORDER;
            border.transform.SetAsFirstSibling();

            // BG
            var bg = GO("BG", card.transform);
            Stretch(bg, card.transform);
            bg.AddComponent<Image>().color = BG;

            // Close button (top-right)
            BuildCloseButton(card.transform);

            // Scrollable content
            var sr      = BuildScrollView(card.transform);
            var content = sr.content.gameObject;

            // Badge pill
            var badgeRow = GO("BadgeRow", content.transform);
            badgeRow.AddComponent<RectTransform>();
            var brHLG = badgeRow.AddComponent<HorizontalLayoutGroup>();
            brHLG.childAlignment     = TextAnchor.MiddleCenter;
            brHLG.childControlWidth  = false;
            brHLG.childControlHeight = false;
            badgeRow.AddComponent<LayoutElement>().preferredHeight = 24;

            var badgePill   = GO("Badge", badgeRow.transform);
            var bpRT        = badgePill.AddComponent<RectTransform>();
            bpRT.sizeDelta  = new Vector2(110, 21);
            _badgeImg       = badgePill.AddComponent<Image>();
            var bpHLG       = badgePill.AddComponent<HorizontalLayoutGroup>();
            bpHLG.padding   = new RectOffset(10, 10, 3, 3);
            bpHLG.childAlignment = TextAnchor.MiddleCenter;
            bpHLG.childControlWidth = true;
            bpHLG.childForceExpandWidth = true;
            _badgeTMP       = Label("T", badgePill.transform, 9, Color.white, TextAlignmentOptions.Center);
            _badgeTMP.fontStyle = FontStyles.Bold;
            _badgeTMP.enableWordWrapping = false;

            // Title
            _cardTitle = Label("Title", content.transform, 16, TEXT, TextAlignmentOptions.Center);
            _cardTitle.enableWordWrapping = true;
            CSF(_cardTitle.gameObject);
            _cardTitle.gameObject.AddComponent<LayoutElement>().minHeight = 20;

            // Divider
            var div = GO("Div", content.transform);
            div.AddComponent<Image>().color = BORDER;
            div.AddComponent<LayoutElement>().preferredHeight = 1;
            div.AddComponent<RectTransform>();

            // Description
            _descTMP = Label("Desc", content.transform, 12, MUTED, TextAlignmentOptions.Left);
            _descTMP.enableWordWrapping = true;
            CSF(_descTMP.gameObject);
            _descTMP.gameObject.AddComponent<LayoutElement>().minHeight = 14;

            // Specs container
            var specsGO = GO("Specs", content.transform);
            specsGO.AddComponent<RectTransform>();
            var sVLG = specsGO.AddComponent<VerticalLayoutGroup>();
            sVLG.spacing            = 4;
            sVLG.childControlWidth  = true;
            sVLG.childControlHeight = false;
            sVLG.childForceExpandWidth = true;
            specsGO.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            specsGO.AddComponent<LayoutElement>().minHeight = 0;
            _specsHolder = specsGO.transform;
            for (int i = 0; i < MAX_SPECS; i++) BuildSpecRow(i);

            // Tip box
            var tip    = GO("Tip", content.transform);
            tip.AddComponent<RectTransform>();
            tip.AddComponent<Image>().color = TIP_BG;
            var tipVLG = tip.AddComponent<VerticalLayoutGroup>();
            tipVLG.padding = new RectOffset(10, 10, 8, 8);
            tipVLG.childControlWidth = true;
            tipVLG.childForceExpandWidth = true;
            tipVLG.childControlHeight = false;
            tip.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            tip.AddComponent<LayoutElement>().minHeight = 0;
            _tipTMP = Label("T", tip.transform, 11, TIP_FG, TextAlignmentOptions.Left);
            _tipTMP.enableWordWrapping = true;
            CSF(_tipTMP.gameObject);

            return card;
        }

        void BuildCloseButton(Transform parent)
        {
            var go  = GO("CloseBtn", parent);
            var rt  = go.AddComponent<RectTransform>();
            rt.anchorMin        = rt.anchorMax = new Vector2(1, 1);
            rt.pivot            = new Vector2(1, 1);
            rt.anchoredPosition = new Vector2(-5, -5);
            rt.sizeDelta        = new Vector2(28, 28);
            go.AddComponent<Image>().color = new Color(1, 1, 1, 0.07f);
            var btn = go.AddComponent<Button>();
            btn.onClick.AddListener(Collapse);
            var lbl  = Label("X", go.transform, 13, MUTED, TextAlignmentOptions.Center);
            lbl.text = "✕";
            var lRT  = lbl.GetComponent<RectTransform>();
            lRT.anchorMin = Vector2.zero;
            lRT.anchorMax = Vector2.one;
            lRT.offsetMin = lRT.offsetMax = Vector2.zero;
        }

        ScrollRect BuildScrollView(Transform parent)
        {
            var sv   = GO("Scroll", parent);
            var svRT = sv.AddComponent<RectTransform>();
            svRT.anchorMin = Vector2.zero;
            svRT.anchorMax = Vector2.one;
            svRT.offsetMin = new Vector2(PAD, PAD);
            svRT.offsetMax = new Vector2(-PAD, -40); // leave room for close btn

            var sr          = sv.AddComponent<ScrollRect>();
            sr.horizontal   = false;
            sr.scrollSensitivity = 30;

            var vp   = GO("Viewport", sv.transform);
            var vpRT = vp.AddComponent<RectTransform>();
            vpRT.anchorMin = Vector2.zero;
            vpRT.anchorMax = Vector2.one;
            vpRT.offsetMin = vpRT.offsetMax = Vector2.zero;
            vp.AddComponent<Image>().color = Color.clear;
            vp.AddComponent<Mask>().showMaskGraphic = false;

            var ct   = GO("Content", vp.transform);
            var ctRT = ct.AddComponent<RectTransform>();
            ctRT.anchorMin = new Vector2(0, 1);
            ctRT.anchorMax = new Vector2(1, 1);
            ctRT.pivot     = new Vector2(0.5f, 1f);
            ctRT.offsetMin = ctRT.offsetMax = Vector2.zero;
            var vlg = ct.AddComponent<VerticalLayoutGroup>();
            vlg.spacing            = 8;
            vlg.padding            = new RectOffset(0, 0, 6, 14);
            vlg.childControlWidth  = true;
            vlg.childControlHeight = false;
            vlg.childForceExpandWidth  = true;
            vlg.childForceExpandHeight = false;
            ct.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            sr.viewport = vpRT;
            sr.content  = ctRT;
            return sr;
        }

        void BuildSpecRow(int i)
        {
            var row   = GO($"S{i}", _specsHolder);
            var rowRT = row.AddComponent<RectTransform>();
            rowRT.sizeDelta = new Vector2(0, 30);
            row.AddComponent<Image>().color = SPECBG;
            var hlg = row.AddComponent<HorizontalLayoutGroup>();
            hlg.padding            = new RectOffset(9, 9, 6, 6);
            hlg.childControlWidth  = false;
            hlg.childControlHeight = true;
            hlg.childForceExpandWidth  = false;
            hlg.childForceExpandHeight = true;

            _specLbl[i] = Label("L", row.transform, 11, MUTED, TextAlignmentOptions.MidlineLeft);
            _specLbl[i].enableWordWrapping = false;
            _specLbl[i].gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;

            _specVal[i] = Label("V", row.transform, 11, NEON, TextAlignmentOptions.MidlineRight);
            _specVal[i].enableWordWrapping = false;
            _specVal[i].gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;

            _specRow[i] = row;
        }

        // ── Helpers ────────────────────────────────────────────────────

        static GameObject GO(string name, Transform parent)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            return go;
        }

        static RectTransform Stretch(GameObject go, Transform parent)
        {
            var rt        = go.GetComponent<RectTransform>() ?? go.AddComponent<RectTransform>();
            rt.anchorMin  = Vector2.zero;
            rt.anchorMax  = Vector2.one;
            rt.offsetMin  = rt.offsetMax = Vector2.zero;
            return rt;
        }

        static TextMeshProUGUI Label(string name, Transform parent, float size, Color col, TextAlignmentOptions align)
        {
            var go = GO(name, parent);
            go.AddComponent<RectTransform>();
            var t       = go.AddComponent<TextMeshProUGUI>();
            t.fontSize  = size;
            t.color     = col;
            t.alignment = align;
            return t;
        }

        static void CSF(GameObject go) =>
            go.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        static Color H(string hex, float a = 1f)
        {
            ColorUtility.TryParseHtmlString(hex, out Color c);
            c.a = a;
            return c;
        }
    }
}
