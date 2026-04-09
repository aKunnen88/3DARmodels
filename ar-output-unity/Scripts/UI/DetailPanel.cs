using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ARExplorer.Data;

namespace ARExplorer.Detection
{
    /// <summary>
    /// Self-building world-space detail panel for Magic Leap 2.
    /// Attach to any empty GameObject — no prefab or Inspector wiring needed.
    /// Builds its own Canvas and all UI elements at runtime.
    /// Matches the web AR Explorer dark sci-fi design.
    /// </summary>
    public class DetailPanel : MonoBehaviour
    {
        [Header("Positioning")]
        public float viewDistance   = 0.8f;
        public float verticalOffset = -0.05f;
        public float followSpeed    = 3f;
        public float angleTolerance = 15f;

        [Header("Panel size (metres)")]
        public float panelWidth  = 0.38f;
        public float panelHeight = 0.52f;

        [Header("Animation")]
        public float fadeInDuration  = 0.25f;
        public float fadeOutDuration = 0.2f;

        // ── Colours (matching web --css-vars) ─────────────────────────
        static Color BG         => H("#04060d", 0.96f);
        static Color NEON       => H("#50c8ff");
        static Color TEXT       => H("#e2f0ff");
        static Color MUTED      => H("#7da5c7");
        static Color TIP_FG     => H("#fbbf24");
        static Color TIP_BG     => H("#fbbf24", 0.10f);
        static Color SPEC_BG    => new Color(1f, 1f, 1f, 0.05f);
        static Color BORDER     => H("#50c8ff", 0.18f);
        static Color CLOSE_BG   => new Color(1f, 1f, 1f, 0.07f);

        // ── Runtime refs ───────────────────────────────────────────────
        private CanvasGroup     _cg;
        private GameObject      _root;
        private TextMeshProUGUI _iconTMP, _titleTMP, _badgeTMP, _descTMP, _tipTMP;
        private Image           _badgeImg;
        private Transform       _specsHolder;

        private const int MAX_SPECS = 5;
        private TextMeshProUGUI[] _specLbl = new TextMeshProUGUI[MAX_SPECS];
        private TextMeshProUGUI[] _specVal = new TextMeshProUGUI[MAX_SPECS];
        private GameObject[]      _specRow = new GameObject[MAX_SPECS];

        private bool _visible;
        private bool _locking;

        // canvas-space: 1 unit = 0.001 m
        int CW => Mathf.RoundToInt(panelWidth  * 1000f);
        int CH => Mathf.RoundToInt(panelHeight * 1000f);
        const int PAD = 22;

        // ══════════════════════════════════════════════════════════════
        //  Lifecycle
        // ══════════════════════════════════════════════════════════════

        void Awake()
        {
            Build();
        }

        void Update()
        {
            if (!_locking) return;
            Camera cam = Camera.main;
            if (cam == null) return;
            Transform ct = cam.transform;

            Vector3 target = ct.position + ct.forward * viewDistance + Vector3.up * verticalOffset;
            if (Vector3.Angle(transform.position - ct.position, ct.forward) > angleTolerance)
                transform.position = Vector3.Lerp(transform.position, target, Time.deltaTime * followSpeed);

            transform.rotation = Quaternion.Lerp(transform.rotation,
                Quaternion.LookRotation(transform.position - ct.position),
                Time.deltaTime * followSpeed);
        }

        // ══════════════════════════════════════════════════════════════
        //  Public API
        // ══════════════════════════════════════════════════════════════

        public void Show(ComponentData comp)
        {
            if (comp == null) return;
            Populate(comp);
            Snap();
            _root.SetActive(true);
            _cg.alpha = 0f;
            LeanTween.alphaCanvas(_cg, 1f, fadeInDuration);
            _visible = _locking = true;
        }

        public void Hide()
        {
            if (!_visible) return;
            _visible = _locking = false;
            LeanTween.alphaCanvas(_cg, 0f, fadeOutDuration)
                .setOnComplete(() => _root.SetActive(false));
        }

        // ══════════════════════════════════════════════════════════════
        //  Populate
        // ══════════════════════════════════════════════════════════════

