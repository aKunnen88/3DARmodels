using UnityEngine;
using TMPro;

namespace EHRAssistant.Visualization
{
    public class SensorVisualizer : MonoBehaviour
    {
        [Tooltip("The TextMeshPro UI element to display sensor data")]
        public TextMeshPro sensorText;

        [Tooltip("Format string for sensor data, e.g. '{0:F2} cm'")]
        public string stringFormat = "{0:F2} cm";

        /// <summary>
        /// Update the displayed sensor value.
        /// </summary>
        public void UpdateSensorValue(string topic, float value)
        {
            if (sensorText != null)
            {
                sensorText.text = $"{topic}: {string.Format(stringFormat, value)}";
            }
        }
        
        void Update()
        {
            // Billboard behavior: Always face the camera (assuming Magic Leap main camera)
            if (Camera.main != null)
            {
                transform.LookAt(Camera.main.transform);
                // Reverse rotation so text faces exactly towards camera
                transform.Rotate(0, 180, 0); 
            }
        }
    }
}
