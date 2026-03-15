#include <Arduino.h>

const int trigPin = 9;
const int echoPin = 10;

long duration;
float distanceCm;

void setup() {
    Serial.begin(115200);  // High baud rate for fast streaming
    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);
}

void loop() {
    // 1. Trigger the sensor
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);

    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // 2. Read the echo pulse
    duration = pulseIn(echoPin, HIGH, 20000);

    if (duration == 0) {
        Serial.println(-1);  // Error reading
    } else {
        // Calculate the distance (speed of sound is 340 m/s or 0.034 cm/us)
        distanceCm = duration * 0.0343 / 2;
        Serial.println((int)distanceCm);  // Print distance to Serial port
    }

    delay(100);  // 100ms interval
}
