/**
 * ============================================================
 * SMART RO WATER QUALITY MONITOR - MQTT Web Client
 * FULLY SYNCHRONIZED WITH ESP32 .ino
 * WITH FILTER STATUS: NORMAL / CEK / GANTI
 * FIXED SYNTAX ERROR
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
    filterNeedReplacement: null,
    filterReason: null,
    filterRecommendation: null,
    filterScore: null,
    filterStatus: null,
    filterStatusColor: null,
    filterStatusEmoji: null,
    phWarning: null,
};

// ==================== CHARTS ====================
let charts = {
    ph: null,
    tds: null,
    labels: [],
    phData: [],
    tdsData: [],
    maxPoints: 20
};

// ==================== INIT CHARTS ====================
function initCharts() {
    Chart.defaults.color = 'rgba(255,255,255,0.5)';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.font.size = 10;

    // pH Chart
    const phCtx = document.getElementById('phChart').getContext('2d');
    const phGradient = phCtx.createLinearGradient(0, 0, 0, 200);
    phGradient.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
    phGradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    charts.ph = new Chart(phCtx, {
        type: 'line',
        data: {
            labels: charts.labels,
            datasets: [{
                data: charts.phData,
                borderColor: '#00F0FF',
                backgroundColor: phGradient,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(6,19,37,0.9)',
                    titleColor: '#fff',
                    bodyColor: '#00F0FF',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    ticks: { maxTicksLimit: 6, color: 'rgba(255,255,255,0.3)' } 
                },
                y: { 
                    min: 0, 
                    max: 14, 
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: 'rgba(255,255,255,0.3)' } 
                }
            }
        }
    });

    // TDS Chart
    const tdsCtx = document.getElementById('tdsChart').getContext('2d');
    const tdsGradient = tdsCtx.createLinearGradient(0, 0, 0, 200);
    tdsGradient.addColorStop(0, 'rgba(0, 255, 102, 0.4)');
    tdsGradient.addColorStop(1, 'rgba(0, 255, 102, 0.0)');

    charts.tds = new Chart(tdsCtx, {
        type: 'line',
        data: {
            labels: charts.labels,
            datasets: [{
                data: charts.tdsData,
                borderColor: '#00FF66',
                backgroundColor: tdsGradient,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(6,19,37,0.9)',
                    titleColor: '#fff',
                    bodyColor: '#00FF66',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    ticks: { maxTicksLimit: 6, color: 'rgba(255,255,255,0.3)' } 
                },
                y: { 
                    min: 0, 
                    max: 500, 
                    grid: { color: 'rgba(255,255,255,0.05)' }, 
                    ticks: { color: 'rgba(255,255,255,0.3)' } 
                }
            }
        }
    });
}

// ==================== UPDATE CHARTS ====================
function updateCharts(ph, tds) {
    const now = new Date();
    const label = now.getHours().toString().padStart(2, '0') + ':' + 
                  now.getMinutes().toString().padStart(2, '0');

    if (ph !== null && ph !== undefined) {
        charts.labels.push(label);
        charts.phData.push(ph);
        if (charts.labels.length > charts.maxPoints) {
            charts.labels.shift();
            charts.phData.shift();
        }
        charts.ph.data.labels = charts.labels;
        charts.ph.data.datasets[0].data = charts.phData;
        charts.ph.update('none');
    }

    if (tds !== null && tds !== undefined) {
        charts.tdsData.push(tds);
        if (charts.tdsData.length > charts.maxPoints) {
            charts.tdsData.shift();
        }
        charts.tds.data.labels = charts.labels;
        charts.tds.data.datasets[0].data = charts.tdsData;
        charts.tds.update('none');
    }
}

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
            updateConnectionUI('connected', 'Broker Connected');
            DOM.mqttBadge.className = 'badge active';
            
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
            console.log('📥 Raw message received on topic:', topic);
            
            if (topic === MQTT_TOPIC) {
                handleIncomingData(message.toString());
            }
        });

        client.on('error', function(error) {
            console.error('❌ MQTT Error:', error);
            state.mqttConnected = false;
            updateConnectionUI('disconnected', 'Connection Error');
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

        client.on('reconnect', function() {
            console.log('🔄 MQTT Reconnecting...');
            DOM.lastMessage.textContent = '🔄 MQTT Reconnecting...';
        });

    } catch (e) {
        console.error('❌ Connection error:', e);
        DOM.lastMessage.textContent = '❌ Connection error: ' + e.message;
        setTimeout(initMQTT, 5000);
    }
}

function handleIncomingData(payload) {
    console.log('📥 Processing payload...');
    
    try {
        const data = JSON.parse(payload);
        console.log('✅ JSON parsed successfully:', data);
        
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
        state.filterNeedReplacement = data.filter_need_replacement !== undefined ? data.filter_need_replacement : false;
        state.filterReason = data.filter_reason || "No data";
        state.filterRecommendation = data.filter_recommendation || "No data";
        state.filterScore = data.filter_score !== undefined ? data.filter_score : null;
        state.filterStatus = data.filter_status || "NORMAL";
        state.filterStatusColor = data.filter_status_color || "GREEN";
        state.filterStatusEmoji = data.filter_status_emoji || "🟢";
        state.phWarning = data.ph_warning !== undefined ? data.ph_warning : false;

        console.log('📊 Updated state:', state);
        updateUI();
        
    } catch (e) {
        console.error('❌ Failed to parse JSON:', e);
        console.error('📄 Payload was:', payload);
        DOM.lastMessage.textContent = '❌ Parse error: ' + e.message + '\nPayload: ' + payload.substring(0, 100) + '...';
    }
}

function updateConnectionUI(status, text) {
    DOM.connText.textContent = text;
    DOM.connDot.className = 'dot ' + (status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected');
}

// ==================== UI UPDATES ====================
function updateUI() {
    console.log('🔄 Updating UI...');
    
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
    
    var iconClass = 'fa-check';
    var wrapperClass = 'status-icon-wrapper good';
    var detailText = "Water is safe for consumption.";
    var textClass = 'good-text';
    
    if (status === "TIDAK LAYAK" || status === "BAHAYA") {
        iconClass = 'fa-triangle-exclamation';
        wrapperClass = 'status-icon-wrapper bad';
        detailText = "Water quality is unsafe. Do not consume.";
        textClass = 'bad-text';
    } else if (status === "PERINGATAN" || status === "KURANG LAYAK" || status === "CUKUP") {
        iconClass = 'fa-circle-exclamation';
        wrapperClass = 'status-icon-wrapper warning';
        detailText = "Parameters are borderline. Proceed with caution.";
        textClass = 'warning-text';
    } else if (status === "LAYAK" || status === "SAFE") {
        iconClass = 'fa-check';
        wrapperClass = 'status-icon-wrapper good';
        detailText = "Water is safe for consumption.";
        textClass = 'good-text';
    }
    
    DOM.statusIconWrapper.className = wrapperClass;
    DOM.statusIconWrapper.innerHTML = '<i class="fa-solid ' + iconClass + '"></i>';
    DOM.statusDetail.textContent = detailText;
    DOM.waterStatusText.className = textClass;
    
    // 4. Sensors
    if (state.ph !== null) {
        DOM.phValue.textContent = state.ph.toFixed(2);
        updateParamBadge(DOM.phBadge, state.ph, 6.5, 8.5, "OPTIMAL", "WARNING", "DANGER");
    }
    
    if (state.tds !== null) {
        DOM.tdsValue.textContent = Math.round(state.tds);
        updateParamBadge(DOM.tdsBadge, state.tds, 0, 50, "PURE", "HIGH TDS", "VERY HIGH", true);
    }
    
    if (state.turbidity !== null) {
        DOM.turbidityValue.textContent = state.turbidity.toFixed(2);
        updateParamBadge(DOM.turbBadge, state.turbidity, 0, 5, "CLEAR", "CLOUDY", "DIRTY", true);
    }
    
    if (state.temperature !== null) {
        DOM.tempValue.textContent = state.temperature.toFixed(1);
        updateParamBadge(DOM.tempBadge, state.temperature, 15, 35, "NOMINAL", "WARNING", "ALERT");
    }
    
    // 5. Filter Health & Stats
    if (state.health !== null) {
        var health = state.health;
        DOM.filterHealth.textContent = Math.round(health) + '%';
        DOM.healthBar.style.width = Math.min(health, 100) + '%';
        
        if (health > 70) {
            DOM.healthBar.style.background = 'linear-gradient(90deg, #00F0FF, #00FF66)';
        } else if (health > 40) {
            DOM.healthBar.style.background = 'linear-gradient(90deg, #FFD700, #00FF66)';
        } else {
            DOM.healthBar.style.background = 'linear-gradient(90deg, #FF2A54, #FFD700)';
        }
    }
    
    if (state.daysLeft !== null) {
        DOM.daysLeft.textContent = state.daysLeft + ' Days';
    }
    
    if (state.volume !== null) {
        DOM.volumeTotal.textContent = state.volume.toFixed(2) + ' L';
    }
    
    // 6. FILTER REPLACEMENT
    updateFilterReplacement({
        needReplacement: state.filterNeedReplacement,
        filterHealth: state.health,
        filterScore: state.filterScore,
        filterReason: state.filterReason,
        filterRecommendation: state.filterRecommendation,
        daysLeft: state.daysLeft,
        filterStatus: state.filterStatus,
        filterStatusColor: state.filterStatusColor,
        filterStatusEmoji: state.filterStatusEmoji
    });
    
    // 7. Update Charts
    updateCharts(state.ph, state.tds);
}

// ==================== FILTER REPLACEMENT ====================
function updateFilterReplacement(data) {
    if (!data) return;
    
    var needReplace = data.needReplacement || false;
    var filterScore = data.filterHealth || data.filterScore || 0;
    var filterReason = data.filterReason || "Normal";
    var filterRecommend = data.filterRecommendation || "Lanjutkan pemantauan";
    var daysLeft = data.daysLeft || 0;
    
    // Gunakan status dari ESP32 jika ada, atau hitung ulang
    var statusText = data.filterStatus || '';
    var statusColor = data.filterStatusColor || '';
    var statusEmoji = data.filterStatusEmoji || '';
    
    // Jika tidak ada status dari ESP32, hitung berdasarkan skor
    if (!statusText) {
        if (needReplace || filterScore < 40) {
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
    
    // DOM Elements
    var statusElement = document.getElementById('filterReplaceStatus');
    var scoreElement = document.getElementById('filterReplaceScore');
    var daysElement = document.getElementById('filterReplaceDays');
    var reasonElement = document.getElementById('filterReplaceReason');
    var recommendElement = document.getElementById('filterReplaceRecommend');
    
    // Map color to CSS class
    var ledClass = 'led-green';
    var textClass = 'text-filter-normal';
    
    switch(statusColor.toUpperCase()) {
        case 'GREEN':
            ledClass = 'led-green';
            textClass = 'text-filter-normal';
            break;
        case 'YELLOW':
            ledClass = 'led-yellow';
            textClass = 'text-filter-check';
            break;
        case 'RED':
            ledClass = 'led-red';
            textClass = 'text-filter-replace';
            break;
        default:
            ledClass = 'led-green';
            textClass = 'text-filter-normal';
    }
    
    // UPDATE UI
    if (statusElement) {
        statusElement.innerHTML = 
            '<span class="status-led ' + ledClass + '"></span>' +
            '<span class="' + textClass + '">' + statusEmoji + ' ' + statusText + '</span>' +
            '<span class="text-xs text-white/40 ml-1">(' + filterScore.toFixed(0) + '%)</span>';
    }
    
    if (scoreElement) {
        scoreElement.textContent = filterScore.toFixed(0) + '%';
        if (filterScore < 40) {
            scoreElement.className = 'text-sm font-mono text-[#FF2A54] font-bold';
        } else if (filterScore < 70) {
            scoreElement.className = 'text-sm font-mono text-[#FFD700] font-bold';
        } else {
            scoreElement.className = 'text-sm font-mono text-[#00FF66] font-bold';
        }
    }
    
    if (daysElement) {
        if (daysLeft > 0) {
            daysElement.textContent = daysLeft + ' hari';
            daysElement.className = 'text-sm font-mono text-white';
        } else {
            daysElement.textContent = '⚠️ Segera!';
            daysElement.className = 'text-sm font-mono text-[#FF2A54] font-bold';
        }
    }
    
    if (reasonElement) {
        reasonElement.textContent = filterReason;
    }
    
    if (recommendElement) {
        recommendElement.textContent = filterRecommend;
    }
}

// ==================== BADGE HELPER ====================
function updateParamBadge(element, value, minSafe, maxSafe, safeLabel, warnLabel, dangerLabel, isLowerBetter) {
    if (isLowerBetter === undefined) isLowerBetter = false;
    
    if (value === null || value === undefined) {
        element.textContent = '--';
        element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/40 border border-white/10 uppercase tracking-wider';
        return;
    }
    
    if (isLowerBetter) {
        if (value <= maxSafe) {
            element.textContent = safeLabel;
            element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 uppercase tracking-wider';
        } else if (value <= maxSafe * 2) {
            element.textContent = warnLabel;
            element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 uppercase tracking-wider';
        } else {
            element.textContent = dangerLabel;
            element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF2A54]/15 text-[#FF2A54] border border-[#FF2A54]/30 uppercase tracking-wider animate-pulse';
        }
    } else {
        if (value >= minSafe && value <= maxSafe) {
            element.textContent = safeLabel;
            element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 uppercase tracking-wider';
        } else if (value < minSafe - 1 || value > maxSafe + 1) {
            element.textContent = dangerLabel;
            element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF2A54]/15 text-[#FF2A54] border border-[#FF2A54]/30 uppercase tracking-wider animate-pulse';
        } else {
            element.textContent = warnLabel;
            element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 uppercase tracking-wider';
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
    initCharts();
    initMQTT();
});

// ==================== EXPOSE FOR DEBUG ====================
window.debug = {
    state: state,
    DOM: DOM,
    client: client,
    MQTT_CONFIG: { broker: MQTT_BROKER, topic: MQTT_TOPIC }
};

console.log('🔧 Debug: Type "debug" in console to see state');
console.log('🔧 Debug: Type "debug.state" to see current data');
