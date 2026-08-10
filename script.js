/**
 * ============================================================
 * SMART RO WATER QUALITY MONITOR - MQTT Web Client
 * BAHASA INDONESIA
 * STATUS: NORMAL / CEK FILTER / GANTI FILTER
 * ============================================================
 */

// ==================== CONFIG ====================
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const MQTT_TOPIC = "watermon/all";

let client = null;
let messageCount = 0;

// ==================== DOM REFERENCES ====================
const DOM = {
    connContainer: document.getElementById('connectionContainer'),
    connDot: document.getElementById('connectionDot'),
    connText: document.getElementById('connectionText'),
    mqttBadge: document.getElementById('mqttBadge'),
    espBadge: document.getElementById('espBadge'),
    lastUpdate: document.getElementById('lastUpdate'),
    dataCount: document.getElementById('dataCount'),
    lastMessage: document.getElementById('lastMessage'),
    waterStatusText: document.getElementById('waterStatusText'),
    statusIconWrapper: document.getElementById('statusIconWrapper'),
    statusDetail: document.getElementById('statusDetail'),
    waterStatusBadge: document.getElementById('waterStatusBadge'),
    filterHealth: document.getElementById('filterHealth'),
    healthBar: document.getElementById('healthBar'),
    daysLeft: document.getElementById('daysLeft'),
    volumeTotal: document.getElementById('volumeTotal'),
    phValue: document.getElementById('phValue'),
    tdsValue: document.getElementById('tdsValue'),
    turbidityValue: document.getElementById('turbidityValue'),
    tempValue: document.getElementById('tempValue'),
    phBadge: document.getElementById('phBadge'),
    tdsBadge: document.getElementById('tdsBadge'),
    turbBadge: document.getElementById('turbBadge'),
    tempBadge: document.getElementById('tempBadge'),
    filterReplaceStatus: document.getElementById('filterReplaceStatus'),
    filterReplaceScore: document.getElementById('filterReplaceScore'),
    filterReplaceReason: document.getElementById('filterReplaceReason'),
    filterReplaceRecommend: document.getElementById('filterReplaceRecommend'),
    anomalyCount: document.getElementById('anomalyCount'),
};

// ==================== STATE ====================
let state = {
    connected: false,
    mqttConnected: false,
    espOnline: false,
    messageCount: 0,
    lastData: null,
    lastUpdateTime: null,
    ph: null,
    tds: null,
    turbidity: null,
    temperature: null,
    status: null,
    health: null,
    daysLeft: null,
    volume: null,
    flowRate: null,
    filterScore: null,
    // Status baru
    waterStatus: 'MENUNGGU',     // NORMAL / CEK FILTER / GANTI FILTER
    waterStatusClass: 'neutral', // normal / cek / ganti
    anomalyList: [],
    anomalyCount: 0,
};

// ==================== PARAMETER VALIDATION ====================
function checkParameter(value, min, max, name) {
    if (value === null || value === undefined) return { valid: true, anomaly: false };
    if (value < min || value > max) {
        return { valid: false, anomaly: true, name: name, value: value, min: min, max: max };
    }
    return { valid: true, anomaly: false };
}

function checkAllParameters(ph, tds, turbidity, temp) {
    var anomalies = [];
    
    // pH: 6.5 - 9.8
    var phCheck = checkParameter(ph, 6.5, 9.8, 'pH');
    if (phCheck.anomaly) anomalies.push('pH (' + ph.toFixed(2) + ')');
    
    // TDS: < 50 ppm (ideal)
    if (tds !== null && tds > 50) {
        anomalies.push('TDS (' + Math.round(tds) + ' ppm)');
    }
    
    // Turbidity: < 5 NTU
    if (turbidity !== null && turbidity > 5) {
        anomalies.push('Kekeruhan (' + turbidity.toFixed(2) + ' NTU)');
    }
    
    // Temperature: 15 - 35 °C
    var tempCheck = checkParameter(temp, 15, 35, 'Suhu');
    if (tempCheck.anomaly) anomalies.push('Suhu (' + temp.toFixed(1) + '°C)');
    
    return anomalies;
}

