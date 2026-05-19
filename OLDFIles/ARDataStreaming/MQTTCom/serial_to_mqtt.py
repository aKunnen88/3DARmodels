import serial
import paho.mqtt.client as mqtt
import os
import ssl
from pathlib import Path
from dotenv import load_dotenv

# Laad de omgeving
load_dotenv()

# Configuratie
SERIAL_PORT = os.getenv("SERIAL_PORT", "COM5")
BAUD_RATE = int(os.getenv("BAUD_RATE", 115200))

MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT = int(os.getenv("MQTT_PORT", 8883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_TOPIC = "bachelor/sensor/distance"

# Serial setup
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)

# MQTT Client setup (v1.x style)
client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Verbonden met HiveMQ Cloud!")
    else:
        print(f"❌ Verbinding mislukt met code {rc}")

client.on_connect = on_connect

# Beveiliging instellen (Symmetrisch aan je JavaScript settings)
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS)

# Connectie maken
client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
client.loop_start()

print(f"📡 Start streaming van {SERIAL_PORT}...")

try:
    while True:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line and line.lstrip('-').isdigit():
                client.publish(MQTT_TOPIC, line)
                print(f"📤 Gepubliceerd: {line} cm")
except KeyboardInterrupt:
    print("\n🛑 Streaming gestopt door gebruiker")
finally:
    ser.close()
    client.loop_stop()
    client.disconnect()