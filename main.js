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

const DEFAULT_LOCATIONS = [
    { id: 'porto', name: 'Porto do Son', lat: 42.6708, lon: -9.05, port: 'muros' },
    { id: 'ribeira', name: 'Ribeira', lat: 42.5502, lon: -8.96, port: 'ribeira' },
    { id: 'aguino', name: 'Aguiño', lat: 42.5207, lon: -9.03, port: 'ribeira' }
];

let myLocations = [];
let currentLocId = 'porto';
let selectedDate = new Date().toISOString().split('T')[0];
let map, marker, marineData, weatherData, searchTimeout;

function init() {
    loadLocations();
    initMap();
    renderDateSelector();
    renderLocationsList();
    refreshData();
    setInterval(updateClock, 60000);
    updateClock();
}

function loadLocations() {
    const saved = localStorage.getItem('mareas_my_locations');
    myLocations = saved ? JSON.parse(saved) : DEFAULT_LOCATIONS;
    currentLocId = localStorage.getItem('mareas_last_loc') || myLocations[0].id;
}

function saveLocations() {
    localStorage.setItem('mareas_my_locations', JSON.stringify(myLocations));
}

function initMap() {
    const loc = myLocations.find(l => l.id === currentLocId) || myLocations[0];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([loc.lat, loc.lon], 13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Tiles &copy; Esri'
    }).addTo(map);
    marker = L.marker([loc.lat, loc.lon], {
        icon: L.divIcon({ className: 'custom-marker', html: '<div style="background: var(--accent); width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px var(--accent);"></div>' })
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
        btn.innerHTML = `<span class="d-day">${dayName}</span><span class="d-num">${d.getDate()}</span>`;
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
    if (selectedDate !== now.toISOString().split('T')[0]) return;
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.innerText = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) + " - " + now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function toggleLocationsModal(e) {
    const modal = document.getElementById('locations-modal');
    if (!modal) return;
    const isVisible = modal.style.display === 'flex';
    modal.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
        const searchInput = document.getElementById('location-search');
        if (searchInput) searchInput.value = '';
        const searchResults = document.getElementById('search-results');
        if (searchResults) searchResults.style.display = 'none';
    }
}

function renderLocationsList() {
    const list = document.getElementById('my-locations-list');
    if (!list) return;
    list.innerHTML = '';
    myLocations.forEach(loc => {
        const item = document.createElement('div');
        item.className = `loc-item ${loc.id === currentLocId ? 'active' : ''}`;
        item.onclick = () => setLocation(loc.id);
        item.innerHTML = `
            <div class="loc-info">
                <span class="loc-name">${loc.name}</span>
                <span class="loc-coords">${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)}</span>
            </div>
            ${myLocations.length > 1 ? `<button class="delete-loc-btn" onclick="deleteLocation(event, '${loc.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
        `;
        list.appendChild(item);
    });
}

function debounceSearch() {
    clearTimeout(searchTimeout);
    const queryEl = document.getElementById('location-search');
    const query = queryEl ? queryEl.value : '';
    if (query.length < 3) {
        const results = document.getElementById('search-results');
        if (results) results.style.display = 'none';
        return;
    }
    searchTimeout = setTimeout(() => searchLocations(query), 500);
}

async function searchLocations(query) {
    const resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) return;
    resultsDiv.innerHTML = '<div class="search-result-item">Buscando...</div>';
    resultsDiv.style.display = 'block';
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&countrycodes=es`);
        const data = await res.json();
        resultsDiv.innerHTML = '';
        if (data.length === 0) {
            resultsDiv.innerHTML = '<div class="search-result-item">Sin resultados</div>';
        }
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerText = item.display_name;
            div.onclick = () => addLocation(item.display_name.split(',')[0], parseFloat(item.lat), parseFloat(item.lon));
            resultsDiv.appendChild(div);
        });
    } catch (e) {
        resultsDiv.innerHTML = '<div class="search-result-item">Error en la búsqueda</div>';
    }
}

function addLocation(name, lat, lon) {
    const id = 'loc_' + Date.now();
    const port = lat > 42.61 ? 'muros' : 'ribeira';
    const newLoc = { id, name, lat, lon, port };
    myLocations.push(newLoc);
    saveLocations();
    renderLocationsList();
    setLocation(id);
    toggleLocationsModal();
}

function deleteLocation(e, id) {
    e.stopPropagation();
    myLocations = myLocations.filter(l => l.id !== id);
    if (currentLocId === id) currentLocId = myLocations[0].id;
    saveLocations();
    renderLocationsList();
    if (currentLocId !== id) setLocation(currentLocId);
}

async function setLocation(id) {
    currentLocId = id;
    localStorage.setItem('mareas_last_loc', id);
    const loc = myLocations.find(l => l.id === id);
    if (loc) {
        const locNameEl = document.getElementById('location-name');
        if (locNameEl) locNameEl.innerText = loc.name;
        map.flyTo([loc.lat, loc.lon], 13, { duration: 1.5 });
        marker.setLatLng([loc.lat, loc.lon]);
        renderLocationsList();
        refreshData();
    }
    const modal = document.getElementById('locations-modal');
    if (modal && modal.style.display === 'flex') toggleLocationsModal();
}