// ==================== DETERMINE WATER STATUS ====================
function determineWaterStatus(anomalies) {
    var count = anomalies.length;
    var anomalyText = anomalies.join(', ');
    
    if (count === 0) {
        return {
            status: 'NORMAL',
            class: 'normal',
            text: '✅ NORMAL',
            badge: 'badge-normal',
            detail: 'Semua parameter dalam batas normal. Air aman dikonsumsi.',
            icon: '✅',
            reason: 'Semua parameter normal',
            recommendation: 'Lanjutkan pemantauan rutin.'
        };
    } else if (count === 1) {
        return {
            status: 'CEK FILTER',
            class: 'cek',
            text: '🟡 CEK FILTER',
            badge: 'badge-cek',
            detail: 'Ada 1 parameter yang tidak normal. Periksa filter dan sensor.',
            icon: '⚠️',
            reason: 'Parameter anomali: ' + anomalyText,
            recommendation: 'Periksa filter dan kalibrasi sensor. Pantau terus perkembangannya.'
        };
    } else {
        return {
            status: 'GANTI FILTER',
            class: 'ganti',
            text: '🔴 GANTI FILTER',
            badge: 'badge-ganti',
            detail: 'Ada ' + count + ' parameter yang tidak normal. Filter perlu diganti!',
            icon: '❌',
            reason: 'Parameter anomali: ' + anomalyText,
            recommendation: 'SEGERA GANTI FILTER! Sistem tidak berfungsi optimal.'
        };
    }
}

// ==================== MQTT LOGIC ====================
function initMQTT() {
    console.log('🔄 Menghubungkan ke MQTT...');
    updateConnectionUI('connecting', 'Menghubungkan...');
    
    try {
        client = mqtt.connect(MQTT_BROKER, {
            clientId: 'ro_dash_' + Math.random().toString(16).substr(2, 8),
            reconnectPeriod: 3000,
            keepAlive: 60,
            clean: true
        });

        client.on('connect', function() {
            console.log('✅ Terhubung ke MQTT Broker');
            state.mqttConnected = true;
            updateConnectionUI('connected', 'Terhubung');
            DOM.mqttBadge.className = 'badge active';
            DOM.espBadge.className = 'badge neutral';
            
            client.subscribe(MQTT_TOPIC, { qos: 1 }, function(err) {
                if (!err) {
                    console.log('✅ Berlangganan ke topic:', MQTT_TOPIC);
                    DOM.lastMessage.textContent = '✅ Berlangganan ke: ' + MQTT_TOPIC;
                } else {
                    console.error('❌ Gagal berlangganan:', err);
                    DOM.lastMessage.textContent = '❌ Gagal berlangganan: ' + err.message;
                }
            });
        });

        client.on('message', function(topic, message) {
            if (topic === MQTT_TOPIC) {
                handleIncomingData(message.toString());
            }
        });

        client.on('error', function(error) {
            console.error('❌ MQTT Error:', error);
            state.mqttConnected = false;
            updateConnectionUI('disconnected', 'Error');
            DOM.mqttBadge.className = 'badge inactive';
            DOM.espBadge.className = 'badge inactive';
            DOM.lastMessage.textContent = '❌ MQTT Error: ' + error.message;
        });

        client.on('offline', function() {
            console.log('⚠️ MQTT Offline');
            state.mqttConnected = false;
            state.espOnline = false;
            updateConnectionUI('disconnected', 'Offline');
            DOM.mqttBadge.className = 'badge inactive';
            DOM.espBadge.className = 'badge inactive';
            DOM.lastMessage.textContent = '⚠️ MQTT Offline - Menghubungkan ulang...';
        });

    } catch (e) {
        console.error('❌ Connection error:', e);
        DOM.lastMessage.textContent = '❌ Connection error: ' + e.message;
        setTimeout(initMQTT, 5000);
    }
}

