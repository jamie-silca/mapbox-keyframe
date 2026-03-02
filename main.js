import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import VideoExportControl from 'maplibre-gl-video-export';

// We make maplibregl available globally so the video export plugin can find it
window.maplibregl = maplibregl;

let map;
let keyframes = [];
let videoExport;

/**
 * Initialize MapLibre GL JS map instance
 */
function initMap() {
  const defaultTileUrl = import.meta.env.VITE_TILE_URL || 'http://localhost:8081/{z}/{x}/{y}.png';
  const tileInput = document.getElementById('tile-url');
  if (defaultTileUrl) {
    tileInput.value = defaultTileUrl;
  }

  // Use a simple basemap for the background (CARTO Voyager no labels, or simple grey)
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        'basemap': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'
          ],
          tileSize: 256
        }
      },
      layers: [
        {
          id: 'basemap-layer',
          type: 'raster',
          source: 'basemap',
          minzoom: 0,
          maxzoom: 22
        }
      ]
    },
    center: [104.1637613, 1.3495334], // User requested center
    zoom: 12,
    pitch: 0,
    bearing: 0,
    antialias: true // Anti-aliasing for better 3D quality
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Initialize Video Export Control
  videoExport = new VideoExportControl({
    animation: 'waypointTour',
    format: 'mp4',
    encoderPath: 'https://unpkg.com/mp4-h264@1.0.7/build/'
  });
  map.addControl(videoExport, 'bottom-right');

  // Coordinate Input Logic
  const coordsInput = document.getElementById('viewport-coords');

  const updateCoordsInput = () => {
    const center = map.getCenter();
    // Display as Lat, Long
    coordsInput.value = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
  };

  // Update input when map moves
  map.on('move', () => {
    // Only update if the input is not focused to avoid fighting with user input
    if (document.activeElement !== coordsInput) {
      updateCoordsInput();
    }
  });

  // Update on load
  map.on('load', updateCoordsInput);

  // Update map when input changes
  coordsInput.addEventListener('change', () => {
    const val = coordsInput.value;
    const parts = val.split(',').map(s => parseFloat(s.trim()));

    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      // Input is Lat, Long. MapLibre uses [lng, lat]
      map.flyTo({
        center: [parts[1], parts[0]],
        essential: true
      });
      coordsInput.blur(); // Remove focus so the map update can refresh the input values during/after move
    }
  });

  // Map Style Toggle
  const lightBtn = document.getElementById('style-light-btn');
  const satelliteBtn = document.getElementById('style-satellite-btn');

  const updateStyle = (styleType) => {
    if (styleType === 'satellite') {
      map.setStyle({
        version: 8,
        sources: {
          'satellite': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
            tileSize: 256
          }
        },
        layers: [{
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite',
          minzoom: 0,
          maxzoom: 22
        }]
      });
      satelliteBtn.classList.add('active');
      lightBtn.classList.remove('active');
    } else {
      map.setStyle({
        version: 8,
        sources: {
          'basemap': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png'
            ],
            tileSize: 256
          }
        },
        layers: [{
          id: 'basemap-layer',
          type: 'raster',
          source: 'basemap',
          minzoom: 0,
          maxzoom: 22
        }]
      });
      lightBtn.classList.add('active');
      satelliteBtn.classList.remove('active');
    }

    // Re-add Ortho layer if it was loaded
    map.once('style.load', () => {
      const tileInput = document.getElementById('tile-url');
      if (tileInput.value) {
        loadOrthomosaicLayer(tileInput.value);
      }
    });
  };

  lightBtn.addEventListener('click', () => updateStyle('light'));
  satelliteBtn.addEventListener('click', () => updateStyle('satellite'));

  // Load orthomosaic logic
  document.getElementById('load-layer-btn').addEventListener('click', () => {
    loadOrthomosaicLayer(tileInput.value);
  });

  // Automatically load if configured via env
  if (defaultTileUrl) {
    map.on('load', () => {
      loadOrthomosaicLayer(defaultTileUrl);
    });
  }
}

