#include <Arduino.h>

const int ledPin = LED_BUILTIN;
const int trigPin = 9;
const int echoPin = 10;

long duration;
float distanceCm;

void setup() {
    pinMode(ledPin, OUTPUT);
    Serial.begin(115200);  // Verhoog naar 115200 voor sneller streamen
    
    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);
}

void loop() {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);

    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    duration = pulseIn(echoPin, HIGH, 20000);

    if (duration == 0) {
        Serial.println(-1);  // Error waarde
    } else {
        distanceCm = duration * 0.0343 / 2;
        Serial.println((int)distanceCm);  // Alleen het getal
    }

    delay(100);  // 100ms interval
}
