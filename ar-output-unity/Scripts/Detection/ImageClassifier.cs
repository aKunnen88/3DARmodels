using System;
using System.Collections;
using UnityEngine;
using Unity.Sentis;
using Debug = UnityEngine.Debug;

namespace ARExplorer.Detection
{
    /// <summary>
    /// Runs image classification using Unity Sentis (the converted Teachable Machine model).
    /// Feeds camera frames to the ONNX model and returns the top prediction.
    /// </summary>
    public class ImageClassifier : MonoBehaviour
    {
        [Header("Model")]
        [Tooltip("The converted ONNX model asset (from Teachable Machine).")]
        public ModelAsset modelAsset;

        [Header("Settings")]
        [Tooltip("Minimum confidence to consider a detection valid.")]
        [Range(0f, 1f)]
        public float confidenceThreshold = 0.75f;

        [Tooltip("Input image size expected by the model (Teachable Machine uses 224).")]
        public int inputSize = 224;

        /// <summary>Class labels in the same order as the model's output.</summary>
        /// <remarks>Must match metadata.json labels: ["BreadBoard", "UltrasoneSensor", "LEDRed"]</remarks>
        [Header("Labels (must match model training order)")]
        public string[] classLabels = new string[]
        {
            "BreadBoard",
            "UltrasoneSensor",
            "LEDRed"
        };

        // ── Result ────────────────────────────────────────────────
        public event Action<ClassificationResult> OnClassification;

        public struct ClassificationResult
        {
            public string className;
            public float confidence;
            public bool isBackground;
        }

        // ── Internals ──────────────────────────────────────────────
        private Worker _worker;
        private bool _busy;

        void Start()
        {
            if (modelAsset == null)
            {
                Debug.LogError("[ImageClassifier] No model asset assigned!");
                enabled = false;
                return;
            }

            var model = ModelLoader.Load(modelAsset);
            _worker = new Worker(model, BackendType.GPUCompute);
        }

        /// <summary>
        /// Classify a camera frame. Call this from ARDetectionManager
        /// at the desired interval (e.g., every 300 ms).
        /// </summary>
        public void Classify(Texture inputTexture)
        {
            if (_busy || _worker == null) return;
            StartCoroutine(RunInference(inputTexture));
        }

        private IEnumerator RunInference(Texture inputTexture)
        {
            _busy = true;

            // Resize and normalize to [0,1] as Teachable Machine expects
            using var input = TextureConverter.ToTensor(inputTexture, inputSize, inputSize, 3);

            _worker.Schedule(input);

            // Wait one frame then read back (Sentis 2.x: ReadbackAndCloneAsync removed;
            // DownloadToArray implicitly syncs with the GPU)
            yield return null;

            var outputTensor = _worker.PeekOutput() as Tensor<float>;

            // Find top prediction
            float maxProb = 0f;
            int maxIdx = 0;
            var data = outputTensor.DownloadToArray();

            for (int i = 0; i < data.Length && i < classLabels.Length; i++)
            {
                // Teachable Machine outputs softmax probabilities
                if (data[i] > maxProb)
                {
                    maxProb = data[i];
                    maxIdx = i;
                }
            }

            var result = new ClassificationResult
            {
                className = maxIdx < classLabels.Length ? classLabels[maxIdx] : "Unknown",
                confidence = maxProb,
                isBackground = classLabels[maxIdx].ToLower() == "background" || maxProb < confidenceThreshold
            };

            OnClassification?.Invoke(result);
            _busy = false;
        }

        void OnDestroy()
        {
            _worker?.Dispose();
        }
    }
}
