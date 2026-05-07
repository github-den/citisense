import { useEffect, useRef } from 'react';
import styles from './LeafletFeedbackMap.module.css';
import { URD_FULL_GEOJSON } from '../../data/urdBoundaries.js';
import { attachIntentionalWheelZoom } from '@core/utils/leafletWheelZoom.js';

export default function LeafletFeedbackMap({
  center,
  bounds,
  signals,
  selectedLocation,
  onSelect,
  onDrill,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const boundaryRef = useRef(null);
  const wheelZoomCleanupRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      const L = await import('leaflet/dist/leaflet-src.esm.js');
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [center.latitude, center.longitude],
        zoom: center.zoom,
        minZoom: 12.8,
        maxZoom: 18,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Render Official GeoJSON Boundary
      L.geoJSON(URD_FULL_GEOJSON, {
        style: {
          color: '#2563eb',
          weight: 1.5,
          opacity: 0.6,
          fillColor: '#2563eb',
          fillOpacity: 0.03,
        },
        interactive: false
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      boundaryRef.current = L.layerGroup().addTo(map);
      wheelZoomCleanupRef.current = attachIntentionalWheelZoom(map, containerRef.current);
    }

    mountMap();

    return () => {
      cancelled = true;
      wheelZoomCleanupRef.current?.();
      wheelZoomCleanupRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        boundaryRef.current = null;
      }
    };
  }, [bounds, center.latitude, center.longitude, center.zoom]);

  useEffect(() => {
    let cancelled = false;

    async function renderMarkers() {
      const L = await import('leaflet/dist/leaflet-src.esm.js');
      if (cancelled || !mapRef.current || !layerRef.current) return;

      layerRef.current.clearLayers();
      boundaryRef.current.clearLayers();

      const getLinearPos = (center, index, offset = 0.01) => ({
        latitude: center.latitude,
        longitude: center.longitude + (index - 1) * offset,
      });

      signals.forEach((signal) => {
        const drill = signal.drill || { level: 0 };
        const basePos = signal.coordinates;

        if (drill.level === 0) {
          L.circle([basePos.latitude, basePos.longitude], {
            radius: 480,
            color: signal.markerColor,
            weight: 1,
            opacity: 0.15,
            fillColor: signal.markerColor,
            fillOpacity: 0.05,
            interactive: false
          }).addTo(boundaryRef.current);
        }

        const createMarkerData = (pos, count, label, type, color, actions) => {
          const active = selectedLocation === signal.location;
          const marker = L.marker([pos.latitude, pos.longitude], {
            icon: L.divIcon({
              className: '',
              html: `<span class="${drill.level === 0 ? styles.marker : styles.subMarker} ${active ? styles.markerActive : ''}" style="--marker-color: ${color}">${count || 0}</span>`,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            }),
          });

          const menuHtml = `
            <div class="${styles.mapMenu}">
              <span class="${styles.menuHeader}">${count || 0} ${label}${drill.level === 0 ? 's' : ''}</span>
              ${actions.map(action => `
                <button class="${styles.menuItem}" data-action="${action.type}">
                  ${action.label}
                </button>
              `).join('')}
            </div>
          `;

          marker.bindPopup(menuHtml, {
            offset: [0, -20],
            closeButton: false,
            className: 'custom-map-popup'
          });

          marker.on('mouseover', () => marker.openPopup());
          marker.on('popupopen', (e) => {
            const popup = e.popup;
            const container = popup.getElement();
            container.querySelectorAll('[data-action]').forEach(btn => {
              btn.onclick = () => {
                const type = btn.getAttribute('data-action');
                if (type === 'view') onSelect(signal);
                if (type === 'drill-1') onDrill(signal.location, 1, 'types');
                if (type === 'drill-2') onDrill(signal.location, 2, 'status');
                if (type === 'drill-3') onDrill(signal.location, 3, 'progress');
                marker.closePopup();
              };
            });
          });

          return marker;
        };

        if (drill.level === 0) {
          createMarkerData(basePos, signal.total, 'Feedback', 'all', signal.markerColor, [
            { type: 'view', label: 'View feedbacks' },
            { type: 'drill-1', label: 'Show more' }
          ]).addTo(layerRef.current);
        } else if (drill.level === 1) {
          const typeConfig = [
            { id: 'complaint', label: 'Complaint', count: signal.complaint, color: '#dc2626' },
            { id: 'suggestion', label: 'Suggestion', count: signal.suggestion, color: '#d97706' },
            { id: 'compliment', label: 'Compliment', count: signal.compliment, color: '#16a34a' },
          ];

          typeConfig.forEach((t, i) => {
            const pos = getLinearPos(basePos, i, 0.01);
            const actions = t.id === 'complaint' 
              ? [{ type: 'view', label: 'View feedbacks' }, { type: 'drill-2', label: 'Show more' }]
              : [{ type: 'view', label: 'See feedbacks' }];
            createMarkerData(pos, t.count, t.label, t.id, t.color, actions).addTo(layerRef.current);
          });
        } else if (drill.level === 2) {
          const statusConfig = [
            { id: 'under-review', label: 'Under Review', count: signal.underReview, color: '#2563eb' },
            { id: 'verified', label: 'Verified', count: signal.verified, color: '#16a34a' },
            { id: 'dismissed', label: 'Dismissed', count: (signal.dismissed || 0) + (signal.closed || 0) + (signal.invalid || 0), color: '#64748b' },
          ];

          statusConfig.forEach((s, i) => {
            const pos = getLinearPos(basePos, i, 0.01);
            const actions = s.id === 'verified'
              ? [{ type: 'view', label: 'View feedbacks' }, { type: 'drill-3', label: 'Show more' }]
              : [{ type: 'view', label: 'See feedbacks' }];
            createMarkerData(pos, s.count, s.label, s.id, s.color, actions).addTo(layerRef.current);
          });
        } else if (drill.level === 3) {
          const progressConfig = [
            { id: 'in-progress', label: 'In Progress', count: signal.inProgress, color: '#4f46e5' },
            { id: 'on-hold', label: 'On Hold', count: signal.onHold, color: '#ea580c' },
            { id: 'resolved', label: 'Resolved', count: signal.resolved, color: '#16a34a' },
          ];

          progressConfig.forEach((p, i) => {
            const pos = getLinearPos(basePos, i, 0.01);
            createMarkerData(pos, p.count, p.label, p.id, p.color, [{ type: 'view', label: 'See feedbacks' }]).addTo(layerRef.current);
          });
        }
      });
    }

    renderMarkers();

    return () => {
      cancelled = true;
    };
  }, [onDrill, onSelect, selectedLocation, signals]);

  return <div ref={containerRef} className={styles.map} />;
}