function handleIncomingData(payload) {
    try {
        const data = JSON.parse(payload);
        console.log('📥 Data diterima:', data);
        
        state.messageCount++;
        state.lastUpdateTime = new Date();
        state.espOnline = true;
        state.lastData = data;
        
        // Populate state
        state.ph = data.ph !== undefined ? data.ph : null;
        state.tds = data.tds !== undefined ? data.tds : null;
        state.turbidity = data.turbidity_ntu !== undefined ? data.turbidity_ntu : null;
        state.temperature = data.temperature !== undefined ? data.temperature : null;
        state.status = data.status || "UNKNOWN";
        state.health = data.health !== undefined ? data.health : null;
        state.daysLeft = data.days_left !== undefined ? data.days_left : null;
        state.volume = data.volume !== undefined ? data.volume : null;
        state.flowRate = data.flow_rate !== undefined ? data.flow_rate : null;
        state.filterScore = data.filter_score !== undefined ? data.filter_score : null;

        // ========== CEK ANOMALI ==========
        var anomalies = checkAllParameters(state.ph, state.tds, state.turbidity, state.temperature);
        state.anomalyList = anomalies;
        state.anomalyCount = anomalies.length;
        
        // ========== TENTUKAN STATUS ==========
        var statusResult = determineWaterStatus(anomalies);
        state.waterStatus = statusResult.status;
        state.waterStatusClass = statusResult.class;
        state.waterStatusText = statusResult.text;
        state.waterStatusDetail = statusResult.detail;
        state.waterStatusIcon = statusResult.icon;
        state.waterStatusReason = statusResult.reason;
        state.waterStatusRecommendation = statusResult.recommendation;
        state.waterStatusBadgeClass = statusResult.badge;

        updateUI();
        
    } catch (e) {
        console.error('❌ Gagal parse JSON:', e);
        console.error('📄 Payload:', payload);
        DOM.lastMessage.textContent = '❌ Parse error: ' + e.message;
    }
}

