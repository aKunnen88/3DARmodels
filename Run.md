# Project Opstarten

Volg de stappen hieronder in volgorde. Je hebt **3 aparte terminal vensters** nodig.

---
.\venv\Scripts\Activate.ps1
## Stap 1 — Firmware uploaden naar Arduino (eenmalig)

Installeer PlatformIO (VS Code extensie of CLI) als je dat nog niet hebt.

1. Sluit de Arduino Uno aan via USB.
2. Open de map `platformio-arduino-project/` in VS Code.
3. Klik op **Upload** (pijltje rechtsonder in de PlatformIO toolbar), of voer uit:
   ```bash
   cd platformio-arduino-project
   pio run --target upload
   ```
4. Controleer via de seriële monitor (baud 115200) dat de sensor data doorkomt.

> Na de eerste upload hoef je dit alleen te herhalen als je de firmware aanpast.

---

## Stap 2 — MQTT brug starten (Terminal 1)

Dit script leest de sensordata van de Arduino uit via USB en stuurt die naar HiveMQ.

1. Zorg dat de `.env` in `platformio-arduino-project/` ingevuld is (zie `.env.example`).
2. Open een terminal en voer uit:
   ```bash
   cd platformio-arduino-project
   python serial_mqtt_bridge.py
   ```
3. Goed teken: je ziet elke seconde `📏 Distance: X cm -> Publishing to MQTT`.

---

## Stap 3 — Lokale LLM starten (Terminal 2)

De app praat met een lokaal Qwen 2.5 model via Ollama.

**Eerste keer — model downloaden:**
```powershell
ollama pull qwen2.5:3b
```

**Elke keer opstarten:**
```powershell
ollama list
ollama run llama3.2
# Stop eerst de eventueel al draaiende Ollama tray-app:
taskkill /F /IM ollama.exe

# Start Ollama met CORS open:
$env:OLLAMA_ORIGINS = "*"
ollama serve
```

Open daarna een tweede terminal voor de lokale webserver:
```bash
cd ar-output-YOLO
node local-server.js
```

Goed teken: je ziet `Local AR server running → http://localhost:3001`.

---

## Stap 4 — HTTPS tunnel (Terminal 3)

De app heeft HTTPS nodig voor camera-toegang op mobiel. Gebruik ngrok als je lokaal test.

```bash
ngrok http 3001
```

Kopieer de `https://xxxx.ngrok-free.app` URL uit de output.

> Tip: voeg eenmalig je auth token toe zodat de tunnel stabiel blijft:
> `ngrok config add-authtoken JOUW_TOKEN` (gratis op dashboard.ngrok.com)

---

## Stap 5 — De app openen

### Vercel (productie / demo)

Open de Vercel-URL in je browser of op je telefoon:

```
https://bachelor-proef-seven.vercel.app
```

De Vercel deployment praat met Qwen via de NVIDIA NIM cloud API — daar heb je geen lokale Ollama voor nodig.

### Lokaal (eigen machine of WiFi)

Open na stap 4:
```
http://localhost:3001          ← op deze machine
http://192.168.0.142:3001      ← op elk apparaat op hetzelfde WiFi
https://xxxx.ngrok-free.app    ← mobiel / extern (HTTPS vereist voor camera)
```

Als je de lokale LLM wilt gebruiken via ngrok: open het AI-paneel → tik op ⚙ → plak:
```
https://xxxx.ngrok-free.app/api/chat
```

---

## Alles stoppen

Ga naar elk terminal venster en druk `Ctrl+C`.
