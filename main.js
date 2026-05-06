// Se cargará dinámicamente desde MeteoGalicia
let dynamicTides = {};

const METEOGALICIA_ZONES = [
    { id: 1, name: 'Costa Cantábrica', latMin: 43.55 },
    { id: 2, name: 'Ferrol-Bares', latMin: 43.45 },
    { id: 3, name: 'Ártabro', latMin: 43.30 },
    { id: 4, name: 'Costa da Morte', latMin: 42.90 },
    { id: 5, name: 'Rías Baixas', latMin: 0 }
];

const METEOGALICIA_PORTS = {
    'muros': 12,
    'ribeira': 11
};

const DEFAULT_LOCATIONS = [
    { id: 'porto', name: 'Porto do Son', lat: 42.6708, lon: -9.05, port: 'muros' },
    { id: 'ribeira', name: 'Ribeira', lat: 42.5502, lon: -8.96, port: 'ribeira' },
    { id: 'aguino', name: 'Aguiño', lat: 42.5207, lon: -9.03, port: 'ribeira' }
];

let myLocations = [];
let currentLocId = 'porto';
let selectedDate = new Date().toLocaleDateString('en-CA');
let map, marker, marineData, weatherData, searchTimeout;

function init() {
    loadLocations();
    initMap();
    renderDateSelector();
    renderLocationsList();
    refreshData();
    setInterval(updateClock, 10000);
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
    const loc = myLocations.find(l => l.id === currentLocId);
    if (loc) {
        fetchMeteoGaliciaData(loc).then(() => updateUI());
    } else {
        updateUI();
    }
}

