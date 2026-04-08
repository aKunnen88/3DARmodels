"""
Convert a Teachable Machine MobileNetV2-based tfjs model to ONNX.

Architecture (inferred from model.json):
  MobileNetV2 (include_top=False, 224x224x3) -> GlobalAveragePooling2D
  -> Dense(100, relu) -> Dense(3, softmax, no bias)
"""

import json, os, sys, subprocess
import numpy as np
import tensorflow as tf

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_JSON = os.path.join(MODEL_DIR, "model.json")
SAVED_MODEL_DIR = os.path.join(MODEL_DIR, "saved_model")
OUTPUT_ONNX = os.path.join(MODEL_DIR, "ar_explorer.onnx")

# ── 1. Load weight tensors from binary ──────────────────────────────────────────
with open(MODEL_JSON) as f:
    model_data = json.load(f)

weight_tensors = {}
for entry in model_data["weightsManifest"]:
    bin_path = os.path.join(MODEL_DIR, entry["paths"][0])
    with open(bin_path, "rb") as f:
        raw = f.read()
    offset = 0
    for spec in entry["weights"]:
        dtype = np.dtype(spec["dtype"])
        shape = spec["shape"]
        n = int(np.prod(shape)) if shape else 1
        n_bytes = n * dtype.itemsize
        weight_tensors[spec["name"]] = np.frombuffer(
            raw[offset: offset + n_bytes], dtype=dtype
        ).reshape(shape)
        offset += n_bytes
print(f"Loaded {len(weight_tensors)} weight tensors.")

# ── 2. Build model ──────────────────────────────────────────────────────────────
base = tf.keras.applications.MobileNetV2(
    input_shape=(224, 224, 3), alpha=0.35, include_top=False, weights=None
)
x = tf.keras.layers.GlobalAveragePooling2D()(base.output)
x = tf.keras.layers.Dense(100, activation="relu", name="dense_Dense1")(x)
out = tf.keras.layers.Dense(3, activation="softmax", use_bias=False, name="dense_Dense2")(x)
model = tf.keras.Model(inputs=base.input, outputs=out)
print(f"Model built: {len(model.layers)} layers, output shape: {model.output_shape}")

# ── 3. Match and assign weights ─────────────────────────────────────────────────
matched = 0
unmatched_names = []
for layer in model.layers:
    layer_weights = layer.weights
    if not layer_weights:
        continue
    new_vals = []
    for w in layer_weights:
        # TF name: "mobilenetv2_Conv1/kernel:0"  -> tfjs key: "Conv1/kernel"
        # TF name: "dense_Dense1/kernel:0"       -> tfjs key: "dense_Dense1/kernel"
        raw_name = w.name.split(":")[0]  # strip :0
        parts = raw_name.split("/")

        found = None
        # Keras 3: w.path gives "LayerName/kernel" which matches tfjs keys directly.
        # DepthwiseConv2D: TF calls it "kernel", but tfjs calls it "depthwise_kernel".
        w_path = getattr(w, "path", None)
        candidates = [w_path] if w_path else []
        if w_path and w_path.endswith("/kernel"):
            candidates.append(w_path[:-len("kernel")] + "depthwise_kernel")
        for candidate in candidates:
            if candidate and candidate in weight_tensors:
                found = weight_tensors[candidate]
                break
        if found is None:
            # Fallback: try progressively shorter suffixes
            for n in range(2, len(parts) + 1):
                candidate = "/".join(parts[-n:])
                if candidate in weight_tensors:
                    found = weight_tensors[candidate]
                    break

        if found is not None:
            new_vals.append(found)
            matched += 1
        else:
            unmatched_names.append(w.name)
            new_vals.append(w.numpy())
    layer.set_weights(new_vals)

print(f"Weights assigned: {matched} matched, {len(unmatched_names)} unmatched")
if unmatched_names:
    print("Unmatched:", unmatched_names[:10])

# ── 4. Save as TF SavedModel ───────────────────────────────────────────────────
tf.saved_model.save(model, SAVED_MODEL_DIR)
print(f"SavedModel written to: {SAVED_MODEL_DIR}")

# ── 5. Convert SavedModel -> ONNX ──────────────────────────────────────────────
result = subprocess.run(
    [sys.executable, "-m", "tf2onnx.convert",
     "--saved-model", SAVED_MODEL_DIR,
     "--output", OUTPUT_ONNX,
     "--opset", "13"],
    capture_output=True, text=True,
)
# Show tf2onnx output (filter noisy TF init lines)
for line in (result.stdout + result.stderr).splitlines():
    if any(x in line for x in ["INFO", "error", "Error", "ONNX", "opset", "output"]):
        print(line)
if result.returncode != 0:
    print("\nConversion FAILED. Full stderr:\n", result.stderr[-2000:])
    sys.exit(1)
print(f"\nDone. ONNX model: {OUTPUT_ONNX}")
