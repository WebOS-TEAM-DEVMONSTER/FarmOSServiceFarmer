/*
 * Copyright (c) 2020-2024 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const pkgInfo = require('./package.json');
const Service = require('webos-service');
const mqtt = require('mqtt');
const moment = require('moment');
const service = new Service(pkgInfo.name); // Create service by service name on package.json
const logHeader = "[" + pkgInfo.name + "]";


let cancel = true;
let active = false;

const BROKER_ADDRESS = 'mqtt://52.63.12.126';  // 브로커 주소 (mqtt://를 붙임)
const PORT = 1883;  // MQTT 기본 포트

let TOPIC = "defaultTopic";
let FARM_ID = 'exampleFarmId';  // 농장 ID
        // 전역 변수 초기화
let previousTime = moment();
//온도
let temperature = 0;
let avgTemperature = 0;

//습도
let humidity = 0;
let avgHumidity = 0;

//토양 수분
let moistureOfSoil = 0;
let avgMoistureOfSoil = 0;

//토양 ph
let phOfSoil = 0;
let avgPhOfSoil = 0;

//토양 ec
let ecOfSoil = 0;
let avgEcOfSoil = 0;

let imageEvaluation = "없음";

let cnt = 0;
let currentTime = moment();


service.register("serviceOn", (message) => {

    let val = !active;
    if(active == false) {
        active = true; // 서비스 활성화
        cancel = false; // 서비스 중지 상태 해제
        console.log(logHeader, message);

        FARM_ID = message.payload.farmId ? message.payload.farmId : FARM_ID;  // 농장 ID
        TOPIC = `${FARM_ID}/infos`;
        // 전역 변수 초기화
        previousTime = moment();
        temperature = 0;
        avgTemperature = 0;
        humidity = 0;
        avgHumidity = 0;
        moistureOfSoil = 0;
        avgMoistureOfSoil = 0;
        phOfSoil = 0;
        avgPhOfSoil = 0;
        ecOfSoil = 0;
        avgEcOfSoil = 0;
        imageEvaluation = "없음";
        cnt = 0;

        // MQTT 클라이언트 생성
        const client = mqtt.connect(BROKER_ADDRESS, { port: PORT });

        // 새로운 메시지가 도착했을 때 호출되는 콜백 함수
        client.on('message', (topic, message) => {
            currentTime = moment();  // 현재 시간 업데이트

            // 매 분이 변경될 때마다 카운트 초기화
            if (previousTime.minute() !== currentTime.minute()) {
                cnt = 0;  // 카운트 리셋
            }

            cnt++;
            try {
                // 수신한 메시지를 JSON으로 파싱
                const msgValue = JSON.parse(message);
                console.log('Received message:', msgValue);
                // 센서 데이터 추출
                temperature = msgValue.temperature ? msgValue.temperature : temperature;
                humidity = msgValue.humidity ? msgValue.humidity : humidity;
                moistureOfSoil = msgValue.moistureOfSoil ? msgValue.moistureOfSoil : moistureOfSoil;
                phOfSoil = msgValue.phOfSoil ? msgValue.phOfSoil : phOfSoil;
                ecOfSoil = msgValue.ecOfSoil ? msgValue.ecOfSoil : ecOfSoil;
                imageEvaluation = msgValue.imageEvaluation ? msgValue.imageEvaluation : imageEvaluation;

                // 각 센서 데이터의 평균값 계산
                avgTemperature = cnt === 1 ? temperature : ((avgTemperature * (cnt - 1)) + temperature) / cnt;
                avgHumidity = cnt === 1 ? humidity : ((avgHumidity * (cnt - 1)) + humidity) / cnt;
                avgMoistureOfSoil = cnt === 1 ? moistureOfSoil : ((avgMoistureOfSoil * (cnt - 1)) + moistureOfSoil) / cnt;
                avgPhOfSoil = cnt === 1 ? phOfSoil : ((avgPhOfSoil * (cnt - 1)) + phOfSoil) / cnt;
                avgEcOfSoil = cnt === 1 ? ecOfSoil : ((avgEcOfSoil * (cnt - 1)) + ecOfSoil) / cnt;

            } catch (error) {
                console.error("Failed to parse MQTT message as JSON:", error);
            }
            // 이전 시간을 현재 시간으로 업데이트
            previousTime = currentTime;
        });

        // 브로커에 연결되었을 때 구독 설정
        client.on('connect', () => {
            console.log('Connected to broker');
            client.subscribe(TOPIC, (err) => {  // 토픽을 구독
                if (err) {
                    console.error('구독에 실패했습니다:', err);
                    message.respond({
                        returnValue: false,
                        Response: '구독에 실패했습니다.'
                    });
                } else {
                    console.log('Subscribed to topics:', TOPIC);
                }
            });
        });

        // heartbeat 구독
        const sub = service.subscribe('luna://com.devmonster.farmos.service/heartbeat', {subscribe: true});

        sub.addListener("response", function(msg) {
            console.log(JSON.stringify(msg.payload));
            if (cancel == true) {
                sub.cancel();
                setTimeout(function(){
                    console.log(heartbeatMax+" responses received, exiting...");
                    process.exit(0);
                }, 1000);
            }
        });
    }

    message.respond({
        returnValue: val,

        Response: val ? "My service has been started." : "service is already running."
    });
});

const subscriptions = {};
let heartbeatinterval;
let x = 1;

function createHeartBeatInterval() {
    if (heartbeatinterval) {
        return;
    }
    console.log(logHeader, "create_heartbeatinterval");
    heartbeatinterval = setInterval(function() {
        sendResponses();
    }, 1000);
}


// send responses to each subscribed client
function sendResponses() {
    console.log(logHeader, "send_response");
    console.log("Sending responses, subscription count=" + Object.keys(subscriptions).length);
    for (const i in subscriptions) {
        if (Object.prototype.hasOwnProperty.call(subscriptions, i)) {
            const s = subscriptions[i];
            
            s.respond({
                topic: TOPIC,
                returnValue: true,
                temperature: temperature,
                humidity: humidity,
                moistureOfSoil: moistureOfSoil,
                phOfSoil: phOfSoil,
                ecOfSoil: ecOfSoil,
                imageEvaluation: imageEvaluation,
                currentHour: currentTime.hour()
            });
        }
    }
    //x++;
}

// send responses to each subscribed client
var heartbeat = service.register("heartbeat");
heartbeat.on("request", function(message) {
    console.log(logHeader, "SERVICE_METHOD_CALLED:/heartbeat"); //하트비트 수신
    message.respond({
        event: "beat",
    }); // 처음 응답
    if (message.isSubscription) {  
        subscriptions[message.uniqueToken] = message; //메시지 구독
        if (!heartbeatinterval) {
            createHeartBeatInterval();
        }
    } 
}); 


heartbeat.on("cancel", function(message) { 
    delete subscriptions[message.uniqueToken]; // 구독 취소
    var keys = Object.keys(subscriptions); 
    if (keys.length === 0) { // count the remaining subscriptions 
        console.log("no more subscriptions, canceling interval"); 
        clearInterval(heartbeatinterval);
        heartbeatinterval = undefined;
    } 
});

service.register("serviceOff", (message) => {
    cancel = true;
    active = false;
    console.log(logHeader, message);
    message.respond({
        returnValue: true,
        Response: "My service has been stopped."
    });
});

