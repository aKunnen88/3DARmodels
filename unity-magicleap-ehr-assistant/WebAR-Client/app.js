// =============================================================
// Grabbable Panel Component
// =============================================================
AFRAME.registerComponent('grabbable-panel', {
    schema: { handle: { type: 'selector' } },
    init: function () {
        this.isDragging = false;
        const handleEl = this.data.handle || this.el;

        // Desktop mouse
        handleEl.addEventListener('mousedown', () => { this.isDragging = true; });
        handleEl.addEventListener('mouseup', () => { this.isDragging = false; });
        document.addEventListener('mouseup', () => { this.isDragging = false; });

        // Mobile touch (works in normal browser and as DOM overlay fallback)
        handleEl.addEventListener('touchstart', (e) => {
            this.isDragging = true;
        }, { passive: true });
        handleEl.addEventListener('touchend', () => { this.isDragging = false; }, { passive: true });
        document.addEventListener('touchend', () => { this.isDragging = false; }, { passive: true });

        // WebXR 'select' events (required when in Immersive AR session)
        this.el.sceneEl.addEventListener('selectstart', () => {
            const raycasterComp = this.el.sceneEl.querySelector('[raycaster]')?.components?.raycaster;
            if (!raycasterComp) return;
            if (raycasterComp.intersectedEls.includes(handleEl)) {
                this.isDragging = true;
            }
        });
        this.el.sceneEl.addEventListener('selectend', () => {
            this.isDragging = false;
        });
    },
    tick: function () {
        if (!this.isDragging) return;
        const cameraEl = document.querySelector('a-camera').object3D;
        const panelEl = this.el.object3D;
        const direction = new THREE.Vector3(0, 0, -1.5);
        direction.applyQuaternion(cameraEl.quaternion);
        panelEl.position.copy(cameraEl.position).add(direction);
        panelEl.quaternion.copy(cameraEl.quaternion);
    }
});

// =============================================================
// Application Logic
// =============================================================
document.addEventListener("DOMContentLoaded", () => {

    // --- Sensor Data ---
    let currentSensorValue = "Unknown";
    const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
    const topic = 'hospital/sensors/ultrasonic';
    const client = mqtt.connect(brokerUrl);

    client.on('connect', () => {
        document.getElementById('status-indicator').innerText = '🟢 MQTT Connected';
        document.getElementById('status-indicator').style.color = '#0f0';
        client.subscribe(topic);
    });

    client.on('error', () => {
        document.getElementById('status-indicator').innerText = '🔴 MQTT Error';
    });

    client.on('message', (t, message) => {
        const val = parseFloat(message.toString());
        if (!isNaN(val)) {
            currentSensorValue = val;
            const el = document.getElementById('sensor-text');
            if (el) el.setAttribute('value', `${val.toFixed(2)} cm`);
        }
    });

    // --- Chat History ---
    let historyText = "";
    function appendChat(role, msg) {
        const prefix = role === "user" ? "You: " : "AI: ";
        historyText += `${prefix}${msg}\n\n`;
        const lines = historyText.split('\n');
        if (lines.length > 20) historyText = lines.slice(lines.length - 20).join('\n');
        const el = document.getElementById('chat-history');
        if (el) el.setAttribute('value', historyText);
    }

    // --- LLM Integration ---
    async function sendToLLM(query) {
        if (!query || query.trim() === "") return;
        appendChat("user", query);
        appendChat("ai", "⏳ Thinking...");

        const systemPrompt = `You are an Arduino & medical XR expert assistant. The AR sensor is measuring ${currentSensorValue} cm in real-time. Answer concisely.`;

        try {
            const response = await fetch('/api/chat', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "qwen/qwen3.5-122b-a10b",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: query }
                    ],
                    max_tokens: 512
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || response.statusText);

            const aiMessage = data.choices?.[0]?.message?.content || "No response from model.";
            // Replace the "Thinking..." placeholder
            historyText = historyText.replace("AI: ⏳ Thinking...\n\n", "");
            appendChat("ai", aiMessage);
        } catch (e) {
            historyText = historyText.replace("AI: ⏳ Thinking...\n\n", "");
            appendChat("ai", "⚠️ Error: " + e.message);
        }
    }

    // --- UI: Send Button ---
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');

    function doSend() {
        const query = chatInput.value.trim();
        if (query !== "") {
            sendToLLM(query);
            chatInput.value = "";
        }
    }

    sendBtn.addEventListener('click', doSend);
    // Also bind touchend (NOT touchstart) to avoid ghost-events
    sendBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        doSend();
    });
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSend();
    });

    // --- Speech Recognition ---
    const micBtn = document.getElementById('mic-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "nl-NL";

        recognition.onstart = () => {
            micBtn.style.background = "#ff4444";
            chatInput.placeholder = "🎙 Listening...";
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            sendToLLM(transcript);
        };
        recognition.onerror = (event) => {
            micBtn.style.background = "#333";
            chatInput.placeholder = "Mic error: " + event.error;
            if (event.error === 'not-allowed') {
                alert("Allow microphone access in browser settings to use voice chat.");
            }
        };
        recognition.onend = () => {
            micBtn.style.background = "#333";
            chatInput.placeholder = "Ask the EHR Assistant...";
        };

        function startMic() {
            try { recognition.start(); } catch (e) { console.warn(e); }
        }

        micBtn.addEventListener('click', startMic);
        micBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            startMic();
        });
    } else {
        micBtn.style.display = "none";
    }
});