        void Populate(ComponentData comp)
        {
            _iconTMP.text  = comp.icon;
            _titleTMP.text = comp.fullName;
            _badgeTMP.text = comp.badge;
            _badgeImg.color = comp.badgeColor;
            _descTMP.text  = comp.description;
            _tipTMP.text   = comp.proTip;

            int n = comp.specs != null ? Mathf.Min(comp.specs.Length, MAX_SPECS) : 0;
            for (int i = 0; i < MAX_SPECS; i++)
            {
                bool show = i < n;
                _specRow[i].SetActive(show);
                if (show) { _specLbl[i].text = comp.specs[i].label; _specVal[i].text = comp.specs[i].value; }
            }
        }

        void Snap()
        {
            Camera cam = Camera.main;
            if (cam == null) return;
            Transform ct = cam.transform;
            transform.position = ct.position + ct.forward * viewDistance + Vector3.up * verticalOffset;
            transform.rotation = Quaternion.LookRotation(transform.position - ct.position);
        }

        // ══════════════════════════════════════════════════════════════
        //  Builder
        // ══════════════════════════════════════════════════════════════

        void Build()
        {
            // ── World-space canvas ─────────────────────────────────────
            var canvas = gameObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            gameObject.AddComponent<CanvasScaler>().dynamicPixelsPerUnit = 1;
            gameObject.AddComponent<GraphicRaycaster>();

            var canvasRT = GetComponent<RectTransform>();
            canvasRT.sizeDelta = new Vector2(CW, CH);
            transform.localScale = Vector3.one * 0.001f;

            // ── Root (fade handle) ─────────────────────────────────────
            _root = Obj("PanelRoot", transform);
            Fill(_root, transform);
            _cg = _root.AddComponent<CanvasGroup>();

            // ── Dark background ────────────────────────────────────────
            var bg = Obj("BG", _root.transform);
            Fill(bg, _root.transform);
            bg.AddComponent<Image>().color = BG;

            // ── Border: thin overlay image with border-only tint ───────
            // (Unity doesn't have border-radius, so we use a slightly smaller
            //  white outline image behind the content area)
            var borderLine = Obj("Border", _root.transform);
            var brt = Fill(borderLine, _root.transform);
            brt.offsetMin = new Vector2(1, 1);
            brt.offsetMax = new Vector2(-1, -1);
            var borderImg = borderLine.AddComponent<Image>();
            borderImg.color = BORDER;

            // Solid BG on top of border line
            var bgTop = Obj("BGSolid", _root.transform);
            var bgTopRT = Fill(bgTop, _root.transform);
            bgTopRT.offsetMin = new Vector2(2, 2);
            bgTopRT.offsetMax = new Vector2(-2, -2);
            bgTop.AddComponent<Image>().color = BG;

            // ── Close button (top-right, absolute) ─────────────────────
            BuildCloseButton(bgTop.transform);

            // ── Scrollable content area ────────────────────────────────
            var scrollRT = BuildScrollArea(bgTop.transform);

            // ── Content: vertical stack ────────────────────────────────
            var content = scrollRT.content.gameObject;

            // Icon
            _iconTMP = TMP("Icon", content.transform, 60, NEON, TextAlignmentOptions.Center);
            _iconTMP.enableWordWrapping = false;
            AddLE(_iconTMP.gameObject, prefH: 70);

            // Badge row
            var badgeRow = Obj("BadgeRow", content.transform);
            AddLE(badgeRow, prefH: 28);
            var badgeRowRT = badgeRow.AddComponent<RectTransform>();
            var badgeRowHlg = badgeRow.AddComponent<HorizontalLayoutGroup>();
            badgeRowHlg.childAlignment    = TextAnchor.MiddleCenter;
            badgeRowHlg.childControlWidth = false;
            badgeRowHlg.childControlHeight = true;

            var badgePill = Obj("Badge", badgeRow.transform);
            var pillRT    = badgePill.AddComponent<RectTransform>();
            pillRT.sizeDelta = new Vector2(130, 24);
            _badgeImg = badgePill.AddComponent<Image>();
            var pillHLG = badgePill.AddComponent<HorizontalLayoutGroup>();
            pillHLG.padding = new RectOffset(12, 12, 3, 3);
            pillHLG.childAlignment = TextAnchor.MiddleCenter;
            pillHLG.childControlWidth = true;
            pillHLG.childForceExpandWidth = true;
            _badgeTMP = TMP("BadgeText", badgePill.transform, 11, Color.white, TextAlignmentOptions.Center);
            _badgeTMP.fontStyle = FontStyles.Bold;

            // Title
            _titleTMP = TMP("Title", content.transform, 24, TEXT, TextAlignmentOptions.Center);
            _titleTMP.enableWordWrapping = true;
            AddCSF(_titleTMP.gameObject);
            AddLE(_titleTMP.gameObject, minH: 30);

            // Divider
            var div = Obj("Divider", content.transform);
            AddLE(div, minH: 1, prefH: 1);
            div.AddComponent<Image>().color = BORDER;

            // Description
            _descTMP = TMP("Desc", content.transform, 15, MUTED, TextAlignmentOptions.Left);
            _descTMP.enableWordWrapping = true;
            AddCSF(_descTMP.gameObject);
            AddLE(_descTMP.gameObject, minH: 20);

            // Specs container
            var specsObj = Obj("Specs", content.transform);
            var specsVLG = specsObj.AddComponent<VerticalLayoutGroup>();
            specsVLG.spacing           = 6;
            specsVLG.childControlWidth  = true;
            specsVLG.childControlHeight = false;
            specsVLG.childForceExpandWidth = true;
            specsObj.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            AddLE(specsObj, minH: 0);
            _specsHolder = specsObj.transform;

            // Pre-build spec rows
            for (int i = 0; i < MAX_SPECS; i++)
                BuildSpecRow(i);

            // Tip box
            var tipBox   = Obj("TipBox", content.transform);
            var tipBoxImg = tipBox.AddComponent<Image>();
            tipBoxImg.color = TIP_BG;
            var tipVLG = tipBox.AddComponent<VerticalLayoutGroup>();
            tipVLG.padding = new RectOffset(14, 14, 12, 12);
            tipVLG.childControlWidth = true;
            tipVLG.childForceExpandWidth = true;
            tipVLG.childControlHeight = false;
            tipBox.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            AddLE(tipBox, minH: 0);

            _tipTMP = TMP("Tip", tipBox.transform, 14, TIP_FG, TextAlignmentOptions.Left);
            _tipTMP.enableWordWrapping = true;
            AddCSF(_tipTMP.gameObject);

            _root.SetActive(false);
        }

