from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import asyncio
import json
import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_clients = {}

@app.post("/update-sensor")
async def update_sensor(data: dict):
    # Broadcast de sensor data naar alle verbonden AR clients
    for cid, client in connected_clients.items():
        try:
            await client.send_json({"type": "sensor", "distance": data["distance"]})
        except:
            pass
    return {"status": "sent"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    connected_clients[client_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Broadcast naar alle clients
            for cid, client in connected_clients.items():
                try:
                    await client.send_json(message)
                except:
                    pass
    except:
        connected_clients.pop(client_id, None)

@app.get("/health")
async def health():
    return {"status": "ok", "clients": len(connected_clients)}

@app.get("/")
async def root():
    return FileResponse("view.html")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)