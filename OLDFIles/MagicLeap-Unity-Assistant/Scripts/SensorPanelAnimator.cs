using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// SensorPanelAnimator — animates the sensor panel visual elements:
///   • Pulses the sensor value when a new reading arrives
///   • Shows a waveform bar graph of the last N readings
///   • Spins a radar icon while MQTT is active
///
/// SETUP: Attach to the same GameObject as MqttSensorManager,
/// then wire up the serialized fields in the Inspector.
/// </summary>
public class SensorPanelAnimator : MonoBehaviour
{
    [Header("References")]
    public MqttSensorManager MqttManager;
    public TextMeshProUGUI   SensorValueText;
    public Image[]           HistoryBars;  // array of 10 Image elements (bar graph)
    public RectTransform     RadarIcon;

    [Header("Animation Settings")]
    public float PulseScale    = 1.15f;
    public float PulseDuration = 0.15f;
    public float RadarSpeed    = 60f;  // degrees/sec

    // ── History buffer ──────────────────────────────────────────────────────
    private float[]  _history;
    private int      _histIndex = 0;
    private float    _lastValue = -1f;
    private bool     _pulsing   = false;
    private float    _pulseTime = 0f;
    private Vector3  _baseScale;

    void Start()
    {
        int bars = HistoryBars != null ? HistoryBars.Length : 10;
        _history   = new float[bars];
        _baseScale = SensorValueText != null ? SensorValueText.transform.localScale : Vector3.one;
    }

    void Update()
    {
        if (RadarIcon != null)
            RadarIcon.Rotate(Vector3.forward, RadarSpeed * Time.deltaTime);

        if (MqttManager == null || SensorValueText == null) return;

        // detect new value by checking public field (or you can add an event/delegate)
        // For simplicity, we re-read the text value — replace with event if desired
        string raw = SensorValueText.text.Replace(" <size=60%>cm</size>", "").Trim();
        if (float.TryParse(raw, out float val) && Math.Abs(val - _lastValue) > 0.1f)
        {
            _lastValue = val;
            AddToHistory(val);
            TriggerPulse();
        }

        AnimatePulse();
        UpdateBars();
    }

    private void AddToHistory(float v)
    {
        _history[_histIndex] = v;
        _histIndex = (_histIndex + 1) % _history.Length;
    }

    private void TriggerPulse()
    {
        _pulsing  = true;
        _pulseTime = 0f;
    }

    private void AnimatePulse()
    {
        if (!_pulsing) return;
        _pulseTime += Time.deltaTime;
        float t = _pulseTime / PulseDuration;

        float scale = _pulseTime < PulseDuration * 0.5f
            ? Mathf.Lerp(1f, PulseScale, t * 2f)
            : Mathf.Lerp(PulseScale, 1f, (t - 0.5f) * 2f);

        SensorValueText.transform.localScale = _baseScale * scale;

        if (_pulseTime >= PulseDuration)
        {
            _pulsing = false;
            SensorValueText.transform.localScale = _baseScale;
        }
    }

    private void UpdateBars()
    {
        if (HistoryBars == null || HistoryBars.Length == 0) return;
        float maxVal = 400f; // HC-SR04 max range

        for (int i = 0; i < HistoryBars.Length; i++)
        {
            int idx  = (_histIndex - HistoryBars.Length + i + _history.Length) % _history.Length;
            float pct = Mathf.Clamp01(_history[idx] / maxVal);
            var bar = HistoryBars[i];
            if (bar == null) continue;
            var rt = bar.rectTransform;
            rt.anchorMin = new Vector2((float)i / HistoryBars.Length, 0);
            rt.anchorMax = new Vector2((float)(i + 1) / HistoryBars.Length, pct);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            // Gradient: low = green, high = red
            bar.color = Color.Lerp(new Color(0f, 1f, 0.6f), new Color(1f, 0.3f, 0.3f), pct);
        }
    }
}
