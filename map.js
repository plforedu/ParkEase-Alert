// =========================================================
//                    Initialization
// =========================================================

// พิกัดกลาง KMUTT ที่ตึกแดง
const initialCoords = [13.6500, 100.4945]; 

// สร้างแผนที่ Leaflet กำหนดจุดเริ่มต้น
const map = L.map('map').setView(initialCoords, 19); // ซูม 4 ลานจอดรถ

const parkingGraph = {};

// =========================================================
// ตัวแปรเก็บ GeoJSON Layer
let parkingLayer; 
// สถานะช่องจอดทั้งหมด (ใช้ร่วมกัน Real-time Update และ Routing)
let currentParkingStatus = {};
// =========================================================


// *************** เพิ่มตัวแปร Blynk API **********************   ******************************Blynk******************************
const BLYNK_AUTH_TOKEN = "hPGBkF64L7Oq8QaiUgloO5Lcnw5gTZrM"; // Auth Token
const BLYNK_BASE_URL = "https://blynk.cloud/external/api/"; 
// Mapping ช่องจอด 
const SPOT_MAPPING = {
    "P05": "V0",
    "P06": "V1",
    "P07": "V2",
    "P08": "V3",
    "P09": "V4"
    // เพิ่มช่องจอด
};
// =========================================================
const RESERVED_SPOTS = ["b11", "b20" , "b21", "b22" , "c5" , "d1" ,"d2", "d4" ,"f2", "f3" ,"f4", "f5" ,"f6", "f7" ,"f8"]; // ใส่ชื่อช่องที่มีเจ้าของประจำ
const RESERVED_OWNERS = {
    "b11": "ศ.ดร.นภาพร  เชี่ยวชาญ",
    "b20": "ศ.ดร.โกสินทร์  จำนงไทย",
    "b21": "ศ.ดร.สำเริง  จักรใจ",
    "b22": "ศ.ดร.สมชาย  วงศ์วิเศษ",
    "c5": "ผู้อำนวยการสถาบันการเรียนรู้",
    "d1": "ศ.ดร.วรัช  ก้องกิจกุล",
    "d2": "ศ.ดร.สักกมน  เทพหัสดิน ณ อยุธยา",
    "d4": "ศ.ดร.บุญเจริญ  ศิริเนาวกุล",
    "f2": "ศ.ดร.วุฒิพงษ์  คำวิลัยศักดิ์",
    "f3": "ศ.ดร.อภิชัย  เทอดเทียนวงษ์",
    "f4": "ศ.ดร.สุทัศน์  ทิพย์ปรักมาศ",
    "f5": "ศ.ดร.พรเกษม  จงประดิษฐ์",     
    "f6": "ศ.ดร.สมชาย  ชูชีพสกุล",
    "f7": "ศ.ดร.ชัย  จาตุรพิทักษ์กุล",
    "f8": "คณบดีคณะวิศวกรรมศาสตร์"
};
const ACTIVE_SPOTS = Object.keys(SPOT_MAPPING); // P05-P09 ที่จะติดตั้ง



// ----------------------------------------------------
//           เพิ่มแผนที่พื้นหลัง OpenStreetMap
// ----------------------------------------------------
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 21,
    maxNativeZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);



// ----------------------------------------------------
//        ฟังก์ชันอัปเดต[สี](IR)ช่องจอดตามสถานะ
// ----------------------------------------------------
function updateParkingStyle(spotData) {
    
    currentParkingStatus = spotData; // เซ็ต Global Variable 
    let availableCount = 0; 
    
    parkingLayer.eachLayer(function(layer) {
        // หา spotName
        
        if (layer.feature.properties.type === 'parking_spot') {
            const spotName = layer.feature.properties.name; // ดึงสถานะ

            if (ACTIVE_SPOTS.includes(spotName)) {
                const status = currentParkingStatus[spotName];
                if (status !== undefined) {
                    let color = (status === 1) ? '#00cc00' : '#cc0000';
                    let weight = (lastSelectedSpot === spotName) ? 3 : 1;
                    let borderColor = (lastSelectedSpot === spotName) ? '#000000' : '#999999';

                    if (status === 1) availableCount++;
                    if (lastSelectedSpot === spotName) color = '#FFD700';

                    layer.setStyle({
                        fillColor: color,
                        weight: weight,
                        color: borderColor,
                        fillOpacity: 0.7
                    });
                }
            }
        }
    });
    
    // เชื่อมต่อ UI
    document.getElementById('total-available').textContent = availableCount; 
}





// ----------------------------------------------------
//        ฟังก์ชันจำลองสถานะช่องจอด Mock Data ทดลอง
// ----------------------------------------------------
//function simulateStatus() {
    // ข้อมูลจำลองสถานะของ 5 ช่องจอด 0=ว่าง, 1=ไม่ว่าง
    // **ตอนเชื่อมทำ Blynk ให้ลบฟังก์ชันนี้และแทนที่ด้วย fetchBlynkStatus()**   **************************ทดลอง******************************
    //const mockData = {
        //"P05": "0",//Math.random() < 0.5 ? "0" : "1", // สุ่ม 50%
        //"P06": "0", // ว่างเสมอ
        //"P07": "1",//Math.random() < 0.8 ? "0" : "1", // สุ่ม
        //"P08": "1", // ไม่ว่างเสมอ
        //"P09": "0" 
    //};
    
    // ส่งข้อมูลจำลองไปอัปเดตสีช่องจอด ฟีลแบบเซนเซอร์แต่แทนสีไปก่อน
    //updateParkingStyle(mockData);
