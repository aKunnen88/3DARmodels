from fastapi import FastAPI
from fastapi.websockets import WebSocket
import paho.mqtt.client as mqtt
import json
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT = int(os.getenv("MQTT_PORT", 8883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_TOPIC = "bachelor/sensor/distance"

# WebSocket connecties bijhouden
active_connections = []

# MQTT client
mqtt_client = mqtt.Client()

def on_message(client, userdata, msg):
    global latest_distance
    try:
        distance = int(msg.payload.decode())
        latest_distance = distance
        print(f"MQTT ontvangen: {distance} cm")
        
        # Broadcast naar alle WebSocket clients
        asyncio.create_task(broadcast_to_clients({
            "type": "sensor",
            "distance": distance
        }))
    except ValueError:
        pass

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Server MQTT Connected!")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"Connection failed with code {rc}")

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message
mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
mqtt_client.tls_set()  # TLS/SSL voor poort 8883
mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
mqtt_client.loop_start()

async def broadcast_to_clients(data):
    for connection in active_connections:
        try:
            await connection.send_json(data)
        except:
            pass

@app.websocket("/ws/sensor")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            await broadcast_to_clients({"type": "ping", "data": data})
    except:
        active_connections.remove(websocket)

@app.get("/api/distance")
async def get_distance():
    return {"distance": latest_distance}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000, reload=False)