using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace EHRAssistant.InfluxDB
{
    public class InfluxDBManager : MonoBehaviour
    {
        [Header("InfluxDB Settings")]
        public string influxUrl = "http://localhost:8086";
        public string organization = "my-org";
        public string bucket = "sensors";
        public string apiToken = "YOUR_API_TOKEN";

        /// <summary>
        /// Queries the historic data for a particular sensor using Flux.
        /// </summary>
        public void QueryHistoricData(string measurement, string field, Action<string> onSuccess, Action<string> onError)
        {
            StartCoroutine(PerformQuery(measurement, field, onSuccess, onError));
        }

        private IEnumerator PerformQuery(string measurement, string field, Action<string> onSuccess, Action<string> onError)
        {
            string url = $"{influxUrl}/api/v2/query?org={organization}";
            
            // Example flux query getting the last 15 minutes of data
            string fluxQuery = $"from(bucket: \"{bucket}\") |> range(start: -15m) |> filter(fn: (r) => r._measurement == \"{measurement}\" and r._field == \"{field}\")";
            
            string jsonBody = "{\"query\": \"" + fluxQuery.Replace("\"", "\\\"") + "\"}";
            byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);

            using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
            {
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/json");
                request.SetRequestHeader("Authorization", $"Token {apiToken}");

                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    onSuccess?.Invoke(request.downloadHandler.text);
                }
                else
                {
                    onError?.Invoke(request.error);
                }
            }
        }
    }
}
