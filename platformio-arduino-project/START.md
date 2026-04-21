# Start Guide

## 1 — Upload firmware to Arduino

Plug the Arduino in via USB, then run:

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run --target upload --project-dir "c:\Projects\BachelorProef\platformio-arduino-project"
```

> Alternative: open this folder in VS Code with the PlatformIO extension and click **→ Upload** in the bottom status bar.

---

## 2 — Install Python dependencies (first time only)

```bash
pip install pyserial paho-mqtt python-dotenv
```

---

## 3 — Start the MQTT bridge

```bash
cd c:\Projects\BachelorProef\platformio-arduino-project
python serial_mqtt_bridge.py
```

The script auto-detects the Arduino COM port. If it fails, uncomment line 41 in `serial_mqtt_bridge.py` and set the correct port:

```python
port_name = "COM3"
```

Expected output:
```
✅ Connected to MQTT Broker: ...hivemq.cloud
📡 Forwarding data to hospital/sensors/ultrasonic
📏 Distance: 23 cm -> Publishing to MQTT
```

---

## 4 — Open the AR app

- **Vercel (phone):** `https://3-da-rmodels.vercel.app`
- **Local (same WiFi):** run `node local-server.js` → open `http://192.168.0.142:3001`

The sensor dot in the AR app goes green when MQTT data arrives.
