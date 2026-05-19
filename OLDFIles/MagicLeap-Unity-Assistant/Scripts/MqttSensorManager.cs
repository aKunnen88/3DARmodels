using System;
using System.Collections;
using UnityEngine;
using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Client.Options;
using TMPro;

/// <summary>
/// MqttSensorManager — connects to HiveMQ, subscribes to the ultrasonic sensor topic,
/// and updates any registered UI elements with the live distance value.
///
/// SETUP:
///   1. Attach this script to an empty GameObject in your scene (e.g. "MQTTManager").
///   2. Set SensorValueText to a TextMeshPro object in the scene.
///   3. Press Play (Editor) or deploy to Magic Leap 2.
///
/// DEPENDENCIES (install via Unity Package Manager → "Add package from git URL"):
///   MQTTnet for Unity: https://github.com/dotnet-mqtt/mqtt-unity-plugin
///   OR use M2Mqtt: https://github.com/CE-Studios/Unity-MQTT
/// </summary>
public class MqttSensorManager : MonoBehaviour
{
    [Header("MQTT Broker Settings")]
    [Tooltip("HiveMQ public broker WebSocket endpoint")]
    public string BrokerHost = "broker.hivemq.com";
    public int    BrokerPort = 1883;
    public string Topic      = "hospital/sensors/ultrasonic";
    public string ClientId   = "unity-magicleap-client";

    [Header("UI References")]
    [Tooltip("TextMeshPro element that shows the distance value")]
    public TextMeshProUGUI SensorValueText;
    [Tooltip("TextMeshPro element that shows connection status")]
    public TextMeshProUGUI StatusText;

    [Header("Sensor Thresholds (for colour coding)")]
    public float NearThreshold  = 30f;   // cm — turns red below this
    public float FarThreshold   = 100f;  // cm — turns green above this

    // ── Runtime state ──────────────────────────────────────────────────────
    private IMqttClient     _client;
    private float           _latestDistance = -1f;
    private bool            _newDataReady   = false;

    // ═══════════════════════════════════════════════════════════════════════
    async void Start()
    {
        SetStatus("🔴 Connecting to MQTT…");
        var factory = new MqttFactory();
        _client = factory.CreateMqttClient();

        var options = new MqttClientOptionsBuilder()
            .WithClientId(ClientId + "_" + Guid.NewGuid().ToString("N").Substring(0, 6))
            .WithTcpServer(BrokerHost, BrokerPort)
            .WithCleanSession()
            .Build();

        _client.UseApplicationMessageReceivedHandler(e =>
        {
            string payload = System.Text.Encoding.UTF8.GetString(e.ApplicationMessage.Payload);
            if (float.TryParse(payload, out float dist))
            {
                _latestDistance = dist;
                _newDataReady   = true;
            }
        });

        _client.UseConnectedHandler(async e =>
        {
            SetStatus("🟢 MQTT Connected");
            await _client.SubscribeAsync(new MqttTopicFilterBuilder()
                .WithTopic(Topic).Build());
        });

        _client.UseDisconnectedHandler(async e =>
        {
            SetStatus("🔴 MQTT Disconnected — Reconnecting…");
            await System.Threading.Tasks.Task.Delay(3000);
            try { await _client.ConnectAsync(options); }
            catch { SetStatus("❌ Cannot reconnect"); }
        });

        try
        {
            await _client.ConnectAsync(options);
        }
        catch (Exception ex)
        {
            SetStatus($"❌ MQTT Error: {ex.Message}");
            Debug.LogError($"[MqttSensorManager] {ex}");
        }
    }

    // ── Main-thread UI update ───────────────────────────────────────────────
    void Update()
    {
        if (!_newDataReady) return;
        _newDataReady = false;

        float dist = _latestDistance;

        if (SensorValueText != null)
        {
            SensorValueText.text = dist >= 0
                ? $"{dist:F1} <size=60%>cm</size>"
                : "– –";

            // Colour-code based on threshold
            if      (dist < 0)                SensorValueText.color = Color.gray;
            else if (dist <= NearThreshold)   SensorValueText.color = new Color(1f, 0.3f, 0.3f);  // red
            else if (dist >= FarThreshold)    SensorValueText.color = new Color(0.3f, 1f, 0.6f);  // green
            else                              SensorValueText.color = new Color(0f,  0.9f, 0.8f); // cyan
        }
    }

    async void OnDestroy()
    {
        if (_client != null && _client.IsConnected)
            await _client.DisconnectAsync();
    }

    // ── Helper ──────────────────────────────────────────────────────────────
    private void SetStatus(string msg)
    {
        // Dispatch to main thread (MQTT callbacks come from a thread pool)
        UnityMainThreadDispatcher.Instance()?.Enqueue(() =>
        {
            if (StatusText != null) StatusText.text = msg;
            Debug.Log($"[MQTT] {msg}");
        });
    }
}