/**
 * Add or update Orthomosaic Map layer via URL
 */
function loadOrthomosaicLayer(url) {
  if (!url) {
    alert('Please enter a tile URL');
    return;
  }

  // Remove existing if any
  if (map.getLayer('ortho-layer')) map.removeLayer('ortho-layer');
  if (map.getSource('ortho')) map.removeSource('ortho');

  map.addSource('ortho', {
    type: 'raster',
    tiles: [url],
    tileSize: 256,
    maxzoom: 22
  });

  map.addLayer({
    id: 'ortho-layer',
    type: 'raster',
    source: 'ortho',
    minzoom: 0,
    maxzoom: 22
  });

  // Optional: Try to do a rough fly to a default extent if we know it, 
  // but for XYZ we don't know the bounds automatically unless provided.
}

/**
 * Capture current viewport as a keyframe
 */
function captureKeyframe() {
  if (!map) return;
  const center = map.getCenter();
  keyframes.push({
    id: Date.now().toString(),
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    duration: 3000 // default 3s dwell time at this point
  });
  renderKeyframes();
}

/**
 * Render the list of keyframes in the UI
 */
function renderKeyframes() {
  const container = document.getElementById('keyframes-list');
  const previewBtn = document.getElementById('preview-btn');
  const exportBtn = document.getElementById('export-btn');

  if (keyframes.length === 0) {
    container.innerHTML = '<div class="empty-state">No keyframes captured. Move the map and capture a view to start.</div>';
    previewBtn.disabled = true;
    exportBtn.disabled = true;
    return;
  }

  previewBtn.disabled = false;
  exportBtn.disabled = false;

  container.innerHTML = '';
  keyframes.forEach((kf, index) => {
    const el = document.createElement('div');
    el.className = 'keyframe-item';
    el.innerHTML = `
      <div class="keyframe-header">
        <span>Keyframe ${index + 1}</span>
        <div>
          <button class="keyframe-goto btn-secondary btn-mini" data-id="${kf.id}" style="font-size: 10px; padding: 2px 4px; margin-right: 4px; cursor: pointer;">Go</button>
          <button class="keyframe-delete" data-id="${kf.id}">×</button>
        </div>
      </div>
      <div class="keyframe-meta edit-fields">
        <div class="edit-row">
          <label>X:</label><input class="kf-lng" data-id="${kf.id}" type="number" step="any" value="${kf.center[0].toFixed(4)}">
          <label>Y:</label><input class="kf-lat" data-id="${kf.id}" type="number" step="any" value="${kf.center[1].toFixed(4)}">
        </div>
        <div class="edit-row">
          <label>Z:</label><input class="kf-zoom" data-id="${kf.id}" type="number" step="any" value="${kf.zoom.toFixed(1)}">
          <label>P:</label><input class="kf-pitch" data-id="${kf.id}" type="number" step="any" value="${kf.pitch.toFixed(1)}">
          <label>B:</label><input class="kf-bearing" data-id="${kf.id}" type="number" step="any" value="${kf.bearing.toFixed(1)}">
        </div>
      </div>
      <div class="keyframe-settings">
        <span class="muted-label">Dwell:</span>
        <div class="dwell-group">
          <input type="number" min="0" step="100" class="duration-input" data-id="${kf.id}" value="${kf.duration}">
          <span>ms</span>
        </div>
      </div>
    `;
    container.appendChild(el);
  });
}

/**
 * Play back the keyframes sequentially on the map
 */
