using UnityEngine;
using UnityEngine.Networking;
using System.Text;
using System.Threading.Tasks;
using System;

namespace EHRAssistant.LLM
{
    public class LLMClient : MonoBehaviour
    {
        [Header("API Settings")]
        public string apiUrl = "https://api.example.com/v1/chat/completions";
        public string apiKey = "YOUR_API_KEY";
        public string modelName = "qwen2.5-coder";

        [Serializable]
        private class LLMRequest
        {
            public string model;
            public Message[] messages;
        }

        [Serializable]
        private class Message
        {
            public string role;
            public string content;
        }

        public async Task<string> SendQueryAsync(string systemContext, string userQuery)
        {
            LLMRequest reqData = new LLMRequest
            {
                model = modelName,
                messages = new Message[]
                {
                    new Message { role = "system", content = systemContext },
                    new Message { role = "user", content = userQuery }
                }
            };
            
            string jsonBody = JsonUtility.ToJson(reqData);
            byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);

            using (UnityWebRequest request = new UnityWebRequest(apiUrl, "POST"))
            {
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/json");
                request.SetRequestHeader("Authorization", $"Bearer {apiKey}");

                var operation = request.SendWebRequest();
                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                if (request.result == UnityWebRequest.Result.Success)
                {
                    return request.downloadHandler.text;
                }
                else
                {
                    Debug.LogError($"[LLM] Error: {request.error}");
                    return null;
                }
            }
        }
    }
}
