---
name: unity-magicleap-ehr-assistant
description: Helps build Unity MR applications for Magic Leap 2 connecting to IoT sensors (MQTT), InfluxDB, and LLM interfaces.
---

# Unity Magic Leap EHR Assistant Skill

This skill assists AI agents in constructing Magic Leap 2 mixed-reality applications inside Unity. The application integrates real-time IoT sensor data (via MQTT), historical data (via InfluxDB), and natural language processing (via LLMs) to create an Assistant interface.

## 1. Magic Leap Unity Setup

When starting a project, ensure the following setup steps are taken in Unity:
1. **Engine Version:** Use Unity LTS (e.g., 2022.3 LTS).
2. **Platform:** Switch to Android platform.
3. **XR Plug-in Management:** Install `OpenXR` and the `Magic Leap XR Plugin`.
4. **Project Settings:**
   * In XR Plug-in Management, check `OpenXR` and `Magic Leap Feature Group`.
   * Under OpenXR -> Interaction Profiles, add `Magic Leap Controller Profile`.
5. **Scene Setup:** Remove the Main Camera. Add `XROrigin` (AR) and configure it for Magic Leap.

## 2. Project Structure

Ensure the Unity project follows this directory structure:
```text
Assets/
├── Scripts/
│   ├── MQTT/
│   ├── InfluxDB/
│   ├── LLM/
│   ├── MagicLeap/
│   ├── UI/
│   └── Config/
├── Scenes/
└── Materials/
```

## 3. Template Usage

The `templates/` folder within this skill provides base C# scripts:
* **MqttManager.cs:** Handles HiveMQ MQTT broker connections, subscribing to ultrasonic sensors.
* **InfluxDBManager.cs:** Performs async REST queries (`UnityWebRequest`) to an InfluxDB time-series database.
* **LLMClient.cs:** Connects to an OpenAI-compatible LLM endpoint (like Qwen or QAN3.5) with streaming or blocking responses.
* **SensorVisualizer.cs:** Uses Magic Leap spatial anchors or basic UI to float sensor values in the user's view.

### Coding Guidelines
* Always separate data ingestion, visualization, and AI logic.
* Use `UnityWebRequest` nested in `async Task` or yield return Coroutines for network IO.
* Never hardcode endpoints. Use a configuration system (e.g., JSON Config or Unity ScriptableObjects) to hold URLs, Tokens, and Topics.

## 4. WebAR Client (Mobile Browser AR)

To test the application easily on an iPhone or Android phone without needing the Magic Leap headset, a WebXR version is provided in the `WebAR-Client/` folder.
* Uses **A-Frame** for WebXR. 
* Includes a **grabbable 3D panel** displaying real-time data and chat history.
* Uses **DOM Overlay** for text input and the **Web Speech API** for voice interaction with the LLM.
* Connects to the same HiveMQ MQTT topics via WebSockets.
* *Note:* On iPhone, use Mozilla's "WebXR Viewer" from the App Store as Safari lacks full Immersive AR support by default.

## 5. Arduino Integration (Wired)

The `Arduino/` folder contains a basic `Wired_Arduino.ino` sketch designed for standard boards like the Arduino Uno (no WiFi needed). 
* Connect an **HC-SR04** ultrasonic sensor (Trig Pin 9, Echo Pin 10).
* The script simply prints distance metrics in centimeters to the Serial interface at 115200 baud rate.

To forward this data to the Unity scene and WebAR client, use the attached Python script in the same folder:
* Ensure python is installed, and run: `pip install pyserial paho-mqtt`
* Connect your Arduino to your PC via USB.
* Run: `python serial_mqtt_bridge.py`
* The script will auto-detect the COM port, read the serial data, and publish it continuously to the public HiveMQ broker at `hospital/sensors/ultrasonic`, which all other clients will see.

## 6. Example Feature Implementations

### Real-Time Ultrasonic Sensor Stream
Use the `MqttManager` to listen on `sensor/ultrasonic`. 
Forward parsed float values to a `SensorVisualizer` component that updates a TextMeshPro UI element anchored in MR space.

### LLM Context Passing
Periodically pass the last 10 seconds of sensor data from the MQTT manager to the `LLMClient`. Have the user press a trigger or use a Voice Intent to ask, "Is the measurement stable?", and have the LLM respond based on the passed context.
