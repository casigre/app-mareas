const OFFICIAL_TIDES = {
    "2026-04-14": {
        "muros": { "high": ["02:37", "15:06"], "low": ["08:55", "21:09"] },
        "ribeira": { "high": ["02:37", "15:04"], "low": ["08:55", "21:07"] }
    },
    "2026-04-15": {
        "muros": { "high": ["03:16", "15:43"], "low": ["09:32", "21:46"] },
        "ribeira": { "high": ["03:16", "15:43"], "low": ["09:29", "21:46"] }
    },
    "2026-04-16": {
        "muros": { "high": ["03:55", "16:18"], "low": ["10:06", "22:22"] },
        "ribeira": { "high": ["03:53", "16:15"], "low": ["10:06", "22:20"] }
    },
    "2026-04-17": {
        "muros": { "high": ["04:34", "16:54"], "low": ["10:43", "22:59"] },
        "ribeira": { "high": ["04:34", "16:54"], "low": ["10:43", "23:01"] }
    },
    "2026-04-18": {
        "muros": { "high": ["05:15", "17:33"], "low": ["11:22", "23:42"] },
        "ribeira": { "high": ["05:13", "17:31"], "low": ["11:20", "23:40"] }
    },
    "2026-04-19": {
        "muros": { "high": ["05:56", "18:17"], "low": ["12:01"] },
        "ribeira": { "high": ["05:54", "18:17"], "low": ["11:59"] }
    },
    "2026-04-20": {
        "muros": { "high": ["06:41", "19:00"], "low": ["00:24", "12:44"] },
        "ribeira": { "high": ["06:39", "19:00"], "low": ["00:24", "12:44"] }
    }
};

const LOCATIONS = {
    porto: { name: 'Porto do Son', lat: 42.6708, lon: -9.05, port: 'muros' },
    ribeira: { name: 'Ribeira', lat: 42.5502, lon: -8.96, port: 'ribeira' },
    aguino: { name: 'Aguiño', lat: 42.5207, lon: -9.03, port: 'ribeira' }
};

let currentLoc = 'porto';
let selectedDate = new Date().toISOString().split('T')[0];
let map, marker, marineData, weatherData;

function init() {
    initMap();
    renderDateSelector();
    refreshData();
    setInterval(updateClock, 60000);
    updateClock();
}

function initMap() {
    const loc = LOCATIONS[currentLoc];
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([loc.lat, loc.lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    marker = L.marker([loc.lat, loc.lon], {
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<div style="background: var(--accent); width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px var(--accent);"></div>'
        })
    }).addTo(map);
}

function renderDateSelector() {
    const selector = document.getElementById('date-selector');
    if (!selector) return;
    selector.innerHTML = '';
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        
        const btn = document.createElement('button');
        btn.className = `date-btn ${iso === selectedDate ? 'active' : ''}`;
        btn.onclick = () => selectDate(iso);
        
        const dayName = i === 0 ? 'Hoy' : i === 1 ? 'Mañ' : d.toLocaleDateString('es-ES', { weekday: 'short' });
        btn.innerHTML = `
            <span class="d-day">${dayName}</span>
            <span class="d-num">${d.getDate()}</span>
        `;
        selector.appendChild(btn);
    }
}

function selectDate(iso) {
    selectedDate = iso;
    renderDateSelector();
    updateUI();
}

function updateClock() {
    const now = new Date();
    const isTodaySelected = selectedDate === now.toISOString().split('T')[0];
    if (!isTodaySelected) return;
    
    document.getElementById('current-time').innerText = now.toLocaleTimeString('es-ES', { 
        hour: '2-digit', minute: '2-digit'
    }) + " - " + now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

async function setLocation(id) {
    if (id === currentLoc) return;
    currentLoc = id;
    const loc = LOCATIONS[id];
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.id === id));
    document.getElementById('location-name').innerText = loc.name;
    map.flyTo([loc.lat, loc.lon], 13, { duration: 1.5 });
    marker.setLatLng([loc.lat, loc.lon]);
    
    refreshData();
}

async function refreshData() {
    const loc = LOCATIONS[currentLoc];
    showLoading();
    
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${loc.lat}&longitude=${loc.lon}&hourly=wave_height,wave_period&minutely_15=sea_level_height_msl&timezone=auto&forecast_days=7`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=wind_speed_10m,wind_direction_10m&timezone=auto&forecast_days=7`;
    
    try {
        const [marineRes, weatherRes] = await Promise.all([
            fetch(marineUrl).then(r => r.json()),
            fetch(weatherUrl).then(r => r.json())
        ]);
        
        marineData = marineRes;
        weatherData = weatherRes;
        updateUI();
    } catch (error) {
        console.error("Error fetching data:", error);
        // Fallback or UI message
    }
}