        void BuildCloseButton(Transform parent)
        {
            var go = Obj("CloseBtn", parent);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(1, 1);
            rt.pivot = new Vector2(1, 1);
            rt.anchoredPosition = new Vector2(-PAD * 0.5f, -PAD * 0.5f);
            rt.sizeDelta = new Vector2(40, 40);

            go.AddComponent<Image>().color = CLOSE_BG;

            var btn = go.AddComponent<Button>();
            var cols = btn.colors;
            cols.highlightedColor = new Color(1, 1, 1, 0.15f);
            cols.pressedColor     = new Color(1, 1, 1, 0.25f);
            btn.colors = cols;
            btn.onClick.AddListener(Hide);

            var lbl = TMP("X", go.transform, 18, MUTED, TextAlignmentOptions.Center);
            lbl.text = "✕";
            var lblRT = lbl.GetComponent<RectTransform>();
            lblRT.anchorMin = Vector2.zero;
            lblRT.anchorMax = Vector2.one;
            lblRT.offsetMin = lblRT.offsetMax = Vector2.zero;
        }

        ScrollRect BuildScrollArea(Transform parent)
        {
            // ScrollView
            var sv = Obj("ScrollView", parent);
            var svRT = sv.AddComponent<RectTransform>();
            svRT.anchorMin = Vector2.zero;
            svRT.anchorMax = Vector2.one;
            svRT.offsetMin = new Vector2(PAD, PAD);
            svRT.offsetMax = new Vector2(-PAD, -PAD);

            var sr = sv.AddComponent<ScrollRect>();
            sr.horizontal = false;
            sr.scrollSensitivity = 40;

            // Viewport
            var vp   = Obj("Viewport", sv.transform);
            var vpRT = vp.AddComponent<RectTransform>();
            vpRT.anchorMin = Vector2.zero;
            vpRT.anchorMax = Vector2.one;
            vpRT.offsetMin = vpRT.offsetMax = Vector2.zero;
            vp.AddComponent<Image>().color = Color.clear;
            vp.AddComponent<Mask>().showMaskGraphic = false;

            // Content
            var ct   = Obj("Content", vp.transform);
            var ctRT = ct.AddComponent<RectTransform>();
            ctRT.anchorMin = new Vector2(0, 1);
            ctRT.anchorMax = new Vector2(1, 1);
            ctRT.pivot     = new Vector2(0.5f, 1);
            ctRT.offsetMin = ctRT.offsetMax = Vector2.zero;

            var vlg = ct.AddComponent<VerticalLayoutGroup>();
            vlg.spacing            = 14;
            vlg.padding            = new RectOffset(0, 0, 10, 20);
            vlg.childControlWidth  = true;
            vlg.childControlHeight = false;
            vlg.childForceExpandWidth  = true;
            vlg.childForceExpandHeight = false;
            ct.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            sr.viewport = vpRT;
            sr.content  = ctRT;

            return sr;
        }

