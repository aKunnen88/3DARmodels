# AI Chat — Local Qwen Setup

This folder contains the serverless proxy used on Vercel. For local development you bypass it entirely and talk to Ollama directly through `local-server.js`.

---

## Starting the local Qwen model

You need three things running at the same time. Open a separate terminal for each.

**1. Start Ollama with CORS open**
```powershell
$env:OLLAMA_ORIGINS = "*"
ollama serve
```
If Ollama is already running in the system tray, kill it first:
```powershell
taskkill /F /IM ollama.exe
```
Then re-run the two lines above.

**2. Pull the model (first time only)**
```powershell
ollama pull qwen2.5:3b
```

**3. Start the local web server**
```powershell
node ar-output-YOLO/local-server.js
```
Opens `http://localhost:3001` (this machine) and `http://192.168.0.142:3001` (any device on the same WiFi).

**4. Expose via ngrok so HTTPS pages can reach it**
```powershell
ngrok http 3001
```
Copy the `https://xxxx.ngrok-free.app` URL from the output.

**5. In the app**
Open the AI panel → tap ⚙ → paste:
```
https://xxxx.ngrok-free.app/api/chat
```
The URL is saved automatically — you only need to update it when the ngrok tunnel restarts.

> **Tip:** Add your ngrok auth token once so tunnels are stable:
> `ngrok config add-authtoken YOUR_TOKEN` (free at dashboard.ngrok.com)

---

## Why Qwen 2.5?

**Qwen 2.5** (by Alibaba Cloud) is a family of open-weight language models that punch well above their weight for their size. The key reasons it was chosen here:

- **Genuinely small.** The 3B variant fits in ~2 GB of RAM and runs on virtually any modern laptop or desktop without a GPU — no expensive hardware required.
- **Strong instruction following.** Despite its size it reliably stays on topic, formats answers as plain text, and handles technical Q&A about electronics well.
- **Multilingual out of the box.** Works in Dutch, English, and most European languages without any extra configuration — useful since this project targets Belgian students.
- **Open weight.** The model can run fully offline. No data leaves the device, no API key is needed, and there is no usage cost.

### Local model vs cloud model

| | Local (Qwen 2.5 3B via Ollama) | Cloud (Qwen 2.5 7B via NVIDIA NIM) |
|---|---|---|
| **Privacy** | All data stays on device | Requests leave the network |
| **Cost** | Free, no limits | Free tier with rate limits |
| **Latency** | Fast on a good GPU, slow on CPU-only | Consistent ~1–2 s |
| **Quality** | Good for focused Q&A | Noticeably better reasoning |
| **Availability** | Requires your machine to be on | Always on |
| **Setup** | Ollama + ngrok | Just set NVIDIA_API_KEY in Vercel |

For a classroom demo or a presentation, **cloud** is more reliable. For privacy-sensitive use or offline environments, **local** is the right choice.

---

## Better models and why they were not used

### GPT-4o / Claude 3.5 Sonnet
These are the best models available for this type of task — they give richer explanations, better code suggestions, and handle edge-case questions much more naturally. They were not used because they require a paid API key per query. For a student project with no budget, running costs would scale unpredictably.

### Llama 3.1 8B (Meta)
A strong open-weight general-purpose model. It is slightly larger than Qwen 2.5 3B and requires more RAM, but the main reason it was not chosen is that it performs noticeably worse on technical, multilingual, and instruction-following tasks compared to Qwen at the same parameter count. Qwen simply offers better value per gigabyte for this domain.

### Mistral 7B / Mistral Nemo
Excellent at coding and structured reasoning. At 7B parameters it is too large to run comfortably on CPU-only machines, which rules it out as the default local option. It would be a valid cloud alternative.

### Phi-3 Mini (Microsoft)
Very small (3.8B) and surprisingly capable for its size. It was considered but lacks the multilingual depth and electronics-specific knowledge that Qwen 2.5 demonstrates in benchmarks.

---

## The core trade-off

Running a 3B model locally means you gain privacy, zero cost, and offline capability — but at the cost of reasoning depth. The model may give a correct but shallow answer where a larger model would explain *why* the HC-SR04 needs exactly 5 V, cite the relevant physics, and suggest a follow-up experiment. For the scope of this project (guided component recognition and basic Q&A), 3B is sufficient. If the project were extended to full circuit debugging or code generation, moving to at least 7B — either locally on a GPU machine or via the cloud fallback — would make a meaningful difference.