function updateUI() {
    if (!marineData || !weatherData) return;
    
    const now = new Date();
    const isToday = selectedDate === now.toISOString().split('T')[0];
    const targetHour = isToday ? now.getHours() : 12;
    const targetTimeStr = selectedDate + `T${String(targetHour).padStart(2, '0')}:00`;
    
    // Process Waves (from Marine API)
    const mIdx = marineData.hourly.time.indexOf(targetTimeStr);
    const waveIdx = mIdx !== -1 ? mIdx : 0;
    const waveH = marineData.hourly.wave_height[waveIdx];
    const waveP = marineData.hourly.wave_period[waveIdx];

    document.getElementById('wave-height').innerText = waveH != null ? `${waveH.toFixed(1)} m` : 'Sin datos';
    document.getElementById('wave-period').innerText = waveP != null ? `${waveP.toFixed(0)} s` : '--';
    
    // Process Wind (from Weather API)
    const wIdx = weatherData.hourly.time.indexOf(targetTimeStr);
    const windIdx = wIdx !== -1 ? wIdx : 0;
    const windS = weatherData.hourly.wind_speed_10m[windIdx];
    const windD = weatherData.hourly.wind_direction_10m[windIdx];

    document.getElementById('wind-speed').innerText = windS != null ? `${windS.toFixed(0)} km/h` : 'Sin datos';
    document.getElementById('wind-dir').innerText = windD != null ? getWindDirection(windD) : '--';
    
    // Header date display
    const d = new Date(selectedDate);
    if (!isToday) {
        document.getElementById('current-time').innerText = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    } else {
        updateClock();
    }

    // Tides (Official)
    const tides = getOfficialTidesForDate(selectedDate);
    updateTideUI(tides, isToday);
    
    // Graph
    const start24 = marineData.minutely_15.time.findIndex(t => t.startsWith(selectedDate));
    if (start24 !== -1) {
        const sliceTimes = marineData.minutely_15.time.slice(start24, start24 + 96);
        const sliceHeights = marineData.minutely_15.sea_level_height_msl.slice(start24, start24 + 96);
        drawTideGraph(sliceTimes, sliceHeights, isToday ? now : null);
    }
}

function getOfficialTidesForDate(dateStr) {
    const locPort = LOCATIONS[currentLoc].port;
    const dayData = OFFICIAL_TIDES[dateStr];
    if (!dayData) return [];

    const portData = dayData[locPort];
    const events = [];
    portData.high.forEach(time => events.push({ type: 'Pleamar', time: combineDateAndTime(dateStr, time) }));
    portData.low.forEach(time => events.push({ type: 'Bajamar', time: combineDateAndTime(dateStr, time) }));
    
    const now = new Date();
    const isToday = dateStr === now.toISOString().split('T')[0];
    
    let filtered = events.sort((a, b) => a.time - b.time);
    if (isToday) filtered = filtered.filter(e => e.time > now).slice(0, 2);
    
    return filtered;
}

function combineDateAndTime(date, time) {
    return new Date(`${date}T${time}:00`);
}

function updateTideUI(tides, isToday) {
    const list = document.getElementById('tide-list');
    list.innerHTML = `<p style="font-size:0.7rem; color:var(--accent); margin-bottom:10px; opacity:0.8;">FUENTE OFICIAL: METEOGALICIA</p>`;
    
    if (tides.length === 0) {
        list.innerHTML += `<p>${isToday ? 'No hay más mareas hoy.' : 'No hay datos disponibles.'}</p>`;
        return;
    }
    
    tides.forEach(tide => {
        const item = document.createElement('div');
        item.className = 'tide-item';
        const typeClass = tide.type === 'Pleamar' ? 'high' : 'low';
        item.innerHTML = `
            <div class="tide-type ${typeClass}"><i class="fa-solid ${tide.type === 'Pleamar' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i><span>${tide.type}</span></div>
            <div class="tide-time">${tide.time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        list.appendChild(item);
    });
}

function drawTideGraph(times, heights, now) {
    const svg = document.getElementById('tide-graph');
    if (!svg) return;
    const width = 400; const height = 100;
    const maxVal = Math.max(...heights); const minVal = Math.min(...heights);
    const range = maxVal - minVal || 1;
    
    let pathData = "";
    heights.forEach((h, i) => {
        const x = (i / (heights.length - 1)) * width;
        const y = height - ((h - minVal) / range) * height;
        pathData += (i === 0 ? "M " : " L ") + `${x},${y}`;
    });

    let nowMarker = "";
    if (now) {
        const h = now.getHours();
        const m = Math.floor(now.getMinutes() / 15) * 15;
        const nowStr = selectedDate + `T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const idx = times.findIndex(t => t.startsWith(nowStr));
        if (idx !== -1) {
            const currentX = (idx / (heights.length - 1)) * width;
            nowMarker = `<line x1="${currentX}" y1="0" x2="${currentX}" y2="${height}" stroke="white" stroke-width="1" stroke-dasharray="4" />`;
        }
    }
    
    svg.innerHTML = `
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:var(--accent);stop-opacity:0.4" /><stop offset="100%" style="stop-color:var(--accent);stop-opacity:0" /></linearGradient>
        <path d="${pathData} L ${width},${height} L 0,${height} Z" fill="url(#grad)" stroke="none" />
        <path d="${pathData}" fill="none" stroke="var(--accent)" stroke-width="2" />
        ${nowMarker}
    `;
}

function getWindDirection(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
}

function showLoading() {
    document.getElementById('tide-list').innerHTML = '<div class="loading-spinner"></div>';
}

init();
