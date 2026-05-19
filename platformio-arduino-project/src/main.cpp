#include <Arduino.h>

const int ledPin    = 4;
const int buzzerPin = 3;
const int trigPin   = 9;
const int echoPin   = 10;

long duration;
float distanceCm;

void setup() {
    pinMode(ledPin,    OUTPUT);
    pinMode(buzzerPin, OUTPUT);
    pinMode(trigPin,   OUTPUT);
    pinMode(echoPin,   INPUT);
    Serial.begin(115200);
}

void loop() {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);

    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    duration = pulseIn(echoPin, HIGH, 20000);

    if (duration == 0) {
        digitalWrite(ledPin,    LOW);
        digitalWrite(buzzerPin, LOW);
        Serial.println(-1);
    } else {
        distanceCm = duration * 0.0343 / 2;
        bool alert = distanceCm < 15;
        digitalWrite(ledPin,    alert ? HIGH : LOW);
        digitalWrite(buzzerPin, alert ? HIGH : LOW);
        Serial.println((int)distanceCm);
    }

    delay(100);
}
