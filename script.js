/**
 * ============================================================
 * SMART RO WATER QUALITY MONITOR - MQTT Web Client
 * FULLY SYNCHRONIZED WITH ESP32 .ino
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
    filterReplaceDays: document.getElementById('filterReplaceDays'),
    filterReplaceReason: document.getElementById('filterReplaceReason'),
    filterReplaceRecommend: document.getElementById('filterReplaceRecommend'),
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
    filterStatus: null,
    filterStatusColor: null,
    filterStatusEmoji: null,
};

// ==================== MQTT LOGIC ====================
function initMQTT() {
    console.log('🔄 Connecting to MQTT...');
    updateConnectionUI('connecting', 'Connecting...');
    
    try {
        client = mqtt.connect(MQTT_BROKER, {
            clientId: 'ro_dash_' + Math.random().toString(16).substr(2, 8),
            reconnectPeriod: 3000,
            keepAlive: 60,
            clean: true
        });

        client.on('connect', function() {
            console.log('✅ Connected to MQTT Broker');
            state.mqttConnected = true;
            updateConnectionUI('connected', 'Connected');
            DOM.mqttBadge.className = 'badge active';
            DOM.espBadge.className = 'badge neutral';
            
            client.subscribe(MQTT_TOPIC, { qos: 1 }, function(err) {
                if (!err) {
                    console.log('✅ Subscribed to topic:', MQTT_TOPIC);
                    DOM.lastMessage.textContent = '✅ Subscribed to: ' + MQTT_TOPIC;
                } else {
                    console.error('❌ Subscribe error:', err);
                    DOM.lastMessage.textContent = '❌ Subscribe error: ' + err.message;
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
            DOM.lastMessage.textContent = '⚠️ MQTT Offline - Reconnecting...';
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
        console.log('📥 Data received:', data);
        
        // Update State
        state.messageCount++;
        state.lastUpdateTime = new Date();
        state.espOnline = true;
        state.lastData = data;
        
        // Populate state values
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
        state.filterStatus = data.filter_status || "NORMAL";
        state.filterStatusColor = data.filter_status_color || "GREEN";
        state.filterStatusEmoji = data.filter_status_emoji || "🟢";

        updateUI();
        
    } catch (e) {
        console.error('❌ Failed to parse JSON:', e);
        console.error('📄 Payload was:', payload);
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
    DOM.dataCount.textContent = state.messageCount;
    if (state.lastUpdateTime) {
        DOM.lastUpdate.textContent = state.lastUpdateTime.toLocaleTimeString();
    }
    
    // 2. Raw Debug JSON
    if (state.lastData) {
        DOM.lastMessage.textContent = JSON.stringify(state.lastData, null, 2);
    }
    
    // 3. Overall Status
    var status = state.status || "MENUNGGU";
    DOM.waterStatusText.textContent = status;
    
    var wrapperClass = 'status-icon-wrapper good';
    var detailText = "Water is safe for consumption.";
    var textClass = 'good-text';
    var iconText = '✅';
    
    if (status === "TIDAK LAYAK" || status === "BAHAYA") {
        wrapperClass = 'status-icon-wrapper bad';
        detailText = "Water quality is unsafe. Do not consume.";
        textClass = 'bad-text';
        iconText = '❌';
    } else if (status === "PERINGATAN" || status === "KURANG LAYAK" || status === "CUKUP") {
        wrapperClass = 'status-icon-wrapper warning';
        detailText = "Parameters are borderline. Proceed with caution.";
        textClass = 'warning-text';
        iconText = '⚠️';
    } else if (status === "LAYAK" || status === "SAFE") {
        wrapperClass = 'status-icon-wrapper good';
        detailText = "Water is safe for consumption.";
        textClass = 'good-text';
        iconText = '✅';
    }
    
    DOM.statusIconWrapper.className = wrapperClass;
    DOM.statusIconWrapper.innerHTML = '<span>' + iconText + '</span>';
    DOM.statusDetail.textContent = detailText;
    DOM.waterStatusText.className = textClass;
    
    // 4. Sensors
    if (state.ph !== null) {
        DOM.phValue.textContent = state.ph.toFixed(2);
        updateParamBadge(DOM.phBadge, state.ph, 6.5, 8.5, "Safe", "Warn", "Danger");
    }
    
    if (state.tds !== null) {
        DOM.tdsValue.textContent = Math.round(state.tds);
        updateParamBadge(DOM.tdsBadge, state.tds, 0, 50, "Pure", "High", "Very High", true);
    }
    
    if (state.turbidity !== null) {
        DOM.turbidityValue.textContent = state.turbidity.toFixed(2);
        updateParamBadge(DOM.turbBadge, state.turbidity, 0, 5, "Clear", "Cloudy", "Dirty", true);
    }
    
    if (state.temperature !== null) {
        DOM.tempValue.textContent = state.temperature.toFixed(1);
        updateParamBadge(DOM.tempBadge, state.temperature, 15, 35, "Normal", "Warn", "Alert");
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
        DOM.daysLeft.textContent = state.daysLeft + ' days';
    }
    
    if (state.volume !== null) {
        DOM.volumeTotal.textContent = state.volume.toFixed(2) + ' L';
    }
    
    // 6. Filter Status
    updateFilterStatus({
        filterScore: state.filterScore || state.health || 0,
        filterStatus: state.filterStatus,
        filterStatusColor: state.filterStatusColor,
        filterStatusEmoji: state.filterStatusEmoji,
        daysLeft: state.daysLeft
    });
}

// ==================== FILTER STATUS ====================
function updateFilterStatus(data) {
    if (!data) return;
    
    var filterScore = data.filterScore || 0;
    var daysLeft = data.daysLeft || 0;
    
    // Gunakan status dari ESP32 atau hitung ulang
    var statusText = data.filterStatus || '';
    var statusColor = data.filterStatusColor || '';
    var statusEmoji = data.filterStatusEmoji || '';
    
    // Jika tidak ada status dari ESP32, hitung berdasarkan skor
    if (!statusText) {
        if (filterScore < 40) {
            statusText = 'GANTI';
            statusColor = 'RED';
            statusEmoji = '🔴';
        } else if (filterScore < 70) {
            statusText = 'CEK';
            statusColor = 'YELLOW';
            statusEmoji = '🟡';
        } else {
            statusText = 'NORMAL';
            statusColor = 'GREEN';
            statusEmoji = '🟢';
        }
    }
    
    // Map color to CSS class
    var badgeClass = 'badge-success';
    var statusDisplay = '✅ Normal';
    
    switch(statusColor.toUpperCase()) {
        case 'GREEN':
            badgeClass = 'badge-success';
            statusDisplay = '✅ ' + statusText;
            break;
        case 'YELLOW':
            badgeClass = 'badge-warning';
            statusDisplay = '⚠️ ' + statusText;
            break;
        case 'RED':
            badgeClass = 'badge-danger';
            statusDisplay = '🔴 ' + statusText;
            break;
        default:
            badgeClass = 'badge-neutral';
            statusDisplay = '⏳ ' + statusText;
    }
    
    // Update UI
    if (DOM.filterReplaceStatus) {
        DOM.filterReplaceStatus.textContent = statusDisplay;
        DOM.filterReplaceStatus.className = 'insight-val ' + badgeClass;
    }
    
    if (DOM.filterReplaceScore) {
        DOM.filterReplaceScore.textContent = Math.round(filterScore) + '/100';
    }
    
    if (DOM.filterReplaceDays) {
        if (daysLeft > 0) {
            DOM.filterReplaceDays.textContent = daysLeft + ' days';
        } else {
            DOM.filterReplaceDays.textContent = '⚠️ Segera!';
        }
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
