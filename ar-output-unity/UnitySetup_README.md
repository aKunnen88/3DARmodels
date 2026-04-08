# AR Explorer - Unity / Magic Leap 2

This is the Unity port of the AR Explorer, targeting **Magic Leap 2** and **Unity 2022.3 LTS**.
It uses a Teachable Machine model converted to ONNX to detect Arduino components.

### 1. Unity Project Setup
Use the **3D (URP)** or **3D Core** template in **Unity 2022.3 LTS**.

### 2. Install Packages
Add following packages via Package Manager:
* com.unity.xr.magicleap
* com.unity.xr.interaction.toolkit
* com.unity.sentis
* **LeanTween**: Import from Unity Asset Store.

### 3. Magic Leap Config
* **Project Settings > XR Plug-in Management**: Enable Magic Leap (Android).
* **Player Settings > Android**: Min API 29, IL2CPP, x86_64.

### 4. Convert Teachable Machine Model to ONNX
`ash
pip install tensorflowjs tensorflow tf2onnx onnx
mkdir tm_model && cd tm_model
tensorflowjs_converter --input_format=tfjs_layers_model --output_format=saved_model https://teachablemachine.withgoogle.com/models/5HBj-fn_i/model.json ./saved_model
python -m tf2onnx.convert --saved-model ./saved_model --output ar_explorer.onnx --opset 13
`
Copy r_explorer.onnx into Assets/Models/ in Unity.

### 5. Import Scripts
Copy the Scripts folder from r-output-unity into your Unity Assets folder.

### 6. Generate Component Database
1. Right-click > **Create > AR Explorer > Component Database**. Name it ArduinoComponents.
2. Select it, then from top menu: **AR Explorer > Populate Default Components**.

### 7. Scene Setup
1. **Manager**: Create AR Detection Manager. Add ImageClassifier and ARDetectionManager.
   - Model Asset: Your ONNX file.
   - Class Labels: BreadBoard, UltrasoneSensor, LEDRed.
2. **Prefabs**: Create ARMarkerBubble (assign to Manager) and DetailPanel (World space canvas, assign to Manager).

### 8. Permissions
**Project Settings > Magic Leap > Manifest Settings**: Enable CAMERA and CONTROLLER_POSE.

### 9. Deploy
Connect ML2, switch to Android, **Build and Run**.