function updateClock() {
    const now = new Date();
    if (selectedDate !== now.toLocaleDateString('en-CA')) return;
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
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=wind_speed_10m,wind_direction_10m,precipitation,precipitation_probability&daily=sunrise,sunset,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=7`;
    try {
        const [mRes, wRes] = await Promise.all([fetch(marineUrl).then(r => r.json()), fetch(weatherUrl).then(r => r.json())]);
        if (mRes.hourly && wRes.hourly) {
            marineData = mRes; weatherData = wRes;
            await fetchMeteoGaliciaData(loc);
            updateUI();
        }
    } catch (error) { console.error("Error:", error); }
}

async function fetchMeteoGaliciaData(loc) {
    const zone = METEOGALICIA_ZONES.find(z => loc.lat >= z.latMin) || METEOGALICIA_ZONES[4];
    const portId = METEOGALICIA_PORTS[loc.port] || 11;
    
    // Calculamos el parámetro 'dia' para la predicción de MeteoGalicia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selDate = new Date(selectedDate);
    selDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((selDate - today) / 86400000);
    const dia = Math.max(0, Math.min(3, diffDays)); 

    // URLs de MeteoGalicia
    const predUrl = `https://servizos.meteogalicia.gal/mgrss/predicion/jsonPredMaritima.action?idZona=${zone.id}&dia=${dia}&request_locale=gl`;
    const [y, m_sel, d_sel] = selectedDate.split('-');
    const formattedDate = `${d_sel}/${m_sel}/${y}`;
    const tideUrl = `https://servizos.meteogalicia.gal/mgrss/predicion/mareas/jsonMareas.action?idPorto=${portId}&data=${formattedDate}&request_locale=gl`;

    // Lista de proxies para mayor fiabilidad
    const proxies = [
        (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url) => `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
        (url) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`
    ];

    async function fetchWithRetry(url) {
        let lastError;
        for (const proxyFn of proxies) {
            try {
                const pUrl = proxyFn(url);
                const res = await fetch(pUrl);
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                
                let text;
                if (pUrl.includes('allorigins.win')) {
                    const data = await res.json();
                    text = data.contents;
                } else {
                    text = await res.text();
                }
                
                if (!text || (!text.trim().startsWith('{') && !text.trim().startsWith('['))) {
                    throw new Error("Respuesta no es JSON válido");
                }
                
                return JSON.parse(text);
            } catch (e) {
                lastError = e;
                console.warn(`Proxy falló para ${url}, probando siguiente...`, e.message);
            }
        }
        throw lastError;
    }

    try {
        const [pRes, tRes] = await Promise.all([
            fetchWithRetry(predUrl),
            fetchWithRetry(tideUrl)
        ]);

        // Procesar Predicción
        if (pRes && pRes.listaPredDiaMaritima && pRes.listaPredDiaMaritima[0]) {
            const zones = pRes.listaPredDiaMaritima[0].listaPredZonaMaritima || [];
            const pred = zones.find(z => z.idZona == zone.id) || zones[0];
            
            if (pred) {
                const content = `
                    <p><strong>Vento:</strong> ${pred.comentVento || 'Sen datos'}</p>
                    <p><strong>Mar:</strong> ${pred.comentMar || 'Sen datos'}</p>
                    <p><strong>Visibilidade:</strong> ${pred.comentVisibilidade || 'Sen datos'}</p>
                    <p><strong>Mar de fondo:</strong> ${pred.comentMarFondo || 'Sen datos'}</p>
                `;
                document.getElementById('prediction-content').innerHTML = content;
            } else {
                document.getElementById('prediction-content').innerHTML = '<p>Non hai datos de predicción para esta zona.</p>';
            }
        }

        // Procesar Mareas
        if (tRes && tRes.mareas) {
            tRes.mareas.forEach(day => {
                const rawDate = day.data || day.dataMarea || "";
                let date = rawDate.split(/[\sT]/)[0];
                
                // Normalizar formato de fecha de DD/MM/YYYY a YYYY-MM-DD
                if (date.includes('/')) {
                    const [d, m, y] = date.split('/');
                    date = `${y}-${m}-${d}`;
                }
                
                if (!date) return;
                if (!dynamicTides[date]) dynamicTides[date] = {};
                
                const tidesForPort = { high: [], low: [] };
                (day.listaMareas || []).forEach(m => {
                    const timeParts = m.hora.split(/[\sT]/);
                    const time = timeParts.length > 1 ? timeParts[1].substring(0, 5) : timeParts[0].substring(0, 5);
                    
                    const isHigh = m.tipoMarea === 'Preamar' || m.estado === 'Pleamar' || m.tipoMarea === 'Pleamar';
                    if (isHigh) tidesForPort.high.push(time);
                    else tidesForPort.low.push(time);
                });
                dynamicTides[date][loc.port] = tidesForPort;
            });
        }
    } catch (e) {
        console.warn("⚓ MeteoGalicia fallou ou está bloqueado. Activando sistema de respaldo local...", e.message);
        
        // Generar una predicción automática basada en Open-Meteo como respaldo
        const now = new Date();
        const isToday = selectedDate === now.toLocaleDateString('en-CA');
        const targetHour = isToday ? now.getHours() : 12;
        const targetTimeStr = selectedDate + `T${String(targetHour).padStart(2, '0')}:00`;
        const idx = marineData.hourly.time.indexOf(targetTimeStr) || 0;
        const wIdx = weatherData.hourly.time.indexOf(targetTimeStr) || 0;
        
        const wave = marineData.hourly.wave_height[idx] || 0;
        const wind = weatherData.hourly.wind_speed_10m[wIdx] || 0;
        const windDir = getWindDirection(weatherData.hourly.wind_direction_10m[wIdx]);

        const content = `
            <p style="color:var(--accent); font-size:0.7rem; margin-bottom:5px;">⚠️ PREDICIÓN ESTIMADA (FALLO CONEXIÓN OFICIAL)</p>
            <p><strong>Oleaxe:</strong> Mar de fondo con ondas de ${wave.toFixed(1)}m.</p>
            <p><strong>Vento:</strong> Sopre do ${windDir} con forza de ${wind.toFixed(0)} km/h.</p>
            <p><strong>Visibilidade:</strong> Datos non dispoñibles.</p>
            <p>Datos Oceanográficos: MeteoGalicia & Open-Meteo <span style="opacity:0.3; font-size:0.6rem;">v17</span></p>
        `;
        document.getElementById('prediction-content').innerHTML = content;
    }
}