async function refreshData() {
    const loc = myLocations.find(l => l.id === currentLocId);
    if (!loc) return;
    showLoading();
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${loc.lat}&longitude=${loc.lon}&hourly=wave_height,wave_period&minutely_15=sea_level_height_msl&timezone=auto&forecast_days=7`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=wind_speed_10m,wind_direction_10m,precipitation,precipitation_probability&Daily=sunrise,sunset&timezone=auto&forecast_days=7`;
    try {
        const [mRes, wRes] = await Promise.all([fetch(marineUrl).then(r => r.json()), fetch(weatherUrl).then(r => r.json())]);
        marineData = mRes; weatherData = wRes;
        updateUI();
    } catch (error) { console.error("Error:", error); }
}

function updateUI() {
    if (!marineData || !weatherData) return;
    const now = new Date();
    const isToday = selectedDate === now.toISOString().split('T')[0];
    const targetHour = isToday ? now.getHours() : 12;
    const targetTimeStr = selectedDate + `T${String(targetHour).padStart(2, '0')}:00`;
    const mIdx = marineData.hourly.time.indexOf(targetTimeStr);
    const idx = mIdx !== -1 ? mIdx : 0;
    const wIdx = weatherData.hourly.time.indexOf(targetTimeStr);
    const windIdx = wIdx !== -1 ? wIdx : 0;

    const waveHEl = document.getElementById('wave-height');
    if (waveHEl) waveHEl.innerText = marineData.hourly.wave_height[idx] != null ? `${marineData.hourly.wave_height[idx].toFixed(1)} m` : '--';
    const wavePEl = document.getElementById('wave-period');
    if (wavePEl) wavePEl.innerText = marineData.hourly.wave_period[idx] != null ? `${marineData.hourly.wave_period[idx].toFixed(0)} s` : '--';
    const windSEl = document.getElementById('wind-speed');
    if (windSEl) windSEl.innerText = weatherData.hourly.wind_speed_10m[windIdx] != null ? `${weatherData.hourly.wind_speed_10m[windIdx].toFixed(0)} km/h` : '--';
    const windDEl = document.getElementById('wind-dir');
    if (windDEl) windDEl.innerText = weatherData.hourly.wind_direction_10m[windIdx] != null ? getWindDirection(weatherData.hourly.wind_direction_10m[windIdx]) : '--';
    
    document.getElementById('precip-prob').innerText = weatherData.hourly.precipitation_probability[windIdx] != null ? `${weatherData.hourly.precipitation_probability[windIdx]}%` : '--%';
    document.getElementById('precip-amount').innerText = weatherData.hourly.precipitation[windIdx] != null ? `${weatherData.hourly.precipitation[windIdx].toFixed(1)} mm` : '--';

    const d = new Date(selectedDate);
    const timeEl = document.getElementById('current-time');
    if (!isToday) { if (timeEl) timeEl.innerText = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); }
    else updateClock();

    const tides = getOfficialTidesForDate(selectedDate);
    updateTideUI(tides, isToday);
    
    // Graph
    const start24 = marineData.minutely_15.time.findIndex(t => t.startsWith(selectedDate));
    if (start24 !== -1) {
        const sliceTimes = marineData.minutely_15.time.slice(start24, start24 + 96);
        const sliceHeights = marineData.minutely_15.sea_level_height_msl.slice(start24, start24 + 96);
        drawTideGraph(sliceTimes, sliceHeights, isToday ? now : null);
    }

    updateFishingUI();
}

