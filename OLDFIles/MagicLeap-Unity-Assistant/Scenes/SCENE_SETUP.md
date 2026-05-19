# Magic Leap Unity Scene — Setup Guide

This document explains exactly how to create the Unity scene that:
- Displays live Arduino ultrasonic sensor data via MQTT
- Runs in the **Unity Editor** (for development / testing)
- Deploys to the **Magic Leap 2** headset

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Unity | 2022.3 LTS | Magic Leap requires LTS |
| Magic Leap Unity SDK | 2.x | Via Package Manager |
| OpenXR Plugin | Latest | Included in ML SDK |
| TextMeshPro | Latest | Via Package Manager |
| MQTTnet | 3.1.x | See install below |

---

## Step 1 — Create the Unity Project

1. Open **Unity Hub** → New Project → **3D (URP)** template (2022.3 LTS)
2. Name it `MagicLeapSensorUI`
3. Open the project

---

## Step 2 — Install Packages

Open **Window → Package Manager**:

### Magic Leap SDK
```
Add package from git URL:
com.magicleap.unitysdk
```
Or install via the link in your Magic Leap developer account.

### MQTTnet
MQTTnet doesn't ship in the Unity Package Manager, so use the **.dll** approach:

1. Download from NuGet: [MQTTnet 3.1.x](https://www.nuget.org/packages/MQTTnet/)
2. Extract the `.nupkg` (rename to `.zip`)
3. Copy `lib/netstandard2.0/MQTTnet.dll` into `Assets/Plugins/`
4. In Unity: select the `.dll` file → Inspector → set Platform to **Any Platform**

---

## Step 3 — Copy the C# Scripts

Copy the following files from `BachelorProef/MagicLeap-Unity-Assistant/Scripts/` into `Assets/Scripts/`:

| File | Purpose |
|------|---------|
| `UnityMainThreadDispatcher.cs` | Thread-safe bridge for MQTT callbacks |
| `MqttSensorManager.cs` | MQTT connection + live sensor data |
| `MagicLeapUIController.cs` | Magic Leap 2 UI world-lock + grab |
| `SensorPanelAnimator.cs` | Visual animations (pulse, bar graph) |

---

## Step 4 — Build the Scene

### 4a. Create the Canvas (World Space)

1. **GameObject → UI → Canvas**
2. In Inspector: **Render Mode → World Space**
3. Set Canvas width: `0.6`, height: `0.8`
4. Position: `(0, 1.6, 1.2)` — 1.2m in front, eye height

### 4b. Create the Panel (background)

1. Right-click Canvas → UI → Panel
2. Color: `#0D0F1A`, Alpha: `0.9`
3. Add **`CanvasGroup`** component (for smooth dim/alpha)

### 4c. Sensor Value Text

1. Right-click Panel → UI → Text – TextMeshPro
2. Name: `SensorValueText`
3. Font Size: `72`, Bold, Color: `#00C8B4`
4. Alignment: Center
5. Position: top-center of the panel

### 4d. Status Text

1. Another TextMeshPro, Name: `StatusText`
2. Font Size: `18`, Color: `#888888`
3. At the bottom of the panel

### 4e. Bar graph (optional)

1. Create 12 `Image` UI elements as children
2. Arrange as equal-width columns at the bottom
3. Assign them all to the `HistoryBars[]` array on `SensorPanelAnimator`

---

## Step 5 — Attach Scripts

### On an empty GameObject ("MQTTManager"):
```
Add Component → UnityMainThreadDispatcher
```

### On the Canvas root:
```
Add Component → MqttSensorManager
  - BrokerHost: broker.hivemq.com
  - BrokerPort: 1883
  - Topic: hospital/sensors/ultrasonic
  - SensorValueText: [drag SensorValueText here]
  - StatusText: [drag StatusText here]

Add Component → MagicLeapUIController
  - PanelDistance: 1.2
  - DimWhenNotGazed: ✅

Add Component → SensorPanelAnimator
  - SensorValueText: [same ref]
  - HistoryBars: [drag 12 Image elements]
```

---

## Step 6 — Enter Play Mode (Editor Test)

Press ▶ **Play** in the Unity Editor. You should see:
- The panel appear at `(0, 1.6, 1.2)` in the scene view
- Status: 🔴 Connecting → 🟢 MQTT Connected
- The `SensorValueText` updating with live distance values from Arduino

> **Make sure `serial_mqtt_bridge.py` is running** so data flows from Arduino → MQTT → Unity

---

## Step 7 — Build for Magic Leap 2

### Switch Platform

1. **File → Build Settings → Android**
2. Check the box: **Magic Leap 2** (requires ML SDK)
3. Click **Switch Platform**

### XR Setup

1. **Edit → Project Settings → XR Plug-in Management**
2. Enable **OpenXR** for Android
3. Add **Magic Leap feature group** in OpenXR settings

### Build & Run

1. Connect Magic Leap 2 via USB
2. **File → Build Settings → Build And Run**
3. Accept permissions on the headset (MQTT, EyeTracking)

---

## Using the Web Configurator

Open `WebConfigurator/index.html` in a browser to visually configure the scene settings. The page shows a live preview of the panel with simulated data.

When you click **Export Config JSON**, copy the output and use it as your configuration reference while setting up the Unity Inspector values.

---

## Data Flow

```
Arduino Uno (HC-SR04)
       │ USB Serial
       ▼
serial_mqtt_bridge.py
       │ MQTT publish → hospital/sensors/ultrasonic
       ▼
HiveMQ Broker (broker.hivemq.com:1883)
       │ MQTT subscribe
       ▼
Unity MqttSensorManager.cs
       │ → SensorValueText updates
       ▼
Magic Leap 2 Display (World-Locked Panel)
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `StatusText` stays 🔴 | Check that `serial_mqtt_bridge.py` is running |
| Unity throws null ref on MQTTnet | Check `MQTTnet.dll` is in `Assets/Plugins/` |
| Panel not visible on ML2 | Check `PanelDistance` — default 1.2m works well |
| Eye tracking not dimming | Enable Eye Tracking permission on the device |
| Build fails | Ensure Android SDK + NDK are installed in Unity Hub |