function calculateTidesFromOpenMeteo() {
    if (!marineData || !marineData.minutely_15) return null;
    const heights = marineData.minutely_15.sea_level_height_msl;
    const times = marineData.minutely_15.time;
    const tides = {};

    // Detección de picos y valles (ventana de 2 horas = 8 puntos de 15min)
    const windowSize = 6; 
    for (let i = windowSize; i < heights.length - windowSize; i++) {
        const curr = heights[i];
        let isMax = true; let isMin = true;
        for (let j = 1; j <= windowSize; j++) {
            if (heights[i-j] >= curr || heights[i+j] >= curr) isMax = false;
            if (heights[i-j] <= curr || heights[i+j] <= curr) isMin = false;
        }
        
        if (isMax || isMin) {
            const date = times[i].split('T')[0];
            const time = times[i].split('T')[1].substring(0, 5);
            if (!tides[date]) tides[date] = { high: [], low: [] };
            if (isMax) tides[date].high.push(time);
            else tides[date].low.push(time);
            i += windowSize; // Saltar ventana para evitar duplicados en picos planos
        }
    }
    return tides;
}

function updateUI() {
    if (!marineData || !weatherData) return;
    const now = new Date();
    const isToday = selectedDate === now.toLocaleDateString('en-CA');
    const targetHour = isToday ? now.getHours() : 12;
    const targetTimeStr = selectedDate + `T${String(targetHour).padStart(2, '0')}:00`;
    const mIdx = marineData.hourly.time.indexOf(targetTimeStr);
    const idx = mIdx !== -1 ? mIdx : 0;
    const wIdx = weatherData.hourly.time.indexOf(targetTimeStr);
    const windIdx = wIdx !== -1 ? wIdx : 0;
    
    const dIdx = weatherData.daily.time.indexOf(selectedDate);
    const dailyIdx = dIdx !== -1 ? dIdx : 0;

    const waveHEl = document.getElementById('wave-height');
    if (waveHEl) waveHEl.innerText = marineData.hourly.wave_height[idx] != null ? `${marineData.hourly.wave_height[idx].toFixed(1)} m` : '--';
    const wavePEl = document.getElementById('wave-period');
    if (wavePEl) wavePEl.innerText = marineData.hourly.wave_period[idx] != null ? `${marineData.hourly.wave_period[idx].toFixed(0)} s` : '--';
    const windSEl = document.getElementById('wind-speed');
    if (windSEl) windSEl.innerText = weatherData.hourly.wind_speed_10m[windIdx] != null ? `${weatherData.hourly.wind_speed_10m[windIdx].toFixed(0)} km/h` : '--';
    const windDEl = document.getElementById('wind-dir');
    if (windDEl) windDEl.innerText = weatherData.hourly.wind_direction_10m[windIdx] != null ? getWindDirection(weatherData.hourly.wind_direction_10m[windIdx]) : '--';
    
    document.getElementById('precip-prob').innerText = weatherData.daily.precipitation_probability_max[dailyIdx] != null ? `${weatherData.daily.precipitation_probability_max[dailyIdx]}%` : '--%';
    document.getElementById('precip-amount').innerText = weatherData.daily.precipitation_sum[dailyIdx] != null ? `${weatherData.daily.precipitation_sum[dailyIdx].toFixed(1)} mm` : '--';

    const d = new Date(selectedDate);
    const timeEl = document.getElementById('current-time');
    if (!isToday) { if (timeEl) timeEl.innerText = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); }
    else updateClock();

    const tides = getOfficialTidesForDate(selectedDate);
    updateTideUI(tides, isToday);
    
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
    
    // --- HIGH PRECISION SCANNING (V2) ---
    // Scan every 15 mins for Zenith (Max Altitude) and Nadir (Min Altitude)
    let scannedPoints = [];
    for (let m = 0; m < 1440; m += 15) {
        let t = new Date(date); t.setMinutes(m);
        let pos = SunCalc.getMoonPosition(t, loc.lat, loc.lon);
        scannedPoints.push({ time: t, alt: pos.altitude });
    }
    
    // Find Zenith (Major 1) & Nadir (Major 2) in local time
    const zenith = [...scannedPoints].sort((a,b) => b.alt - a.alt)[0].time;
    const nadir = [...scannedPoints].sort((a,b) => a.alt - b.alt)[0].time;
    
    const sunTimes = SunCalc.getTimes(date, loc.lat, loc.lon);
    const moonIllum = SunCalc.getMoonIllumination(date);
    const moonTimes = SunCalc.getMoonTimes(date, loc.lat, loc.lon);

    let hourlyScores = [];
    for (let h = 0; h < 24; h++) {
        let score = 15;
        let hourDate = new Date(date); hourDate.setHours(h);
        
        // Major Periods: scanned zenith and nadir
        if (Math.abs(hourDate - zenith) < 3600000) score += 45; // peak ±1h
        if (Math.abs(hourDate - nadir) < 3600000) score += 40;
        
        // Minor Periods: Rise/Set
        if (moonTimes.rise && Math.abs(hourDate - moonTimes.rise) < 3600000) score += 20;
        if (moonTimes.set && Math.abs(hourDate - moonTimes.set) < 3600000) score += 20;
        
        // Solar windows
        if (Math.abs(hourDate - sunTimes.sunrise) < 3600000 || Math.abs(hourDate - sunTimes.sunset) < 3600000) score += 15;

        if (moonIllum.phase < 0.05 || moonIllum.phase > 0.95 || (moonIllum.phase > 0.45 && moonIllum.phase < 0.55)) score *= 1.4;
        hourlyScores.push({ hour: h, score: Math.min(100, score) });
    }
    
    // Logic to select the TWO best peaks (separated by at least 6 hours)
    const sorted = [...hourlyScores].sort((a,b) => b.score - a.score);
    const best1 = sorted[0];
    const best2 = sorted.find(s => Math.abs(s.hour - best1.hour) >= 6) || sorted[1];
    const peaks = [best1, best2].sort((a,b) => a.hour - b.hour);
    
    const dayTides = getOfficialTidesFullDay(selectedDate);

    peaks.forEach((peak, i) => {
        const num = i + 1;
        const card = document.getElementById(`fishing-card-${num}`);
        const level = peak.score > 85 ? 'Excelente' : peak.score > 70 ? 'Muy Buena' : peak.score > 55 ? 'Buena' : peak.score > 35 ? 'Media' : 'Baja';
        const color = peak.score > 85 ? '#FFD700' : peak.score > 70 ? '#FF8C00' : peak.score > 55 ? '#4CAF50' : '#00D2FF';
        
        document.getElementById(`fishing-time-${num}`).innerText = `${String(peak.hour).padStart(2,'0')}:00`;
        document.getElementById(`fishing-level-${num}`).innerText = level;
        const bar = document.getElementById(`fishing-score-bar-${num}`);
        if (bar) {
            bar.style.setProperty('--activity-percent', `${peak.score}%`);
            bar.style.setProperty('--activity-color', color);
        }

        // Highlight if overlaps with official tide event
        let peakDate = new Date(date); peakDate.setHours(peak.hour);
        const hasTideCoincidence = dayTides.some(tide => Math.abs(peakDate - tide.time) < 5400000); // 1.5h
        if (card) card.classList.toggle('highlight-peak', hasTideCoincidence);
    });
}

