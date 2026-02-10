#include <Arduino.h>

const int ledPin = LED_BUILTIN;
const int trigPin = 9;
const int echoPin = 10;

long duration;
float distanceCm;

void setup() {
    pinMode(ledPin, OUTPUT);
    Serial.begin(9600);

    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);
}

void loop() {
    //   digitalWrite(ledPin, HIGH);
    //   Serial.println("LED:ON");
    //   delay(1000);

    //   digitalWrite(ledPin, LOW);
    //   Serial.println("LED:OFF");
    //   delay(1000);

    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);

    digitalWrite(trigPin,HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    duration = pulseIn(echoPin, HIGH, 20000);

     if (duration == 0) {
        Serial.println("Geen meting");
    } else {
        distanceCm = duration * 0.0343 / 2;
        Serial.print("Afstand: ");
        Serial.print(distanceCm);
        Serial.println(" cm");
    }

    delay(500);
}