function updateConnectionUI(status, text) {
    DOM.connText.textContent = text;
    DOM.connDot.className = 'dot ' + (status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected');
}

// ==================== UI UPDATES ====================
function updateUI() {
    // 1. Connection Header
    DOM.espBadge.className = 'badge active';
    DOM.dataCount.textContent = state.messageCount + ' paket';
    if (state.lastUpdateTime) {
        DOM.lastUpdate.textContent = state.lastUpdateTime.toLocaleTimeString();
    }
    
    // 2. Raw Debug JSON
    if (state.lastData) {
        DOM.lastMessage.textContent = JSON.stringify(state.lastData, null, 2);
    }
    
    // 3. WATER STATUS (BARU)
    DOM.waterStatusText.textContent = state.waterStatus || 'MENUNGGU';
    DOM.waterStatusText.className = state.waterStatusClass + '-text';
    DOM.statusIconWrapper.className = 'status-icon-wrapper ' + state.waterStatusClass;
    DOM.statusIconWrapper.innerHTML = '<span>' + (state.waterStatusIcon || '⏳') + '</span>';
    DOM.statusDetail.textContent = state.waterStatusDetail || 'Menunggu data...';
    
    // Status Badge
    if (DOM.waterStatusBadge) {
        DOM.waterStatusBadge.textContent = state.waterStatusText || '⏳ Menunggu Data';
        DOM.waterStatusBadge.className = 'status-badge ' + (state.waterStatusBadgeClass || 'badge-neutral');
    }
    
    // 4. Sensors
    if (state.ph !== null) {
        DOM.phValue.textContent = state.ph.toFixed(2);
        updateParamBadge(DOM.phBadge, state.ph, 6.5, 9.8, "Normal", "Warn", "Anomali");
    }
    
    if (state.tds !== null) {
        DOM.tdsValue.textContent = Math.round(state.tds);
        updateParamBadge(DOM.tdsBadge, state.tds, 0, 50, "Normal", "Warn", "Tinggi", true);
    }
    
    if (state.turbidity !== null) {
        DOM.turbidityValue.textContent = state.turbidity.toFixed(2);
        updateParamBadge(DOM.turbBadge, state.turbidity, 0, 5, "Jernih", "Keruh", "Sangat Keruh", true);
    }
    
    if (state.temperature !== null) {
        DOM.tempValue.textContent = state.temperature.toFixed(1);
        updateParamBadge(DOM.tempBadge, state.temperature, 15, 35, "Normal", "Warn", "Anomali");
    }
    
    // 5. Filter Health
    if (state.health !== null) {
        var health = state.health;
        DOM.filterHealth.textContent = Math.round(health) + '%';
        DOM.healthBar.style.width = Math.min(health, 100) + '%';
        
        if (health > 70) {
            DOM.healthBar.style.background = 'linear-gradient(90deg, #2563eb, #10b981)';
        } else if (health > 40) {
            DOM.healthBar.style.background = 'linear-gradient(90deg, #f59e0b, #10b981)';
        } else {
            DOM.healthBar.style.background = 'linear-gradient(90deg, #ef4444, #f59e0b)';
        }
    }
    
    if (state.daysLeft !== null) {
        DOM.daysLeft.textContent = state.daysLeft + ' hari';
    }
    
    if (state.volume !== null) {
        DOM.volumeTotal.textContent = state.volume.toFixed(2) + ' L';
    }
    
    // 6. FILTER STATUS
    updateFilterStatus();
}

// ==================== FILTER STATUS ====================
function updateFilterStatus() {
    var filterScore = state.filterScore || state.health || 0;
    var daysLeft = state.daysLeft || 0;
    var anomalyCount = state.anomalyCount || 0;
    
    // Status berdasarkan waterStatus
    var statusText = state.waterStatusText || '⏳ Menunggu';
    var statusClass = 'badge-neutral';
    
    if (state.waterStatusClass === 'normal') {
        statusClass = 'badge-success';
    } else if (state.waterStatusClass === 'cek') {
        statusClass = 'badge-warning';
    } else if (state.waterStatusClass === 'ganti') {
        statusClass = 'badge-danger';
    }
    
    // Update UI
    if (DOM.filterReplaceStatus) {
        DOM.filterReplaceStatus.textContent = statusText;
        DOM.filterReplaceStatus.className = 'insight-val ' + statusClass;
    }
    
    if (DOM.filterReplaceScore) {
        DOM.filterReplaceScore.textContent = Math.round(filterScore) + '/100';
    }
    
    if (DOM.anomalyCount) {
        DOM.anomalyCount.textContent = anomalyCount;
        if (anomalyCount === 0) {
            DOM.anomalyCount.className = 'insight-val text-bold text-green';
        } else if (anomalyCount === 1) {
            DOM.anomalyCount.className = 'insight-val text-bold text-yellow';
        } else {
            DOM.anomalyCount.className = 'insight-val text-bold text-red';
        }
    }
    
    if (DOM.filterReplaceReason) {
        DOM.filterReplaceReason.textContent = state.waterStatusReason || 'Menunggu data dari sensor...';
    }
    
    if (DOM.filterReplaceRecommend) {
        DOM.filterReplaceRecommend.textContent = state.waterStatusRecommendation || 'Silakan tunggu sinkronisasi data...';
    }
}

// ==================== BADGE HELPER ====================
function updateParamBadge(element, value, minSafe, maxSafe, safeLabel, warnLabel, dangerLabel, isLowerBetter) {
    if (isLowerBetter === undefined) isLowerBetter = false;
    
    if (value === null || value === undefined) {
        element.textContent = '--';
        element.className = 'param-badge neutral';
        return;
    }
    
    if (isLowerBetter) {
        if (value <= maxSafe) {
            element.textContent = safeLabel;
            element.className = 'param-badge safe';
        } else if (value <= maxSafe * 2) {
            element.textContent = warnLabel;
            element.className = 'param-badge warn';
        } else {
            element.textContent = dangerLabel;
            element.className = 'param-badge danger';
        }
    } else {
        if (value >= minSafe && value <= maxSafe) {
            element.textContent = safeLabel;
            element.className = 'param-badge safe';
        } else if (value < minSafe - 1 || value > maxSafe + 1) {
            element.textContent = dangerLabel;
            element.className = 'param-badge danger';
        } else {
            element.textContent = warnLabel;
            element.className = 'param-badge warn';
        }
    }
}

// ==================== AUTO-RECONNECT ====================
setInterval(function() {
    if (state.lastUpdateTime) {
        var now = new Date();
        var diff = (now - state.lastUpdateTime) / 1000;
        if (diff > 15 && state.espOnline) {
            state.espOnline = false;
            DOM.espBadge.className = 'badge inactive';
        }
    }
}, 5000);

setInterval(function() {
    if (!state.mqttConnected && client) {
        console.log('🔄 Auto-reconnect triggered...');
        client.reconnect();
    }
}, 30000);

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Smart RO Monitor Initialized');
    console.log('📡 MQTT Broker:', MQTT_BROKER);
    console.log('📋 Topic:', MQTT_TOPIC);
    initMQTT();
});

// ==================== EXPOSE FOR DEBUG ====================
window.debug = {
    state: state,
    DOM: DOM,
    client: client
};

console.log('🔧 Type "debug" in console to see state');
console.log('🔧 Type "debug.state" to see current data');
