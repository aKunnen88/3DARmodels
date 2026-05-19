using UnityEngine;

namespace ARExplorer.Data
{
    /// <summary>
    /// Represents a single Arduino component with all metadata
    /// used for AR marker bubbles and the detail panel.
    /// </summary>
    [System.Serializable]
    public class ComponentData
    {
        [Header("Identity")]
        public string id;
        public string displayName;
        public string fullName;
        public string classLabel;   // exact Teachable Machine class name

        [Header("Visual")]
        public string icon;         // emoji or sprite name
        public string badge;        // e.g. SENSOR, OUTPUT, PASSIVE
        public Color badgeColor = Color.white;
        public Color markerColor = Color.cyan;

        [Header("Content")]
        [TextArea(3, 6)]
        public string description;
        public SpecEntry[] specs;
        [TextArea(2, 4)]
        public string proTip;
    }

    [System.Serializable]
    public class SpecEntry
    {
        public string label;
        public string value;
    }
}
