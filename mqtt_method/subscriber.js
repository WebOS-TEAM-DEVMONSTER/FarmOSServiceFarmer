const mqtt = require('mqtt');
import {options} from './info.js';

// MQTT 브로커에 연결 (로컬 브로커 사용 시 'mqtt://localhost')
const client = mqtt.connect(options);

// MQTT 브로커와 연결되었을 때 실행되는 함수
client.on('connect', () => {
    console.log('Connected to MQTT broker');

    // 'sensor/temperature' 토픽 구독
    client.subscribe('sensor/temperature', (err) => {
        if (!err) {
            console.log('Subscribed to temperature topic');
        } else {
            console.error('Subscription error:', err);
        }
    });
});

// 메시지를 수신할 때마다 실행되는 함수
client.on('message', (topic, message) => {
    // 메시지와 관련된 토픽 확인
    if (topic === 'sensor/temperature') {
        // 메시지 출력
        console.log(`Received temperature data: ${message.toString()}`);
    }
});

// 오류 발생 시 처리
client.on('error', (err) => {
    console.error('Connection error:', err);
    client.end();
});