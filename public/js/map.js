// Ensure coordinates exist and are structured correctly [Latitude, Longitude]
let mapCenter = [28.6139, 77.2090]; // Default New Delhi fallback

if (typeof coordinates !== 'undefined' && Array.isArray(coordinates) && coordinates.length === 2) {
    if (coordinates[0] !== 0 || coordinates[1] !== 0) {
        mapCenter = coordinates;
    }
}

// Initialize the map with smooth control configurations
const map = L.map('map', {
    zoomControl: false, 
    scrollWheelZoom: false 
}).setView(mapCenter, 14); // Slightly closer zoom to show rich terrain detail

// Clean zoom controls placed beautifully in the bottom right corner
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// RICH COLOR MAP LAYER: Vibrant, realistic, and highly detailed
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Inject dynamic glowing animations and modern pop-up styling
const style = document.createElement('style');
style.innerHTML = `
  @keyframes mapRadar {
    0% { transform: scale(0.3); opacity: 1; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  .luxury-pin {
    background: #1B3B6D; /* Vibrant Signature Crimson-Rose */
    border: 2.5px solid #FFFFFF;
    border-radius: 50%;
    box-shadow: 0 0 15px rgba(255, 56, 92, 0.6), 0 4px 10px rgba(0,0,0,0.3);
    position: relative;
  }
  .luxury-pin::before {
    content: '';
    position: absolute;
    width: 44px;
    height: 44px;
    top: -14px;
    left: -14px;
    background: rgba(255, 56, 92, 0.35);
    border-radius: 50%;
    animation: mapRadar 2.2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
    z-index: -1;
  }
  /* Modern Luxury Floating Popup Card */
  .leaflet-popup-content-wrapper {
    background: #ffffff !important;
    color: #222222 !important;
    border-radius: 14px !important;
    padding: 6px !important;
    box-shadow: 0 10px 30px rgba(0,0,0,0.15) !important;
    border: 1px solid rgba(0,0,0,0.05) !important;
  }
  .leaflet-popup-tip {
    background: #ffffff !important;
  }
`;
document.head.appendChild(style);

// 1. Create the glowing crimson-rose vector center pin
const dynamicIcon = L.divIcon({
    className: 'luxury-pin',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

// 2. Beautiful translucent neighborhood safety circle wrapper
const locationCircle = L.circle(mapCenter, {
    color: '#1B3B6D',
    fillColor: '#1B3B6D',
    fillOpacity: 0.1,  // Delicate, clean translucent color filling
    weight: 2,         // Crisper border ring lines
    radius: 350        // 350-meter neighborhood highlight ring
}).addTo(map);

// Drop the pin right over the center coordinates
const marker = L.marker(mapCenter, { icon: dynamicIcon }).addTo(map);

// Custom detail layout matching premium booking standards
const popupContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 6px; max-width: 190px;">
        <div style="text-transform: uppercase; font-size: 0.65rem; font-weight: 800; color: #1B3B6D; letter-spacing: 0.8px; margin-bottom: 3px;">📍 Verified Stay</div>
        <h6 style="font-weight: 700; margin: 0 0 4px 0; color: #222222; font-size: 0.9rem; letter-spacing: -0.3px;">
            ${locationName || 'Destination Location'}
        </h6>
        <p style="font-size: 0.75rem; margin: 0; color: #555555; line-height: 1.35;">
            Exact street view and property entry gates are shared instantly following booking confirmation.
        </p>
    </div>
`;

// Bind the interactive pop-up card to the elements
marker.bindPopup(popupContent);
locationCircle.bindPopup(popupContent);

// Automatically pop open the popup window for maximum visual appeal
marker.openPopup();

// Force sizing recalculations on page initialization
window.addEventListener('load', () => {
    setTimeout(() => {
        map.invalidateSize();
    }, 250);
});