//}




// =========================================================
//          Blynk API ใช้ตอนรับค่าจริง from cloud API
// =========================================================
function fetchBlynkStatus() {
    const vPins = Object.values(SPOT_MAPPING);
    const tPins = Object.values(TIME_MAPPING);
    const allPins = [...vPins, ...tPins].map(pin => `&${pin}`).join('');
    
    const fullUrl = `${BLYNK_BASE_URL}get?token=${BLYNK_AUTH_TOKEN}${allPins}`;

    fetch(fullUrl)
        .then(response => response.json())
        .then(data => {
            updateSidePanel(data);
            const currentStatus = {};
            const myActiveSpot = sessionStorage.getItem('finalSpot');
            Object.keys(SPOT_MAPPING).forEach((spotName) => { 
                const vPin = SPOT_MAPPING[spotName];
                const tPin = TIME_MAPPING[spotName];
                
                const status = parseInt(data[vPin]);
                const savedExitTime = data[tPin]; 
                
                currentStatus[spotName] = status;
                checkAutoExitBySensor(spotName, status);
                // สำหรับทุกคน: ถ้าช่องไม่ว่างและมีเวลาใน Blynk ให้โชว์ Countdown บนแมพ
                if (status === 0 && savedExitTime && savedExitTime !== "0") {
                    if (spotName !== myActiveSpot) {
                        renderGlobalCountdown(spotName, savedExitTime);
                    }
                } else if (status === 1) {
                    // ถ้าช่องว่าง ให้ลบ Tooltip ออกจากแผนที่
                    if (spotTooltips[spotName]) {
                        map.removeLayer(spotTooltips[spotName]);
                        delete spotTooltips[spotName];
                    }
                }
            });
            
            
            // --- ทำงานปกติเหมือนเดิม: อัปเดตสีช่องจอดบนแผนที่ ---
            updateParkingStyle(currentStatus);

            // --- ทำงานปกติเหมือนเดิม: เช็กการขับรถเข้าช่องจอด (สำหรับคนนำทาง) ---
            if (lastSelectedSpot && !hasArrivedPrompted) {
                if (currentStatus[lastSelectedSpot] === 0) {
                    hasArrivedPrompted = true;
                    setTimeout(() => {
                        showArrivalPrompt(lastSelectedSpot);
                    }, 500);
                }
            }
        })
        .catch(error => {
            console.error("Error fetching Blynk data:", error);
        });
}







// =========================================================
//          สร้าง Graph Data Structure 4 A* Routing
// =========================================================


// คำนวณระยะทางระหว่าง 2 พิกัด (ใช้หา Cost ของ Edge)
function calculateDistance(coord1, coord2) {
    const R = 6371; 
    const lat1 = coord1[0], lon1 = coord1[1];
    const lat2 = coord2[0], lon2 = coord2[1];

    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // แปลงเป็นเมตร
}



// แก้ปัญหาพิกัดไม่ทับกัน
function getNearestExistingNode(coord, threshold = 10.0) { 
    let minDistance = Infinity;
    let nearestNodeId = null;
    for (const nodeId in parkingGraph) {
        const parts = nodeId.split(',');
        const dist = calculateDistance([parseFloat(parts[0]), parseFloat(parts[1])], coord);
        if (dist < minDistance) { minDistance = dist; nearestNodeId = nodeId; }
    }
    return (minDistance <= threshold) ? nearestNodeId : null;
}


//       สร้าง Graph จากข้อมูล GeoJSON LineStrings
// =========================================================
//    buildParkingGraph (สร้าง Graph ให้ละเอียดทุกจุดดัด)
// =========================================================
function buildParkingGraph(geojsonData) {
    const roadFeatures = geojsonData.features.filter(f => f.properties.type === 'road');
    roadFeatures.forEach(feature => {
        const coords = feature.geometry.coordinates; // พิกัดทึ้งหมดใน LineString [lng, lat]
        
        // วนลูปสร้าง Node เชื่อมกันทุกข้อต่อย่อย เพื่อให้ A* วิ่งตามเส้นทางจริง
        for (let i = 0; i < coords.length - 1; i++) {
            const p1 = coords[i];
            const p2 = coords[i+1];
            
            // สร้าง ID จากพิกัด (สลับเป็น Lat, Lng และฟิกทศนิยม 6 ตำแหน่งกันคลาดเคลื่อน)
            const u = `${p1[1].toFixed(6)},${p1[0].toFixed(6)}`;
            const v = `${p2[1].toFixed(6)},${p2[0].toFixed(6)}`;

            if (!parkingGraph[u]) parkingGraph[u] = { connections: {} };
            if (!parkingGraph[v]) parkingGraph[v] = { connections: {} };

            // คำนวณระยะทางจริงระหว่างข้อต่อย่อยเป็น Cost
            const dist = calculateDistance([p1[1], p1[0]], [p2[1], p2[0]]);

            // เชื่อม Node เข้าด้วยกันทั้งไปและกลับ
            parkingGraph[u].connections[v] = { cost: dist, coords: [p1, p2] };
            parkingGraph[v].connections[u] = { cost: dist, coords: [p2, p1] };
        }
    });
    console.log("DEBUG: Graph สร้างใหม่แบบละเอียด (Sub-nodes) เสร็จแล้ว!");
}





