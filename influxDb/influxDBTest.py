import os
from pathlib import Path
from dotenv import load_dotenv
import serial
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
import re

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

while True:
    line = ser.readline().decode("utf-8", errors="ignore").strip()
    if not line:
        continue

    # Verwacht: "Afstand: 12.34 cm"
    if "Afstand" in line:
        match = re.search(r"([-+]?\d+(?:[.,]\d+)?)", line)
        if not match:
            continue
        distance_cm = float(match.group(1).replace(",", "."))
        point = (
            Point("sensor_data")
            .tag("device", "arduino-nano")
            .field("distance_cm", distance_cm)
            .time(None, WritePrecision.NS)
        )
        write_api.write(bucket=bucket, org=org, record=point)