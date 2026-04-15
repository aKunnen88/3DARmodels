import serial
import serial.tools.list_ports
import paho.mqtt.client as mqtt
import time
import os
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT   = int(os.getenv("MQTT_PORT", 8883))
MQTT_TOPIC  = os.getenv("MQTT_TOPIC")
MQTT_USER   = os.getenv("MQTT_USER")
MQTT_PASS   = os.getenv("MQTT_PASS")
BAUD_RATE = 115200

def find_arduino_port():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if "Arduino" in port.description or "CH340" in port.description or "usbmodem" in port.device.lower():
            return port.device
    
    # Fallback to the first available port if specific names aren't found
    if len(ports) > 0:
        return ports[0].device
    return None

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT Broker: {MQTT_BROKER}")
    else:
        print(f"❌ Failed to connect, return code {rc}")

def main():
    print("Searching for Arduino serial port...")
    port_name = find_arduino_port()
    
    if not port_name:
        print("❌ Could not find an Arduino connected via USB. Please specify it manually.")
        # port_name = "COM3" # Uncomment and change if auto-detect fails
        return

    print(f"🔗 Connecting to Arduino on {port_name} at {BAUD_RATE} baud...")
    
    try:
        ser = serial.Serial(port_name, BAUD_RATE, timeout=1)
        time.sleep(2) # Wait for Arduino to reset
    except Exception as e:
        print(f"❌ Error opening serial port: {e}")
        return

    print("🔗 Connecting to MQTT...")
    client = mqtt.Client()
    client.on_connect = on_connect
    client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.tls_set()  # enables TLS for port 8883

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"❌ Error connecting to MQTT: {e}")
        return

    print(f"📡 Forwarding data from {port_name} to MQTT topic '{MQTT_TOPIC}'...")
    print("Press Ctrl+C to stop.")

    try:
        while True:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8').strip()
                if line and line != "-1": # Ignore -1 error values if using the platformio sketch
                    try:
                        # Extract just the number if there's text, or use it directly
                        distance = float(line)
                        print(f"📏 Distance: {distance} cm -> Publishing to MQTT")
                        client.publish(MQTT_TOPIC, str(distance))
                    except ValueError:
                        # If the arduino is sending 'Distance: 10 cm' instead of just '10'
                        if "Distance:" in line:
                            parts = line.split(":")
                            if len(parts) > 1:
                                val = parts[1].replace("cm", "").strip()
                                print(f"📏 Distance: {val} cm -> Publishing to MQTT")
                                client.publish(MQTT_TOPIC, val)
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        ser.close()
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
