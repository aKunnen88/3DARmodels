import os
from pathlib import Path
from dotenv import load_dotenv
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from influxdb_client.client.query_api import QueryApi  # Verander QueryAPI naar QueryApi

# Bepaal het pad naar de .env file (één map hoger dan waar dit script staat)
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Gegevens ophalen uit de .env
token = os.getenv("INFLUXDB_TOKEN")
org = os.getenv("INFLUXDB_ORG")
bucket = os.getenv("INFLUXDB_BUCKET")
url = os.getenv("INFLUXDB_URL")

# Check of alle variabelen zijn geladen
if not all([token, org, bucket, url]):
    print(f"Error: .env variabelen niet gevonden in {env_path}")
    exit(1)

client = InfluxDBClient(url=url, token=token, org=org)
write_api = client.write_api(write_options=SYNCHRONOUS)
query_api = client.query_api()

# Maak een datapunt aan
point = Point("sensor_data") \
    .tag("device", "arduino-nano") \
    .field("temperature", 27.5) \

# Schrijf de data
write_api.write(bucket=bucket, org=org, record=point)

# Lees data terug
query = f'''
from(bucket:"{bucket}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor_data")
  |> filter(fn: (r) => r._field == "temperature")
'''

result = query_api.query(org=org, query=query)

print("Temperature values:")
for table in result:
    for record in table.records:
        print(f"  Time: {record.get_time()}, Value: {record.get_value()}")

client.close()