        void BuildSpecRow(int index)
        {
            var row   = Obj($"Spec{index}", _specsHolder);
            var rowRT = row.AddComponent<RectTransform>();
            rowRT.sizeDelta = new Vector2(0, 36);
            row.AddComponent<Image>().color = SPEC_BG;

            var hlg = row.AddComponent<HorizontalLayoutGroup>();
            hlg.padding           = new RectOffset(12, 12, 8, 8);
            hlg.childControlWidth  = false;
            hlg.childControlHeight = true;
            hlg.childForceExpandWidth  = false;
            hlg.childForceExpandHeight = true;

            var lbl = TMP("Label", row.transform, 13, MUTED, TextAlignmentOptions.Left);
            lbl.enableWordWrapping = false;
            var lblLE = lbl.gameObject.AddComponent<LayoutElement>();
            lblLE.flexibleWidth = 1;

            var val = TMP("Value", row.transform, 13, NEON, TextAlignmentOptions.Right);
            val.enableWordWrapping = false;
            var valLE = val.gameObject.AddComponent<LayoutElement>();
            valLE.flexibleWidth = 1;

            _specRow[index] = row;
            _specLbl[index] = lbl;
            _specVal[index] = val;
        }

        // ══════════════════════════════════════════════════════════════
        //  Helpers
        // ══════════════════════════════════════════════════════════════

        static GameObject Obj(string name, Transform parent)
        {
            var go = new GameObject(name);
            if (parent != null) go.transform.SetParent(parent, false);
            return go;
        }

        static RectTransform Fill(GameObject go, Transform parent)
        {
            var rt = go.GetComponent<RectTransform>() ?? go.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            return rt;
        }

        static TextMeshProUGUI TMP(string name, Transform parent, float size, Color col, TextAlignmentOptions align)
        {
            var go = Obj(name, parent);
            go.AddComponent<RectTransform>();
            var t = go.AddComponent<TextMeshProUGUI>();
            t.fontSize  = size;
            t.color     = col;
            t.alignment = align;
            return t;
        }

        static void AddLE(GameObject go, float minH = 0, float prefH = -1)
        {
            var le = go.AddComponent<LayoutElement>();
            le.minHeight = minH;
            if (prefH >= 0) le.preferredHeight = prefH;
        }

        static void AddCSF(GameObject go)
        {
            go.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        }

        static Color H(string hex, float a = 1f)
        {
            ColorUtility.TryParseHtmlString(hex, out Color c);
            c.a = a;
            return c;
        }
    }
}
