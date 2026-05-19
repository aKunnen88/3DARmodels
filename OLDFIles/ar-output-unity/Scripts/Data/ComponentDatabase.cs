using System.Collections.Generic;
using UnityEngine;

namespace ARExplorer.Data
{
    /// <summary>
    /// ScriptableObject that holds every known component.
    /// Create via: Assets → Create → AR Explorer → Component Database
    /// </summary>
    [CreateAssetMenu(fileName = "ComponentDatabase", menuName = "AR Explorer/Component Database")]
    public class ComponentDatabase : ScriptableObject
    {
        [SerializeField] private List<ComponentData> components = new List<ComponentData>();

        private Dictionary<string, ComponentData> _lookup;

        /// <summary>
        /// Resolve a Teachable-Machine class name to a ComponentData entry.
        /// Uses the same logic as the web version:
        ///   className.ToLower().Replace(" ", "_")
        /// </summary>
        public ComponentData Resolve(string className)
        {
            BuildLookup();

            string key = className.ToLower().Replace(" ", "_");

            if (_lookup.TryGetValue(key, out var comp))
                return comp;

            // Fallback to "unknown"
            if (_lookup.TryGetValue("unknown", out var unknown))
                return unknown;

            return null;
        }

        public List<ComponentData> GetAll() => components;

        private void BuildLookup()
        {
            if (_lookup != null) return;

            _lookup = new Dictionary<string, ComponentData>();
            foreach (var c in components)
            {
                // Key by the classLabel lowered (same as web resolveComponent)
                string key = c.classLabel.ToLower().Replace(" ", "_");
                if (!_lookup.ContainsKey(key))
                    _lookup[key] = c;

                // Also key by id for direct lookup
                if (!string.IsNullOrEmpty(c.id) && !_lookup.ContainsKey(c.id))
                    _lookup[c.id] = c;
            }
        }

        /// <summary>
        /// Force rebuild of internal lookup (call after runtime modifications).
        /// </summary>
        public void InvalidateCache() => _lookup = null;
    }
}
