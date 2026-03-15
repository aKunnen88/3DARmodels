using System;
using System.Text;
using UnityEngine;
using uPLibrary.Networking.M2Mqtt;
using uPLibrary.Networking.M2Mqtt.Messages;

namespace EHRAssistant.MQTT
{
    public class MqttManager : MonoBehaviour
    {
        [Header("Broker Settings")]
        public string brokerAddress = "broker.hivemq.com";
        public int brokerPort = 1883;

        [Header("Topic Settings")]
        public string subscribeTopic = "hospital/sensors/ultrasonic";
        
        // Event for other scripts to subscribe to
        public event Action<string, float> OnSensorDataReceived;

        private MqttClient client;

        void Start()
        {
            ConnectToBroker();
        }

        private void ConnectToBroker()
        {
            try
            {
                client = new MqttClient(brokerAddress, brokerPort, false, null, null, MqttSslProtocols.None);
                string clientId = Guid.NewGuid().ToString();
                
                client.MqttMsgPublishReceived += Client_MqttMsgPublishReceived;
                
                client.Connect(clientId);
                Debug.Log($"[MQTT] Connected to {brokerAddress}");

                client.Subscribe(new string[] { subscribeTopic }, new byte[] { MqttMsgBase.QOS_LEVEL_AT_MOST_ONCE });
                Debug.Log($"[MQTT] Subscribed to {subscribeTopic}");
            }
            catch (Exception e)
            {
                Debug.LogError($"[MQTT] Connection failed: {e.Message}");
            }
        }

        private void Client_MqttMsgPublishReceived(object sender, MqttMsgPublishEventArgs e)
        {
            string message = Encoding.UTF8.GetString(e.Message);
            // Debug.Log($"[MQTT] Received: {message}");

            // Basic parsing assuming message is a float value
            if (float.TryParse(message, out float sensorValue))
            {
                // Must route to main thread if updating unity objects, 
                // but events can be fired here and handled by main thread queue
                MainThreadDispatcher.Enqueue(() => {
                    OnSensorDataReceived?.Invoke(e.Topic, sensorValue);
                });
            }
        }

        void OnDestroy()
        {
            if (client != null && client.IsConnected)
            {
                client.Disconnect();
            }
        }
    }
}