function getOfficialTidesFullDay(dateStr) {
    const loc = myLocations.find(l => l.id === currentLocId);
    if (!loc) return [];
    
    // 1. Intentar usar datos oficiales de MeteoGalicia (si se cargaron)
    let dayData = dynamicTides[dateStr] ? dynamicTides[dateStr][loc.port] : null;
    
    // 2. Fallback: Calcular mareas a partir de datos de Open-Meteo (Nivel del mar)
    if (!dayData) {
        console.log(`📊 Calculando mareas estimadas para ${dateStr}...`);
        const fallbackTides = calculateTidesFromOpenMeteo();
        if (fallbackTides && fallbackTides[dateStr]) {
            dayData = fallbackTides[dateStr];
        }
    }
    
    if (!dayData) return [];
    
    const events = [];
    (dayData.high || []).forEach(t => events.push({ type: 'Pleamar', time: combineDateAndTime(dateStr, t) }));
    (dayData.low || []).forEach(t => events.push({ type: 'Bajamar', time: combineDateAndTime(dateStr, t) }));
    return events.sort((a,b) => a.time - b.time);
}

function getOfficialTidesForDate(dateStr) {
    const events = getOfficialTidesFullDay(dateStr);
    const now = new Date();
    const isToday = dateStr === now.toLocaleDateString('en-CA');
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