// =========================================================
//               Pathfinding Algorithm
// =========================================================

function reconstructPath(cameFrom, current) {
    const totalPath = [current];
    
    // วนลูปตราบเท่าที่ Node ปัจจุบันมีNode หลักให้ไปต่อ
    // และเช็กเพื่อกัน Loop นรก (ป้องกัน Error Invalid array length)
    while (current in cameFrom) {
        let nextNode = cameFrom[current];
        
        // ถ้า Node ถัดไปดันซ้ำกับที่มีอยู่แล้ว หรือไม่มีค่า ให้หยุดทันที
        if (!nextNode || totalPath.includes(nextNode)) {
            break; 
        }
        
        current = nextNode;
        totalPath.push(current);

        // กันเหนียว: ถ้าเส้นทางยาวผิดปกติ (เช่น เกิน 500 nodes) ให้หยุด
        if (totalPath.length > 500) {
            console.error("Path is too long, possible infinite loop!");
            break;
        }
    }
    return totalPath.reverse(); 
}


/**
 * ค้นหาเส้นทางที่สั้นที่สุดใน Graph
 * @param {string} startNode - ID ของ Node เริ่มต้น
 * @param {string} endNode - ID ของ Node ปลายทาง
 * @returns {Array|null} ลำดับของ Node ID ที่เป็นเส้นทาง หรือ null ถ้าหาไม่เจอ
 */
function findShortestPath(startNode, endNode) {
    // ข้อมูลที่จำเป็น Priority Queue, gScore, fScore, cameFrom
    
    let openSet = [{ nodeId: startNode, fScore: 0 }]; 
    let gScore = {};
    gScore[startNode] = 0;
    
    let fScore = {};
    fScore[startNode] = 0; 

    let cameFrom = {};

    while (openSet.length > 0) {
        // เลือก Node ที่มี fScore น้อยที่สุด
        openSet.sort((a, b) => a.fScore - b.fScore);
        const current = openSet.shift().nodeId;

        if (current === endNode) {
            return reconstructPath(cameFrom, current); // พบเส้นทาง
        }

        const nodeData = parkingGraph[current];
        if (!nodeData || !nodeData.connections) {
            console.warn(`Node ${current} ไม่มีเส้นทางเชื่อมต่อ (Dead end)`);
            continue; 
        }
        
        const connections = nodeData.connections;
        
        for (const neighborNode in connections) {
            const edgeCost = connections[neighborNode].cost;
            const tentative_gScore = gScore[current] + edgeCost;

            if (tentative_gScore < (gScore[neighborNode] || Infinity)) {
                // พบเส้นทางที่ดีกว่า
                cameFrom[neighborNode] = current;
                gScore[neighborNode] = tentative_gScore;
                
                // fScore = gScore + Heuristic (Heuristic ถูกตั้งเป็น 0)
                fScore[neighborNode] = tentative_gScore; 
                
                // เพิ่ม Node เข้าสู่ OpenSet ถ้ายังไม่มี
                if (!openSet.some(n => n.nodeId === neighborNode)) {
                    openSet.push({ nodeId: neighborNode, fScore: fScore[neighborNode] });
                }
            }
        }
    }

    return null; // หาเส้นทางไม่พบ
}




// =========================================================
//  หา Node ที่ใกล้ที่สุดกับช่องจอด = Node ที่อยู่บนเส้นทางขับรถ R01-R08 ใกล้ที่สุดกับช่องจอดที่ว่าง P01-P05
// =========================================================

/**
 * ฟังก์ชันหา Node ที่ใกล้ที่สุดกับพิกัดช่องจอด
 * @param {string} spotName - ชื่อช่องจอดที่ว่าง (เช่น P02)
 * @returns {string|null} Node ID ที่ใกล้ที่สุด หรือ null
 */
function findNearestNode(spotName) {
    if (!parkingLayer) return null;
    let targetCenter;
    parkingLayer.eachLayer(function(layer) {
        if (layer.feature.properties.name === spotName) {
            targetCenter = layer.getBounds().getCenter(); 
        }
    });
    if (!targetCenter) return null;

    let minDistance = Infinity;
    let nearestNodeId = null;

    for (const nodeId in parkingGraph) {
        const parts = nodeId.split(',');
        const dist = calculateDistance([parseFloat(parts[0]), parseFloat(parts[1])], [targetCenter.lat, targetCenter.lng]);
        if (dist < minDistance) {
            minDistance = dist;
            nearestNodeId = nodeId;
        }
    }
    // เพิ่ม Log เพื่อเช็คว่า P09 ไปเกาะกับ Node ไหน
    console.log(`DEBUG: ช่อง ${spotName} เชื่อมกับ Node ${nearestNodeId} ระยะห่าง: ${minDistance.toFixed(2)} เมตร`);
    return nearestNodeId; 
}




// =========================================================
//            Routing Logic  เชื่อมต่อ Alg กับ UI
// =========================================================

