# Example Scene: EHR Assistant

This document outlines how an AI Agent can set up a basic Unity scene that ties together the IoT sensors, time-series data, and LLM functionality on the Magic Leap 2.

## Scene Hierarchy

1. **XROrigin (VR/AR)**
   - Configured for Magic Leap. The Main Camera is attached directly to the origin.
2. **Managers (Empty GameObject)**
   - Attach `MqttManager.cs` (Configure HiveMQ broker address and ultrasonic topics)
   - Attach `InfluxDBManager.cs` (Configure base URL, org, bucket)
   - Attach `LLMClient.cs` (Configure API endpoint and model)
3. **UI Canvas (World Space)**
   - Add a `TextMeshPro` Text Component for displaying contextual chats and LLM responses.
4. **Sensor AR Label (Empty GameObject)**
   - Place visibly in the scene where the ultrasonic sensor might exist physically.
   - Attach `SensorVisualizer.cs`.
   - Add a child `TextMeshPro` facing the user. Link it to `SensorVisualizer`.

## Wiring it Up

1. Register an event listener to `MqttManager`'s `OnSensorDataReceived`.
2. When data is received, update the `SensorVisualizer` via its `UpdateSensorValue` method.
3. Keep a circular buffer of the last 10 sensor readings in an overarching GameManager.
4. Setup an Interaction (e.g. Magic Leap Voice Intent "Analyze sensor" or a virtual floating button).
5. When the Interaction fires, the app takes the circular buffer, builds a system context (e.g., "The user is looking at an ultrasonic sensor. Latest readings: [x, y, z] cm."), and passes it to the `LLMClient` via `SendQueryAsync`.
6. The `LLMClient` responds with a text-based JSON analysis, which is parsed and rendered on the Main UI Canvas.