function updateFishingUI() {
    const loc = myLocations.find(l => l.id === currentLocId);
    if (!loc) return;
    const date = new Date(selectedDate);
    
    const sunTimes = SunCalc.getTimes(date, loc.lat, loc.lon);
    const moonTimes = SunCalc.getMoonTimes(date, loc.lat, loc.lon);
    const moonIllum = SunCalc.getMoonIllumination(date);
    let nadir = null;
    if (moonTimes.mainTransit) nadir = new Date(moonTimes.mainTransit.getTime() + 12.42 * 3600000);
    
    let hourlyScores = [];
    for (let h = 0; h < 24; h++) {
        let score = 20;
        let hourDate = new Date(date); hourDate.setHours(h);
        if (moonTimes.mainTransit && Math.abs(hourDate - moonTimes.mainTransit) < 5400000) score += 35;
        if (nadir && Math.abs(hourDate - nadir) < 5400000) score += 30;
        if (moonTimes.rise && Math.abs(hourDate - moonTimes.rise) < 3600000) score += 15;
        if (moonTimes.set && Math.abs(hourDate - moonTimes.set) < 3600000) score += 15;
        if (Math.abs(hourDate - sunTimes.sunrise) < 3600000 || Math.abs(hourDate - sunTimes.sunset) < 3600000) score += 20;

        let dayTides = getOfficialTidesFullDay(selectedDate);
        dayTides.forEach(tide => {
            const timeDiff = Math.abs(hourDate - tide.time);
            if (timeDiff < 3600000) score += 25;
            else if (timeDiff < 7200000) score += 15;
        });
        if (moonIllum.phase < 0.05 || moonIllum.phase > 0.95 || (moonIllum.phase > 0.45 && moonIllum.phase < 0.55)) score *= 1.3;
        hourlyScores.push({ hour: h, score: Math.min(100, score) });
    }
    
    // Find the two best non-contiguous periods
    const sorted = [...hourlyScores].sort((a,b) => b.score - a.score);
    const best1 = sorted[0];
    const best2 = sorted.find(s => Math.abs(s.hour - best1.hour) >= 6) || sorted[1];
    
    const peaks = [best1, best2].sort((a,b) => a.hour - b.hour);
    
    peaks.forEach((peak, i) => {
        const num = i + 1;
        const level = peak.score > 85 ? 'Excelente' : peak.score > 70 ? 'Muy Buena' : peak.score > 50 ? 'Buena' : peak.score > 30 ? 'Media' : 'Baja';
        const color = peak.score > 85 ? '#FFD700' : peak.score > 70 ? '#FF8C00' : peak.score > 50 ? '#4CAF50' : '#00D2FF';
        
        document.getElementById(`fishing-time-${num}`).innerText = `${String(peak.hour).padStart(2,'0')}:00`;
        document.getElementById(`fishing-level-${num}`).innerText = level;
        const bar = document.getElementById(`fishing-score-bar-${num}`);
        if (bar) {
            bar.style.setProperty('--activity-percent', `${peak.score}%`);
            bar.style.setProperty('--activity-color', color);
        }
    });
}

function getOfficialTidesFullDay(dateStr) {
    const loc = myLocations.find(l => l.id === currentLocId);
    if (!loc) return [];
    const dayData = OFFICIAL_TIDES[dateStr];
    if (!dayData) return [];
    const portData = dayData[loc.port];
    const events = [];
    portData.high.forEach(t => events.push({ type: 'Pleamar', time: combineDateAndTime(dateStr, t) }));
    portData.low.forEach(t => events.push({ type: 'Bajamar', time: combineDateAndTime(dateStr, t) }));
    return events.sort((a,b) => a.time - b.time);
}

function getOfficialTidesForDate(dateStr) {
    const events = getOfficialTidesFullDay(dateStr);
    const now = new Date();
    const isToday = dateStr === now.toISOString().split('T')[0];
    let filtered = events;
    if (isToday) filtered = filtered.filter(e => e.time > now).slice(0, 2);
    return filtered;
}

function combineDateAndTime(date, time) { return new Date(`${date}T${time}:00`); }

function updateTideUI(tides, isToday) {
    const list = document.getElementById('tide-list');
    if (!list) return;
    list.innerHTML = `<p style="font-size:0.7rem; color:var(--accent); margin-bottom:10px; opacity:0.8;">FUENTE OFICIAL: METEOGALICIA</p>`;
    if (tides.length === 0) { list.innerHTML += `<p>${isToday ? 'No hay más mareas hoy.' : 'No hay datos.'}</p>`; return; }
    tides.forEach(t => {
        const item = document.createElement('div'); item.className = 'tide-item';
        item.innerHTML = `<div class="tide-type ${t.type === 'Pleamar' ? 'high' : 'low'}"><i class="fa-solid ${t.type === 'Pleamar' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i><span>${t.type}</span></div><div class="tide-time">${t.time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>`;
        list.appendChild(item);
    });
}

function drawTideGraph(times, heights, now) {
    const svg = document.getElementById('tide-graph'); if (!svg) return;
    const width = 400; const height = 100;
    const maxVal = Math.max(...heights); const minVal = Math.min(...heights);
    const range = maxVal - minVal || 1;
    let pathData = "";
    heights.forEach((h, i) => { const x = (i / (heights.length-1)) * width; const y = height - ((h - minVal) / range) * height; pathData += (i === 0 ? "M " : " L ") + `${x},${y}`; });
    let nowMarker = "";
    if (now) {
        const h = now.getHours(); const m = Math.floor(now.getMinutes()/15)*15;
        const nowStr = selectedDate + `T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        const idx = times.findIndex(t => t.startsWith(nowStr));
        if (idx !== -1) { const currentX = (idx / (heights.length - 1)) * width; nowMarker = `<line x1="${currentX}" y1="0" x2="${currentX}" y2="${height}" stroke="white" stroke-width="1" stroke-dasharray="4" />`; }
    }
    svg.innerHTML = `<linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:var(--accent);stop-opacity:0.4" /><stop offset="100%" style="stop-color:var(--accent);stop-opacity:0" /></linearGradient><path d="${pathData} L ${width},${height} L 0,${height} Z" fill="url(#grad)" stroke="none" /><path d="${pathData}" fill="none" stroke="var(--accent)" stroke-width="2" />${nowMarker}`;
}

function getWindDirection(deg) { const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; return directions[Math.round(deg / 45) % 8]; }
function showLoading() {
    const list = document.getElementById('tide-list');
    if (list) list.innerHTML = '<div class="loading-spinner"></div>';
}
init();
