using System;
using System.Collections;
using UnityEngine;
using Unity.Sentis;
using Debug = UnityEngine.Debug;

namespace ARExplorer.Detection
{
    public class ImageClassifier : MonoBehaviour
    {
        [Header("Model")]
        public ModelAsset modelAsset;

        [Header("Settings")]
        [Range(0f, 1f)]
        public float confidenceThreshold = 0.5f;
        public int inputSize = 640;

        [Header("Labels (must match YOLO training order)")]
        public string[] classLabels = new string[]
        {
            "BreadBoard",
            "REDLed",
            "UltrasoneSensor"
        };

        public event Action<ClassificationResult> OnClassification;

        public struct ClassificationResult
        {
            public string className;
            public float confidence;
            public bool isBackground;
            public Rect boundingBox; // normalized 0-1
        }

        private Worker _worker;
        private bool _busy;
        private RenderTexture _resizeRT;

        void Start()
        {
            if (modelAsset == null)
            {
                Debug.LogError("[ImageClassifier] No model asset assigned!");
                enabled = false;
                return;
            }

            var model = ModelLoader.Load(modelAsset);
            _worker = new Worker(model, BackendType.CPU);
            _resizeRT = new RenderTexture(inputSize, inputSize, 0, RenderTextureFormat.ARGB32);
            Debug.Log("[ImageClassifier] YOLO model loaded.");
        }

        public void Classify(Texture inputTexture)
        {
            if (_busy || _worker == null) return;
            StartCoroutine(RunInference(inputTexture));
        }

        private IEnumerator RunInference(Texture inputTexture)
        {
            _busy = true;

            // Resize to 640x640
            Graphics.Blit(inputTexture, _resizeRT);

            RenderTexture prev = RenderTexture.active;
            RenderTexture.active = _resizeRT;
            Texture2D tex = new Texture2D(inputSize, inputSize, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, inputSize, inputSize), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;

            // Build NCHW float array [1, 3, 640, 640], normalize /255
            Color32[] pixels = tex.GetPixels32();
            Destroy(tex);

            int hw = inputSize * inputSize;
            float[] floatData = new float[3 * hw];
            for (int y = 0; y < inputSize; y++)
            for (int x = 0; x < inputSize; x++)
            {
                int src = y * inputSize + x;
                int dst = y * inputSize + x;
                floatData[0 * hw + dst] = pixels[src].r / 255f;
                floatData[1 * hw + dst] = pixels[src].g / 255f;
                floatData[2 * hw + dst] = pixels[src].b / 255f;
            }

            using var input = new Tensor<float>(new TensorShape(1, 3, inputSize, inputSize), floatData);
            _worker.Schedule(input);

            yield return null;

            // Output shape: [1, 7, 8400]
            // Each of 8400 anchors: [cx, cy, w, h, class0, class1, class2]
            var outputTensor = _worker.PeekOutput() as Tensor<float>;
            var data = outputTensor.DownloadToArray();

            int numAnchors = 8400;
            int numClasses = classLabels.Length;

            float bestConf = 0f;
            int bestClass = -1;
            float bestCx = 0, bestCy = 0, bestW = 0, bestH = 0;

            // Track per-class best scores for diagnostics
            float[] classBestScore = new float[numClasses];
            float[] classBestCx    = new float[numClasses];
            float[] classBestCy    = new float[numClasses];

            for (int i = 0; i < numAnchors; i++)
            {
                float cx = data[0 * numAnchors + i];
                float cy = data[1 * numAnchors + i];
                float w  = data[2 * numAnchors + i];
                float h  = data[3 * numAnchors + i];

                for (int c = 0; c < numClasses; c++)
                {
                    float score = data[(4 + c) * numAnchors + i];
                    if (score > classBestScore[c])
                    {
                        classBestScore[c] = score;
                        classBestCx[c] = cx;
                        classBestCy[c] = cy;
                    }
                    if (score > bestConf)
                    {
                        bestConf  = score;
                        bestClass = c;
                        bestCx = cx; bestCy = cy; bestW = w; bestH = h;
                    }
                }
            }

            // Log per-class scores every frame for diagnostics
            var sb = new System.Text.StringBuilder("[Classifier] Scores:");
            for (int c = 0; c < numClasses; c++)
                sb.Append($" {classLabels[c]}={classBestScore[c]:F2}@({classBestCx[c]/inputSize:F2},{classBestCy[c]/inputSize:F2})");
            Debug.Log(sb.ToString());

            ClassificationResult result;

            // Reject edge false positives — center must be within inner 70% of image
            float normCx = bestCx / inputSize;
            float normCy = bestCy / inputSize;
            bool edgeDetection = normCx < 0.15f || normCx > 0.85f || normCy < 0.15f || normCy > 0.85f;

            if (bestClass < 0 || bestConf < confidenceThreshold || edgeDetection)
            {
                result = new ClassificationResult { isBackground = true };
                if (edgeDetection)
                    Debug.Log($"[Classifier] Edge FP rejected: {classLabels[bestClass]} conf={bestConf:F2} cx={normCx:F2} cy={normCy:F2}");
                else
                    Debug.Log($"[Classifier] No detection above threshold (best={bestConf:F2})");
            }
            else
            {
                // Convert from pixel coords (0-640) to normalized (0-1)
                float nx = (bestCx - bestW / 2f) / inputSize;
                float ny = (bestCy - bestH / 2f) / inputSize;
                float nw = bestW / inputSize;
                float nh = bestH / inputSize;

                result = new ClassificationResult
                {
                    className   = classLabels[bestClass],
                    confidence  = bestConf,
                    isBackground = false,
                    boundingBox = new Rect(nx, ny, nw, nh)
                };

                Debug.Log($"[Classifier] {classLabels[bestClass]} conf={bestConf:F2} bbox=({nx:F2},{ny:F2},{nw:F2},{nh:F2})");
            }

            try { OnClassification?.Invoke(result); }
            finally { _busy = false; }
        }

        void OnDestroy()
        {
            _worker?.Dispose();
            _resizeRT?.Release();
        }
    }
}
