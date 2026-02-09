


+-------------------+
| Arduino Devices    |
| (sensor data)      |
+---------+---------+
          |
          | MQTT (lichtgewicht, betrouwbaar)
          v
+-------------------+
| MQTT Broker       |
| (Mosquitto / HiveMQ)|
+---------+---------+
          |
          | MQTT Client / Ingest Service
          | - Verzamelt data
          | - Slaat op in database
          | - Publiceert events naar NATS
          v
+-------------------+              +----------------------+
| Time Series DB     |  <--------> | NATS Streaming Server |  (JetStream)
| (InfluxDB,        |             | - Event bus voor      |
|  TimescaleDB, etc.)|             |   realtime streaming  |
+---------+---------+              +-----------+----------+
          |                                    |
          |                                    | Publish/Subscribe
          |                                    v
          |                        +--------------------------+
          |                        | LLM Microservice          |
          |                        | - Verwerkt data           |
          |                        | - Analyseert & verrijkt  |
          |                        +-------------+------------+
          |                                      |
          |                                      | NATS / WebSocket
          v                                      v
+-------------------+               +------------------------+
| AR Web / Mobile    | <---------→  | Per-student AR View    |
| Application       |  (Realtime data stream, low latency)    |
+-------------------+               +------------------------+



Uitleg per verbinding:
    Arduino → MQTT Broker:
    Sensoren sturen data via MQTT, ideaal voor embedded apparaten.

    MQTT Broker → Ingest Service:
    Backend service consumeert MQTT data, verwerkt en slaat op in database.

    Database ↔ NATS Streaming:
    Bij opslag van data publiceert backend events naar NATS JetStream voor realtime streaming.

    NATS → LLM Microservice:
    LLM ontvangt data events voor analyse, voorspellingen, anomaliedetectie etc.

    NATS/WebSocket → AR View:
    Per student worden via NATS of WebSocket realtime data en analyses gestuurd naar hun persoonlijke AR interface.



Waarom zo?

Schaalbaar: Door NATS als event bus kan je makkelijk meerdere clients bedienen en uitbreiden.

Realtime: NATS zorgt voor lage latency en betrouwbare levering.

Modulair: Backend, database, LLM, en AR views zijn losgekoppeld.

Persoonlijk: Elke student krijgt data die specifiek voor hen relevant is via AR.