// Node เริ่มทางเข้าลานจอด
const START_NODE_ID = "13.650134,100.494623";  //เส้นทางเข้า
// ตัวแปรเก็บเส้นทางที่วาดไว้
let currentRoutePolyline = null; 
let lastSelectedSpot = null;

let destinationMarker = null; // ตัวแปรเก็บไอคอนปักหมุดปลายทาง
let hasArrivedPrompted = false; //หลังรถจอดจะเอาเวลาออก


const TIME_MAPPING = {
    "P05": "V10", "P06": "V11", "P07": "V12", "P08": "V13", "P09": "V14"
};
let spotTooltips = {}; // ตัวแปรเก็บป้ายเวลาบนแมพ

 
// =========================================================
//            Routing Logic (เวอร์ชันรวมร่าง)
// =========================================================

// =========================================================
//        startRouting (เน้น Logic การดึงพิกัดสีฟ้า)
// =========================================================
function startRouting() {
    console.log("--- เริ่มต้นการนำทาง (Logic: Sub-node Precision) ---");
    
    if (currentRoutePolyline) map.removeLayer(currentRoutePolyline);
    if (destinationMarker) map.removeLayer(destinationMarker);

    const priorityOrder = ["P09", "P08", "P07" ,"P06", "P05", "P04", "P03", "P02", "P01"];
    let bestSpotName = priorityOrder.find(spot => currentParkingStatus[spot] === 1);

    if (bestSpotName) {
        console.log(`✅ เลือกช่องจอด: ${bestSpotName}`);

        const endNodeId = findNearestNode(bestSpotName);
        const path = findShortestPath(START_NODE_ID, endNodeId);

        if (path && path.length > 0) {
            let routeCoords = []; 
            
            // วนลูปตาม Path ที่หาได้จาก A*
            for (let i = 0; i < path.length - 1; i++) {
                const u = path[i];
                const v = path[i+1];
                const connection = parkingGraph[u].connections[v];

                if (connection && connection.coords) {
                    // ดึงพิกัดจากรอยต่อย่อย สลับ lng/lat เป็น lat/lng
                    const segment = connection.coords.map(c => [c[1], c[0]]);
                    if (routeCoords.length === 0) {
                        routeCoords.push(...segment);
                    } else {
                        routeCoords.push(segment[1]); // ใส่จุดปลายของรอยต่อนั้นๆ
                    }
                }
            }

            // เพิ่มจุดกึ่งกลางของช่องจอดจริงๆปิดท้าย เพื่อให้เส้นทิ่มเข้าไปในช่อง
            parkingLayer.eachLayer(function(layer) {
                if (layer.feature.properties.name === bestSpotName) {
                    const spotCenter = layer.getBounds().getCenter();
                    //routeCoords.push([spotCenter.lat, spotCenter.lng]); //สำหรับให้เส้นนำทางไปถึงหมุดกลาง
                    
                    // ปักหมุดและไฮไลท์ช่อง
                    destinationMarker = L.marker(spotCenter).addTo(map);
                    layer.setStyle({ fillColor: '#FFD700', weight: 3, color: '#000000', fillOpacity: 0.9 });
                    map.setView(spotCenter, 21);
                }
            });

            // วาดเส้นสีฟ้าที่หักเลี้ยวตามถนนเป๊ะๆ
            currentRoutePolyline = L.polyline(routeCoords, {
                color: 'blue',
                weight: 6,
                opacity: 0.8,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(map);

            lastSelectedSpot = bestSpotName;
            document.getElementById('route-display').innerHTML = `
                <p>สถานะ: <span style="color: blue; font-weight: bold;">กำลังนำทาง</span></p>
                <p>ปลายทาง: <span style="font-weight: bold;">${bestSpotName}</span></p>
            `;
            document.getElementById('route-button').style.display = 'none';
            document.getElementById('clear-button').style.display = 'inline-block';

            parkingLabelsLayer.addTo(map);

            alert(`นำทางสำเร็จ! ไปยังช่องจอด ${bestSpotName}`);
        } else {
            alert("ไม่สามารถหาเส้นทางได้! โปรดตรวจสอบจุดเชื่อมต่อถนนใน GeoJSON");
        }
    } else {
        alert("ไม่มีช่องจอดรถว่างในขณะนี้!");
    }
}

// --- เปิดใช้งานปุ่ม 
document.getElementById('route-button').addEventListener('click', startRouting);
document.getElementById('clear-button').addEventListener('click', clearRoute);


function clearRoute() {
    // ลบเส้นทางสีฟ้าออกจากแผนที่
    if (currentRoutePolyline) {
        map.removeLayer(currentRoutePolyline);
        currentRoutePolyline = null;
    }

    // ลบปักหมุดปลายทางออกจากแผนที่
    if (destinationMarker) {
        map.removeLayer(destinationMarker);
        destinationMarker = null;
    }

    // เคลียร์สถานะการนำทาง
    if (lastSelectedSpot) {
        const spotToReset = lastSelectedSpot;
        // ล้างค่า "ช่องที่ถูกเลือก" ทันที
        lastSelectedSpot = null;
        hasArrivedPrompted = false;

        // อัปเดตสถานะในตัวแปรข้อมูลให้เป็น "ว่าง" (1) รอ Blynk มาทับ
        currentParkingStatus[spotToReset] = 1;
        updateParkingStyle(currentParkingStatus);
    }


    


    // รีเซ็ตการแสดงผล UI
    document.getElementById('route-display').innerHTML = '<p>สถานะ: <span>พร้อมใช้งาน</span></p>';
    document.getElementById('route-button').style.display = 'inline-block'; 
    document.getElementById('clear-button').style.display = 'none'; 

    map.removeLayer(parkingLabelsLayer);
}










// =========================================================
//             โหลดแมพ GeoJSON และเริ่มต้นการทำงาน
// =========================================================
fetch('map_layout3.geojson')
    .then(response => response.json())
    .then(data => {
        // กำหนดสไตล์ map
        function styleFeature(feature) {
            if (feature.properties.type === 'parking_spot') {
                const spotName = feature.properties.name;

                // 1. ช่องจองประจำ (Reserved)
                if (RESERVED_SPOTS.includes(spotName)) {
                    return { fillColor: '#555555', color: '#333333', weight: 1, fillOpacity: 0.8, dashArray: '5, 5' };
                }

                // 2. ช่องที่ใช้งานจริง (Active) ที่เราจะติดตั้ง
                if (ACTIVE_SPOTS.includes(spotName)) {
                    return { fillColor: '#cccccc', color: '#666666', weight: 1, fillOpacity: 0.5 };
                }

                // 3. ช่องอื่นๆ ในอนาคต 
                return { fillColor: 'white', color: '#bbbbbb', weight: 0.5, fillOpacity: 0.8 }; // ปรับเป็นพื้นหลังขาว
            }

            if (feature.properties.type === 'road') {
                return { color: '#444444', weight: 3 };
            }
            
            return {};
        }

        // เก็บ Layer ไว้ในตัวแปร Global: parkingLayer
        parkingLayer = L.geoJson(data, {
            style: styleFeature,
            onEachFeature: function(feature, layer) {
                if (feature.properties.name) {
                    const spotName = feature.properties.name;

                    // 1. ถ้าเป็นช่องที่มีคนจอดประจำ
                    if (RESERVED_SPOTS.includes(spotName)) {
                        // ดึงชื่อเจ้าของจาก RESERVED_OWNERS ถ้าไม่มีให้ใส่คำว่า "เจ้าของประจำ"
                        const ownerName = RESERVED_OWNERS[spotName] || "เจ้าของประจำ";


                        layer.bindPopup(`🚨 <b>ที่จอดรถส่วนบุคคล (${spotName})</b><br>เจ้าของ: <b>${ownerName}</b>`);
                    }

                    
                    else {
                        layer.bindPopup('ช่องจอด ID: ' + spotName);
                    }
                }
            }
        }).addTo(map);

        // สร้าง Graph Data Structure สำหรับ Routing
        buildParkingGraph(data);

        // *** เริ่ม Real-time Update ด้วย Blynk API ***
        fetchBlynkStatus(); // เรียกครั้งแรกทันที
        
        // กำหนดให้ดึงข้อมูลสถานะช่องจอดรถจาก Blynk ซ้ำทุก 1 วินาที
        setInterval(fetchBlynkStatus, 1000); 
    })
    .catch(error => {
        console.error("Error loading GeoJSON or during initialization:", error);
    }); 



let countdownInterval = null; // ตัวแปรเก็บ Interval ของการนับถอยหลัง

function showArrivalPrompt(spotName) {
    // ใช้ SweetAlert2 สร้าง Popup สวยๆ
    Swal.fire({
        title: `ถึงช่องจอด ${spotName} แล้ว!`,
        text: 'กรุณาระบุเวลาที่จะออกจากช่องจอด',
        input: 'time', // ช่องกรอกเวลาแบบนาฬิกา
        inputLabel: 'เลือกเวลา หรือกดปุ่มลัดด้านล่าง',
        inputPlaceholder: 'HH:mm',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        
        // เพิ่มปุ่มลัด (Quick Select)
        footer: `
            <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;">
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('10:00')">10:00</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('11:00')">11:00</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('12:00')">12:00</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('12:30')">12:30</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('13:00')">13:00</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('13:30')">13:30</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('14:00')">14:00</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('15:00')">15:00</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('16:00')">16:00</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('16:30')">16:30</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('17:00')">17:00</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('17:30')">17:30</button>
                <button class="swal2-confirm swal2-styled" style="background:#6e7881; margin:2px;" onclick="setSwalTime('18:00')">18:00</button>
            </div>
        `,
        preConfirm: (value) => {
            if (!value) {
                Swal.showValidationMessage('กรุณาเลือกเวลาด้วยครับ');
            }
            return value;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const exitTimeStr = result.value;
            processCheckIn(spotName, exitTimeStr); // แยก Logic การบันทึกไปไว้อีกฟังก์ชัน
        } else {
            hasArrivedPrompted = false; // ถ้ากดยกเลิก ให้เด้งถามใหม่ได้
        }
    });
}

// ฟังก์ชันช่วยสำหรับกดปุ่มลัดแล้วให้เวลาไปโผล่ในช่อง Input
window.setSwalTime = function(time) {
    const input = Swal.getInput();
    if (input) input.value = time;
};

// แยก Logic เดิมมาไว้ที่นี่เพื่อให้โค้ดอ่านง่าย
function processCheckIn(spotName, exitTimeStr) {
    // 1. เก็บในเครื่องตัวเองเหมือนเดิม (สำรองไว้)
    const now = new Date();
    sessionStorage.setItem('checkInTime', now.toISOString());
    sessionStorage.setItem('finalSpot', spotName);
    sessionStorage.setItem('finalDuration', exitTimeStr); // เก็บเวลาเป้าหมายไว้

    // 2. 🔥 จุดสำคัญ: ส่งข้อมูลไปที่ Blynk Cloud เพื่อให้คนอื่นเห็นด้วย
    const vPinForTime = TIME_MAPPING[spotName]; // เช่น V10 สำหรับ P05
    const blynkUpdateUrl = `${BLYNK_BASE_URL}update?token=${BLYNK_AUTH_TOKEN}&${vPinForTime}=${exitTimeStr}`;

    fetch(blynkUpdateUrl)
        .then(response => {
            console.log(`✅ ส่งเวลา ${exitTimeStr} ของช่อง ${spotName} ไปยัง Blynk สำเร็จ`);
        })
        .catch(err => console.error("❌ ส่งข้อมูลไป Blynk พลาด:", err));

    // 3. แสดงผล UI ในเครื่องเราทันที (โค้ดเดิมของคุณ)
    document.getElementById('route-display').innerHTML = `
        <p>สถานะ: <span style="color: green; font-weight: bold;">จอดเรียบร้อย</span></p>
        <p>ช่อง: <b>${spotName}</b></p>
        <p>เวลาออกโดยประมาณ: <b>${exitTimeStr} น.</b></p>
        <p>เวลาคงเหลือ: <span id="countdown-timer" style="color: red; font-weight: bold;">--:--:--</span></p>
    `;

    // เริ่มนับถอยหลังในเครื่องเรา (โค้ดเดิม)
    const [hours, minutes] = exitTimeStr.split(':');
    const exitTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    startCountdown(exitTime, spotName);

    if (currentRoutePolyline) map.removeLayer(currentRoutePolyline);
    if (destinationMarker) map.removeLayer(destinationMarker);
    lastSelectedSpot = null;
    updateParkingStyle(currentParkingStatus);
    document.getElementById('finish-button').style.display = 'inline-block'; // สั่งให้ปุ่มโชว์
}

function startCountdown(endTime, spotName) {
    if (countdownInterval) clearInterval(countdownInterval);

    function updateTimer() {
        const now = new Date();
        const distance = endTime - now;

        let timeString = "";
        
        if (distance <= 0) {
            // เมื่อหมดเวลาจองแล้ว
            // 1. เปลี่ยนตัวอักษรเป็นสีส้ม หรือแจ้งว่า "จอดเกินเวลา"
            const overdueMs = Math.abs(distance);
            const hrs = Math.floor(overdueMs / (1000 * 60 * 60));
            const mins = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((overdueMs % (1000 * 60)) / 1000);
            timeString = `เกินเวลา: ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            
            updateTooltipOnMap(spotName, `<span style="color:orange;">${timeString}</span>`);
            const timerElem = document.getElementById('countdown-timer');
            if (timerElem) {
                timerElem.style.color = "orange";
                timerElem.innerHTML = timeString;
            }
            // ไม่สั่ง window.location.href ที่นี่แล้ว! ปล่อยให้เซนเซอร์เป็นคนสั่ง
            return; 
        }

        // กรณีที่ยังไม่หมดเวลา (นับถอยหลังปกติ)
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        updateTooltipOnMap(spotName, timeString);
        const timerElem = document.getElementById('countdown-timer');
        if (timerElem) timerElem.innerHTML = timeString;
    }

    updateTimer(); 
    countdownInterval = setInterval(updateTimer, 1000);
}

// ฟังก์ชันจำลองการอัปเดตสถานะ (เพื่อสาธิตการเปลี่ยนสี)
function simulateStatusUpdateForDemo(spotName, status) {
    currentParkingStatus[spotName] = status;
    updateMapDisplay(); // เรียกใช้ฟังก์ชันเดิมของคุณเพื่อเปลี่ยนสีช่องจอดบนแผนที่
}





// =========================================================
//           โชว์เวลาเคาน์ดาวน์ให้คนอื่นเห็นในช่องจอดสีแดง  
//         ฟังก์ชันนี้จะหาตำแหน่งของช่องจอดและแปะตัวเลขลงไป 
// =========================================================
function updateTooltipOnMap(spotName, timeText) {
    parkingLayer.eachLayer(function(layer) {
        if (layer.feature.properties.name === spotName) {
            const center = layer.getBounds().getCenter();

            // ถ้ายังไม่มี Tooltip ให้สร้างใหม่
            if (!spotTooltips[spotName]) {
                spotTooltips[spotName] = L.tooltip({
                    permanent: true,     // ให้โชว์ค้างไว้เลยไม่ต้องเอาเมาส์ไปชี้
                    direction: 'center', // วางไว้ตรงกลางช่อง
                    className: 'countdown-tooltip' // เอาไว้แต่ง CSS
                });
            }

            // อัปเดตข้อความเวลา
            spotTooltips[spotName]
                .setLatLng(center)
                .setContent(`<b style="color:red;">${timeText}</b>`)
                .addTo(map);
        }
    });
}


//ฟังก์ชันสำหรับวาดเวลาบนแมพสำหรับทุกคน
//ฟังก์ชันสำหรับวาดเวลาบนแมพสำหรับทุกคน (แก้ไข: ซ่อนเลขรก, โชว์แค่ "กำลังจะว่าง" เมื่อ < 1 นาที)
function renderGlobalCountdown(spotName, exitTimeStr) {
    if (!exitTimeStr || exitTimeStr === "0") return;

    const now = new Date();
    const [hours, minutes] = exitTimeStr.split(':');
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes), 0);
    const distance = endTime - now;

    let timeText = "";
    let shouldShow = false;

    if (distance <= 0) {
        timeText = "เกินเวลา";
        shouldShow = true;
    } else if (distance <= 60000) { // น้อยกว่า 1 นาที (60,000 ms)
        timeText = "กำลังจะว่าง";
        shouldShow = true;
    } else {
        // ถ้าเวลายังเหลือมากกว่า 1 นาที ให้เก็บค่าเวลานับถอยหลังไว้ใน Tooltip ลับๆ (เพื่อส่งให้ Side Panel) 
        // แต่สั่งซ่อน Tooltip บนแผนที่เพื่อไม่ให้รก
        timeText = `${String(Math.floor((distance / (1000 * 60 * 60)) % 24)).padStart(2,'0')}:${String(Math.floor((distance / (1000 * 60)) % 60)).padStart(2,'0')}:${String(Math.floor((distance / 1000) % 60)).padStart(2,'0')}`;
        shouldShow = false; 
    }

    // หาตำแหน่งช่องจอดและจัดการ Tooltip
    parkingLayer.eachLayer(function(layer) {
        if (layer.feature.properties.name === spotName) {
            const center = layer.getBounds().getCenter();
            
            if (!spotTooltips[spotName]) {
                spotTooltips[spotName] = L.tooltip({ 
                    permanent: true, 
                    direction: 'center', 
                    className: 'countdown-tooltip' 
                });
            }

            // อัปเดตเนื้อหา Tooltip เสมอ (เพื่อให้ updateSidePanel ดึงไปใช้ได้)
            spotTooltips[spotName].setContent(`<b style="color:red;">${timeText}</b>`).setLatLng(center);

            if (shouldShow) {
                // แสดงบนแผนที่เมื่อเข้าเงื่อนไข (< 1 นาที หรือ เกินเวลา)
                spotTooltips[spotName].addTo(map);
            } else {
                // ซ่อนออกจากแผนที่ถ้ายังเหลือเวลาเยอะ (แต่ Object spotTooltips[spotName] ยังอยู่)
                map.removeLayer(spotTooltips[spotName]);
            }
        }
    });
}

function checkAutoExitBySensor(spotName, currentStatus) {
    const activeSpot = sessionStorage.getItem('finalSpot');
    
    if (activeSpot === spotName && currentStatus === 1) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        const checkInTimeStr = sessionStorage.getItem('checkInTime');
        const finalDuration = sessionStorage.getItem('finalDuration'); // เวลาเป้าหมาย (HH:mm)
        const checkInTime = new Date(checkInTimeStr);
        const now = new Date();

        // 1. คำนวณเวลาจอดจริง
        const diffMs = now - checkInTime;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
        const realDuration = `${String(diffHrs).padStart(2, '0')}:${String(diffMins).padStart(2, '0')}:${String(diffSecs).padStart(2, '0')}`;

        // 2. Logic เช็กการจอดเกินเวลา
        let overtimeMinutes = 0;
        
        // ดึงเวลาที่จะออก (เช่น 16:30) มาสร้างเป็น Date Object เพื่อเปรียบเทียบ
        if (finalDuration && finalDuration.includes(':')) {
            const [exH, exM] = finalDuration.split(':');
            const exitTime = new Date();
            exitTime.setHours(parseInt(exH), parseInt(exM), 0, 0);

            // ถ้าเวลาปัจจุบัน (now) เลยเวลาที่จองไว้ (exitTime)
            if (now > exitTime) {
                // คำนวณว่าเกินมากี่นาที
                overtimeMinutes = Math.ceil((now - exitTime) / (1000 * 60));
            }
        }

        let lat = 13.6515, lng = 100.4965;
        parkingLayer.eachLayer(function(layer) {
            if (layer.feature.properties.name === spotName) {
                const center = layer.getBounds().getCenter();
                lat = center.lat;
                lng = center.lng;
            }
        });

        // ล้างเวลาใน Blynk เมื่อรถออก (ส่ง Pin ไปล้างเป็น 0)
        clearBlynkTime(spotName);

        // ✅ ส่งค่า ot (นาทีที่เกิน) ไปที่หน้า index.html
        window.location.href = `index.html?status=pay&duration=${realDuration}&spot=${spotName}&lat=${lat}&lng=${lng}&exit=auto&ot=${overtimeMinutes}`;
    }
}


function updateSidePanel(blynkData) {
    const listContainer = document.getElementById('countdown-list-container');
    if (!listContainer) return;

    let htmlContent = "";
    let foundOccupied = false;

    Object.keys(SPOT_MAPPING).forEach(spotName => {
        const statusPin = SPOT_MAPPING[spotName];
        const status = parseInt(blynkData[statusPin]);

        if (status === 0) { // มีรถจอด
            foundOccupied = true;
            let timeDisplay = "";

            
            if (spotTooltips[spotName]) {
                // ดึง HTML ภายใน Tooltip ex 00:25:59
                const tooltipHtml = spotTooltips[spotName].getContent();
            
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = tooltipHtml;
                timeDisplay = `<span style="color: #e74c3c; font-weight: bold;">${tempDiv.innerText}</span>`;
            } else {
                timeDisplay = `<span style="color: #999;">ยังไม่ระบุเวลา</span>`;
            }

            htmlContent += `
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 14px;">
                    <b style="color: #333;">${spotName}</b>
                    <div>${timeDisplay}</div>
                </div>`;
        }
    });

    listContainer.innerHTML = foundOccupied ? htmlContent : `<p style="text-align:center; color:#2ecc71;">✅ ทุกช่องว่างอยู่</p>`;
}

// ตัวอย่างการล้างค่าใน Blynk เมื่อรถออกจากช่อง
function clearBlynkTime(spotName) {
    const vPinForTime = TIME_MAPPING[spotName];
    const clearUrl = `${BLYNK_BASE_URL}update?token=${BLYNK_AUTH_TOKEN}&${vPinForTime}=0`;
    fetch(clearUrl);
}

function finishParkingManual() {
    const activeSpot = sessionStorage.getItem('finalSpot');
    
    // ตรวจสอบก่อนว่ามีการจอดอยู่จริงไหม
    if (!activeSpot) {
        Swal.fire('แจ้งเตือน', 'คุณยังไม่ได้เริ่มการจอดหรือนำทางไปยังช่องจอด', 'warning');
        return;
    }

    // หยุดตัวนับเวลาถอยหลังในเครื่อง
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    const checkInTimeStr = sessionStorage.getItem('checkInTime');
    const finalDuration = sessionStorage.getItem('finalDuration'); 
    const checkInTime = new Date(checkInTimeStr);
    const now = new Date();

    // 1. คำนวณเวลาจอดจริง ณ วินาทีที่กดปุ่ม
    const diffMs = now - checkInTime;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
    const realDuration = `${String(diffHrs).padStart(2, '0')}:${String(diffMins).padStart(2, '0')}:${String(diffSecs).padStart(2, '0')}`;

    // 2. คำนวณ Overtime (ถ้ามี)
    let overtimeMinutes = 0;
    if (finalDuration && finalDuration.includes(':')) {
        const [exH, exM] = finalDuration.split(':');
        const exitTime = new Date();
        exitTime.setHours(parseInt(exH), parseInt(exM), 0, 0);

        if (now > exitTime) {
            overtimeMinutes = Math.ceil((now - exitTime) / (1000 * 60));
        }
    }

    // 3. หาพิกัดเพื่อส่งไปหน้าจ่ายเงิน (ดึงจากแมพเหมือนเดิม)
    let lat = 13.6515, lng = 100.4965;
    parkingLayer.eachLayer(function(layer) {
        if (layer.feature.properties.name === activeSpot) {
            const center = layer.getBounds().getCenter();
            lat = center.lat;
            lng = center.lng;
        }
    });

    // 4. ล้างค่าใน Blynk ทันที (เพราะถือว่าจบธุรกรรมบนแอปแล้ว)
    clearBlynkTime(activeSpot);

    map.removeLayer(parkingLabelsLayer);

    // 5. เด้งไปหน้าชำระเงิน พร้อมส่ง exit=manual เพื่อบอกว่าเป็นการกดปุ่มเอง
    window.location.href = `index.html?status=pay&duration=${realDuration}&spot=${activeSpot}&lat=${lat}&lng=${lng}&exit=manual&ot=${overtimeMinutes}`;
}



// =========================================================
// ส่วนที่เพิ่มใหม่: จัดการชื่อช่องจอดให้แสดงเฉพาะตอนนำทาง
// =========================================================

let parkingLabelsLayer = L.layerGroup(); // สร้างกลุ่มเก็บ Label แยกไว้

function createParkingLabels() {
    if (!parkingLayer) return;
    parkingLabelsLayer.clearLayers(); // ล้างของเก่าก่อนสร้าง

    parkingLayer.eachLayer(function(layer) {
        if (layer.feature.properties && layer.feature.properties.type === 'parking_spot') {
            const spotName = layer.feature.properties.name;
            const center = layer.getBounds().getCenter();

            const labelIcon = L.divIcon({
                className: 'parking-label-container',
                html: `<div style="
                    font-weight: 600; 
                    font-size: 11px; 
                    color: #333; 
                    text-align: center;
                    
                    pointer-events: none;
                ">${spotName}</div>`,
                iconSize: [30, 15],
                iconAnchor: [15, 25] //ปรับให้พอดีกับจุดกึ่งกลางช่องจอด
            });

            const marker = L.marker(center, { 
                icon: labelIcon, 
                interactive: false,
                zIndexOffset: 500 
            });
            
            parkingLabelsLayer.addLayer(marker); // เก็บเข้า Group ไว้ก่อน ยังไม่สั่ง addTo(map)
        }
    });
}

// เรียกสร้าง Label ทิ้งไว้ใน Memory เมื่อ Layer หลักพร้อม
const labelInitInterval = setInterval(() => {
    if (typeof parkingLayer !== 'undefined' && parkingLayer !== null) {
        createParkingLabels();
        clearInterval(labelInitInterval);
    }
}, 1000);