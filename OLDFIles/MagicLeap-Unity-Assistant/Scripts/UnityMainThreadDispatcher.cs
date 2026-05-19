using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// UnityMainThreadDispatcher — allows code running on background threads
/// (e.g. MQTT callbacks) to safely execute on the Unity main thread.
///
/// SETUP: Add this script to a permanent GameObject (e.g. tagged "DontDestroyOnLoad").
/// </summary>
public class UnityMainThreadDispatcher : MonoBehaviour
{
    private static UnityMainThreadDispatcher _instance;
    private readonly Queue<Action> _executionQueue = new Queue<Action>();

    public static UnityMainThreadDispatcher Instance()
    {
        if (!_instance)
        {
            var go = new GameObject("UnityMainThreadDispatcher");
            DontDestroyOnLoad(go);
            _instance = go.AddComponent<UnityMainThreadDispatcher>();
        }
        return _instance;
    }

    public void Enqueue(Action action)
    {
        lock (_executionQueue) { _executionQueue.Enqueue(action); }
    }

    void Update()
    {
        lock (_executionQueue)
        {
            while (_executionQueue.Count > 0)
                _executionQueue.Dequeue().Invoke();
        }
    }
}
