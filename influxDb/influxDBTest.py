import os
from pathlib import Path
from dotenv import load_dotenv
import serial
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
import re
import requests # Voeg requests toe aan requirements.txt

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

# Pas poort en baud aan
ser = serial.Serial("COM5", 9600, timeout=1)
# Verwijder oude data die nog in de kabel/buffer zit
ser.reset_input_buffer()

print("Listening for Arduino data...")

while True:
    if ser.in_waiting > 0:
        # Lees de regel
        line = ser.readline().decode("utf-8", errors="ignore").strip()
        
        # DEBUG: Zie exact wat Arduino stuurt
        print(f"RAW: {line}")

        if "Afstand:" in line:
            # Verbeterde regex: zoek specifiek naar het getal NA 'Afstand:'
            match = re.search(r"Afstand:\s*([\d.]+)", line)
            
            if match:
                try:
                    distance_cm = float(match.group(1))
                    print(f"GEPARSED: {distance_cm} cm")

                    # Schrijf naar InfluxDB
                    point = (
                        Point("sensor_data")
                        .tag("device", "arduino-nano")
                        .field("distance_cm", distance_cm)
                    )
                    write_api.write(bucket=bucket, org=org, record=point)
                    
                    # Stuur naar Backend
                    server_url = "http://localhost:3000/update-sensor"
                    requests.post(server_url, json={"distance": distance_cm}, timeout=0.1)
                
                except (ValueError, requests.exceptions.RequestException) as e:
                    print(f"Error: {e}")
            
            # OPTIONEEL: Maak de buffer leeg als we achterlopen
            if ser.in_waiting > 100:
                ser.reset_input_buffer()