async function previewTour() {
  if (keyframes.length === 0) return;

  const previewBtn = document.getElementById('preview-btn');
  const originalText = previewBtn.innerText;
  previewBtn.innerText = '▶ Playing...';
  previewBtn.disabled = true;

  // Jump to first frame instantly
  const first = keyframes[0];
  map.jumpTo({
    center: first.center,
    zoom: first.zoom,
    pitch: first.pitch,
    bearing: first.bearing
  });
  await new Promise(r => setTimeout(r, first.duration));

  // Fly to subsequent frames
  for (let i = 1; i < keyframes.length; i++) {
    const kf = keyframes[i];
    await new Promise(resolve => {
      map.flyTo({
        center: kf.center,
        zoom: kf.zoom,
        pitch: kf.pitch,
        bearing: kf.bearing,
        duration: 3000, // 3s transition time between points
        essential: true
      });
      map.once('moveend', () => {
        // Next, wait for the dwell duration at the waypoint
        setTimeout(resolve, kf.duration);
      });
    });
  }

  previewBtn.innerText = originalText;
  previewBtn.disabled = false;
}

/**
 * Init DOM listeners for keyframe UI
 */
function initKeyframeUI() {
  document.getElementById('capture-keyframe-btn').addEventListener('click', captureKeyframe);

  document.getElementById('keyframes-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('keyframe-delete')) {
      const id = e.target.getAttribute('data-id');
      keyframes = keyframes.filter(k => k.id !== id);
      renderKeyframes();
    } else if (e.target.classList.contains('keyframe-goto')) {
      const id = e.target.getAttribute('data-id');
      const kf = keyframes.find(k => k.id === id);
      if (kf && map) {
        map.flyTo({
          center: kf.center,
          zoom: kf.zoom,
          pitch: kf.pitch,
          bearing: kf.bearing,
          duration: 1000
        });
      }
    }
  });

  document.getElementById('keyframes-list').addEventListener('change', (e) => {
    const id = e.target.getAttribute('data-id');
    const kf = keyframes.find(k => k.id === id);
    if (!kf) return;

    if (e.target.classList.contains('duration-input')) {
      const val = parseInt(e.target.value, 10);
      kf.duration = isNaN(val) ? 3000 : Math.max(0, val);
    } else if (e.target.classList.contains('kf-lng')) {
      kf.center[0] = parseFloat(e.target.value) || 0;
    } else if (e.target.classList.contains('kf-lat')) {
      kf.center[1] = parseFloat(e.target.value) || 0;
    } else if (e.target.classList.contains('kf-zoom')) {
      kf.zoom = parseFloat(e.target.value) || 0;
    } else if (e.target.classList.contains('kf-pitch')) {
      kf.pitch = parseFloat(e.target.value) || 0;
    } else if (e.target.classList.contains('kf-bearing')) {
      kf.bearing = parseFloat(e.target.value) || 0;
    }
  });

  document.getElementById('preview-btn').addEventListener('click', previewTour);

  document.getElementById('export-btn').addEventListener('click', () => {
    if (keyframes.length === 0 || !videoExport) return;

    // Inject keyframes into the export control's waypoints
    const features = keyframes.map((kf, index) => ({
      type: 'Feature',
      properties: {
        zoom: kf.zoom,
        bearing: kf.bearing,
        pitch: kf.pitch,
        duration: kf.duration,
        name: `Keyframe ${index + 1}`
      },
      geometry: {
        type: 'Point',
        coordinates: kf.center
      }
    }));

    videoExport.options.waypoints = {
      type: 'FeatureCollection',
      features
    };

    // Set to waypoint tour
    videoExport.options.animation = 'waypointTour';
    const animSelect = document.getElementById('ve-animation');
    if (animSelect) animSelect.value = 'waypointTour';

    // Try to update the plugin's internal UI if possible
    if (typeof videoExport._updateWaypointsUI === 'function') {
      try {
        videoExport._updateWaypointsUI();
        if (videoExport._sectionStates) videoExport._sectionStates['points-of-interest'] = false;
        const content = videoExport._panel?.querySelector('[data-section-content="points-of-interest"]');
        if (content) content.style.display = 'block';
      } catch (e) { }
    }

    // Open actual Export Control panel if it's currently hidden
    if (videoExport._panel && videoExport._panel.getAttribute('data-visible') !== 'true') {
      if (typeof videoExport._togglePanel === 'function') {
        videoExport._togglePanel();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initKeyframeUI();
});
