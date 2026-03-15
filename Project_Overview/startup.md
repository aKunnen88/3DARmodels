# AR Assistant - Stappenplan Opstarten

Welkom bij de opstartgids van het EHR AR Assistant project! Om alles vlekkeloos te laten werken (de sensor data, de lokale AI server, en de Augmented Reality interface op je gsm), moet je altijd **3 aparte terminal vensters** openen. 

Volg de onderstaande stappen in de juiste volgorde om het hele systeem in de lucht te krijgen.

---

## 🛠️ Stap 1: De Arduino Datastroom Starten
Dit script leest de afstanden van je fysieke echoscanner/botssensor uit via de USB-kabel en streamt deze live naar het cloud MQTT platform (HiveMQ).

1. Verbind je Arduino Uno met je laptop via een USB kabel.
2. Open je eerste Terminal venster (`Windows PowerShell` of `Command Prompt`).
3. Ga naar de juiste map met dit commando:
   ```bash
   cd c:\Projects\BachelorProef\platformio-arduino-project
   ```
4. Start de python databrug:
   ```bash
   python serial_mqtt_bridge.py
   ```
   *✅ Als dit goed gaat, zie je in de terminal elke seconde verschijnen: `"Distance: X cm -> Publishing to MQTT"`*

---

## 🧠 Stap 2: De AI (LLM) Server Starten
Dit script zorgt ervoor dat je telefoon via een veilige verbinding kan praten met de AI (Qwen 3.5). Tegelijkertijd host dit script de AR-websitebestanden lokaal.

1. Laat de vorige terminal open, en **open een TWEEDE, heel nieuw Terminal venster**.
2. Ga naar de WebAR map met dit commando:
   ```bash
   cd c:\Projects\BachelorProef\unity-magicleap-ehr-assistant\WebAR-Client
   ```
3. Start de lokale server:
   ```bash
   python server.py
   ```
   *✅ Als dit goed gaat, zie je in de terminal staan: `"NVIDIA API KEY loaded successfully... Starting WebAR Server op http://localhost:8000..."`*

---

## 📱 Stap 3: De AR Bril / Telefoon Verbinden (ngrok)
Je telefoon (Safari of WebXR Viewer) zit op een ander netwerk of apparaat dan je laptop. Omdat de AR-app lokaal op je laptop draait, moeten we een 'tunnel' naar buiten maken zodat je telefoon er veilig (HTTPS) bij kan. Hiervoor gebruiken we `ngrok`.

1. Laat de andere twee terminals netjes open staan, en **open nu een DERDE (en laatste) Terminal venster**.
2. Start hierin het ngrok tunnel commando:
   ```bash
   ngrok http 8000
   ```
   *Dit zorgt ervoor dat ngrok poort 8000 (waar je AI server van hierboven op draait) doorstuurt naar het web.*
3. Kijk in de terminal en kopieer de link die staat achter `Forwarding` (bijvoorbeeld: `https://abcd-123.ngrok-free.app`).

---

## 🚀 Stap 4: Ervaar de AR
1. Pak je smartphone.
2. Open de **"WebXR Viewer"** app (of Safari als je iOS 17 AR flags aan staan).
3. Plak de HTTPS link die je net in Stap 3 hebt gekopieerd uit ngrok, en ga naar de website.
4. Zodra de pagina laadt: **Druk rechtsonder op de "AR" bril knop** om je camera-modus en AR panelen in te schakelen.
5. Houd de "DRAG" knop in de 3D-app in om het scherm te slepen.
6. Klik op de microfoon 🎤 om direct tegen the Qwen-AI (Arduino Expert) te praten!

*(Wil je alles afsluiten? Ga gewoon naar elk van je drie terminal vensters en druk op `Ctrl+C` op je toetsenbord om de commandos te stoppen!)*
