import os
from pathlib import Path
from dotenv import load_dotenv
import serial
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
import re
import asyncio
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import threading

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

token = os.getenv("INFLUXDB_TOKEN")
org = os.getenv("INFLUXDB_ORG")
bucket = os.getenv("INFLUXDB_BUCKET")
url = os.getenv("INFLUXDB_URL")

if not all([token, org, bucket, url]):
    raise SystemExit(f"Error: .env variabelen niet gevonden in {env_path}")

client = InfluxDBClient(url=url, token=token, org=org)
write_api = client.write_api(write_options=SYNCHRONOUS)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to store latest distance
latest_distance = None

def read_serial():
    """Read from Arduino and write to InfluxDB"""
    ser = serial.Serial("COM5", 9600, timeout=1)
    
    while True:
        line = ser.readline().decode("utf-8", errors="ignore").strip()
        if not line:
            continue

        if "Afstand" in line:
            match = re.search(r"([-+]?\d+(?:[.,]\d+)?)", line)
            if not match:
                continue
            distance_cm = float(match.group(1).replace(",", "."))
            
            # Store for WebSocket broadcast
            global latest_distance
            latest_distance = distance_cm
            
            # Write to InfluxDB
            point = (
                Point("sensor_data")
                .tag("device", "arduino-nano")
                .field("distance_cm", distance_cm)
                .time(None, WritePrecision.NS)
            )
            write_api.write(bucket=bucket, org=org, record=point)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    while True:
        if latest_distance is not None:
            await websocket.send_json({
                "distance": latest_distance,
                "unit": "cm"
            })
        await asyncio.sleep(0.5)

if __name__ == "__main__":
    # Start serial reader in background thread
    serial_thread = threading.Thread(target=read_serial, daemon=True)
    serial_thread.start()
    
    # Start WebSocket server
    uvicorn.run(app, host="0.0.0.0", port=8000)