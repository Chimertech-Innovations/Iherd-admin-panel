import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { GeoEntity } from "@/lib/geoUtils";
import { Layers, Compass, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TileLayerType = "street" | "satellite" | "light" | "dark";

const TILE_LAYERS: Record<TileLayerType, { name: string; url: string; attribution: string; maxZoom: number }> = {
  street: {
    name: "Standard Vibrant",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    name: "Satellite Hybrid",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxZoom: 18,
  },
  light: {
    name: "Clean Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
  dark: {
    name: "Midnight Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
};

// Default India geographic center & zoom level framing the whole country
export const DEFAULT_INDIA_CENTER: [number, number] = [21.8, 78.9];
export const DEFAULT_INDIA_ZOOM = 5;

interface LeafletMapProps {
  entities: GeoEntity[];
  selectedEntity: GeoEntity | null;
  onSelectEntity: (entity: GeoEntity) => void;
  onOpenDetails: (entity: GeoEntity) => void;
  activeTileLayer: TileLayerType;
  onChangeTileLayer: (layer: TileLayerType) => void;
  center?: [number, number];
  zoom?: number;
  userLocation?: [number, number] | null;
  radiusKm?: number;
}

export function LeafletMap({
  entities,
  selectedEntity,
  onSelectEntity,
  onOpenDetails,
  activeTileLayer,
  onChangeTileLayer,
  center = DEFAULT_INDIA_CENTER,
  zoom = DEFAULT_INDIA_ZOOM,
  userLocation = null,
  radiusKm = 0,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const leafletLibRef = useRef<any>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Initialize Map safely in browser
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = await import("leaflet");
      leafletLibRef.current = L;

      if (!isMounted || !mapContainerRef.current) return;

      // Fix Default Leaflet marker icon asset issue
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        zoomControl: false,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // Add Tile Layer
      const cfg = TILE_LAYERS[activeTileLayer] || TILE_LAYERS.street;
      tileLayerRef.current = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
      }).addTo(map);

      // Create Layer Group for markers
      markersLayerRef.current = L.layerGroup().addTo(map);

      setIsMapReady(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Invalidate size on resize or sidebar collapse
  useEffect(() => {
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };
    window.addEventListener("resize", handleResize);
    const timer = setTimeout(handleResize, 300);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Update tile layer when activeTileLayer changes
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLibRef.current) return;
    const L = leafletLibRef.current;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const cfg = TILE_LAYERS[activeTileLayer] || TILE_LAYERS.street;
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(map);
  }, [activeTileLayer]);

  // Create custom DivIcon HTML
  const createEntityIcon = useCallback((entity: GeoEntity, isSelected: boolean) => {
    const L = leafletLibRef.current;
    if (!L) return null;

    let bgGrad = "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-emerald-500/40";
    let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    let ringColor = "border-emerald-400 ring-emerald-400/50";

    if (entity.type === "farm") {
      bgGrad = "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-600/40";
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`;
      ringColor = "border-teal-400 ring-teal-400/50";
    } else if (entity.type === "vet") {
      bgGrad = "bg-gradient-to-br from-blue-500 to-indigo-700 text-white shadow-blue-500/40";
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>`;
      ringColor = "border-blue-400 ring-blue-400/50";
    } else if (entity.type === "seller") {
      bgGrad = "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/40";
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2"/><path d="M18 7a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2"/><path d="M14 7a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2"/><path d="M10 7a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2"/><path d="M6 7a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2"/></svg>`;
      ringColor = "border-amber-400 ring-amber-400/50";
    } else if (entity.type === "cattle") {
      bgGrad = "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-purple-500/40";
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
      ringColor = "border-purple-400 ring-purple-400/50";
    }

    const selectedClass = isSelected
      ? `scale-125 ring-4 ${ringColor} animate-bounce shadow-2xl z-50`
      : "hover:scale-115 transition-transform duration-200";

    const html = `
      <div class="relative flex items-center justify-center cursor-pointer group">
        ${isSelected ? '<div class="absolute -inset-2 rounded-full bg-primary/30 animate-ping"></div>' : ""}
        <div class="w-9 h-9 rounded-full ${bgGrad} ${selectedClass} border-2 border-white dark:border-slate-900 shadow-lg flex items-center justify-center">
          ${iconSvg}
        </div>
        <div class="absolute -bottom-1 w-2 h-2 bg-slate-900 dark:bg-white rotate-45 rounded-xs"></div>
      </div>
    `;

    return L.divIcon({
      className: "custom-leaflet-pin",
      html: html,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });
  }, []);

  // Update Markers when entities or selectedEntity changes
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !markersLayerRef.current || !leafletLibRef.current) return;
    const L = leafletLibRef.current;
    const markersLayer = markersLayerRef.current;
    const map = mapInstanceRef.current;

    markersLayer.clearLayers();

    entities.forEach((entity) => {
      const isSelected = selectedEntity?.id === entity.id;
      const icon = createEntityIcon(entity, isSelected);
      if (!icon) return;

      const marker = L.marker([entity.latitude, entity.longitude], {
        icon: icon,
        zIndexOffset: isSelected ? 1000 : 10,
      });

      // Build Rich HTML Popup
      const badgeClass =
        entity.type === "farm"
          ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
          : entity.type === "farmer"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : entity.type === "vet"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
          : entity.type === "seller"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";

      const typeLabel =
        entity.type === "farm"
          ? "🚜 Registered Farm"
          : entity.type === "farmer"
          ? "🌾 Farmer Profile"
          : entity.type === "vet"
          ? "🩺 Veterinarian"
          : entity.type === "seller"
          ? "🏪 Seller / Store"
          : "🐄 Cattle / Livestock";

      const userBtnId = `btn-popup-user-${entity.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const inspectBtnId = `btn-popup-inspect-${entity.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const hasUserProfile = Boolean(entity.userId || entity.ownerUid || entity.linkUrl?.startsWith("/users"));
      const userTargetId = entity.userId || entity.ownerUid || (entity.type === "farmer" ? entity.id : undefined);

      const popupContent = `
        <div class="p-3.5 max-w-[290px] font-sans text-slate-900 dark:text-slate-100">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full ${badgeClass}">
              ${typeLabel}
            </span>
            ${
              entity.isExactCoordinate
                ? '<span class="text-[9px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded flex items-center gap-0.5">● GPS</span>'
                : '<span class="text-[9px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Regional</span>'
            }
          </div>
          <h4 class="font-bold text-sm leading-snug mb-0.5 line-clamp-1">${entity.title}</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-1">${entity.subtitle}</p>
          
          <div class="space-y-1 py-1.5 border-t border-b border-slate-100 dark:border-slate-800 text-xs my-2">
            <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span class="truncate font-medium">${entity.locationName || "India"}</span>
            </div>
            ${
              entity.phone && entity.phone !== "—"
                ? `<div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    <a href="tel:${entity.phone}" class="text-primary hover:underline font-medium">${entity.phone}</a>
                  </div>`
                : ""
            }
            ${
              entity.ownerName
                ? `<div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-[11px]">
                    <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    <span class="truncate">Owner: <strong>${entity.ownerName}</strong></span>
                  </div>`
                : ""
            }
            <div class="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>Coordinates:</span>
              <span class="font-mono font-medium">${entity.latitude.toFixed(4)}, ${entity.longitude.toFixed(4)}</span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 mt-2">
            <button id="${inspectBtnId}" class="w-full py-1.5 px-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition flex items-center justify-center gap-1.5 shadow-sm">
              <span>View Full Data & Infrastructure</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
            ${
              hasUserProfile && userTargetId
                ? `<button id="${userBtnId}" class="w-full py-1.5 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-xs border border-border/60 transition flex items-center justify-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    <span>Open User Profile</span>
                  </button>`
                : ""
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: "custom-leaflet-popup shadow-xl rounded-2xl overflow-hidden",
        maxWidth: 310,
      });

      marker.on("click", () => {
        onSelectEntity(entity);
      });

      marker.on("popupopen", () => {
        const inspectBtn = document.getElementById(inspectBtnId);
        if (inspectBtn) {
          inspectBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenDetails(entity);
          };
        }

        const userBtn = document.getElementById(userBtnId);
        if (userBtn && userTargetId) {
          userBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tabParam = entity.type === "farmer" ? "?tab=farmer" : entity.type === "vet" ? "?tab=veterinarian" : entity.type === "seller" ? "?tab=seller" : "";
            window.location.href = `/users/${userTargetId}${tabParam}`;
          };
        }
      });

      markersLayer.addLayer(marker);
    });

    // If selected entity exists, pan map to it smoothly
    if (selectedEntity) {
      map.flyTo([selectedEntity.latitude, selectedEntity.longitude], Math.max(map.getZoom(), 12), {
        duration: 1.2,
      });
    }
  }, [entities, selectedEntity, isMapReady, createEntityIcon, onSelectEntity, onOpenDetails]);

  // Handle User Location & Radius Circle
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !leafletLibRef.current) return;
    const L = leafletLibRef.current;
    const map = mapInstanceRef.current;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    if (radiusCircleRef.current) {
      map.removeLayer(radiusCircleRef.current);
      radiusCircleRef.current = null;
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        className: "user-loc-pin",
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg animate-pulse"></div>
            <div class="absolute -inset-2 rounded-full bg-blue-500/20 animate-ping"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      userMarkerRef.current = L.marker(userLocation, { icon: userIcon, zIndexOffset: 2000 })
        .bindTooltip("Your Location", { permanent: false, direction: "top" })
        .addTo(map);

      if (radiusKm && radiusKm > 0) {
        radiusCircleRef.current = L.circle(userLocation, {
          radius: radiusKm * 1000,
          color: "#3b82f6",
          weight: 1.5,
          opacity: 0.8,
          fillColor: "#3b82f6",
          fillOpacity: 0.08,
          dashArray: "6, 6",
        }).addTo(map);
      }
    }
  }, [userLocation, radiusKm, isMapReady]);

  // Map Controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const handleFitBounds = () => {
    if (!mapInstanceRef.current || !leafletLibRef.current || entities.length === 0) return;
    const L = leafletLibRef.current;
    const bounds = L.latLngBounds(entities.map((e) => [e.latitude, e.longitude]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };

  const handleResetIndiaView = () => {
    mapInstanceRef.current?.flyTo(DEFAULT_INDIA_CENTER, DEFAULT_INDIA_ZOOM, { duration: 1 });
  };

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden bg-muted/20">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Layer Style Switcher & Zoom Controls on Top Right */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        {/* Layer Dropdown Toggle */}
        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 bg-background/95 backdrop-blur-md shadow-lg gap-1.5 rounded-xl border"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
          >
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold hidden sm:inline">{TILE_LAYERS[activeTileLayer].name}</span>
          </Button>

          {showLayerMenu && (
            <div className="absolute right-0 top-11 w-44 bg-card/95 border rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-md">
              <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Map Tiles Layer
              </div>
              {(Object.keys(TILE_LAYERS) as TileLayerType[]).map((layerKey) => (
                <button
                  key={layerKey}
                  onClick={() => {
                    onChangeTileLayer(layerKey);
                    setShowLayerMenu(false);
                  }}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                    activeTileLayer === layerKey
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span>{TILE_LAYERS[layerKey].name}</span>
                  {activeTileLayer === layerKey && <span className="text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom & Fit Controls */}
        <div className="flex flex-col bg-background/95 backdrop-blur-md rounded-xl border shadow-lg overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="p-2.5 hover:bg-muted transition text-foreground flex items-center justify-center"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="h-[1px] bg-border" />
          <button
            onClick={handleZoomOut}
            className="p-2.5 hover:bg-muted transition text-foreground flex items-center justify-center"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="h-[1px] bg-border" />
          <button
            onClick={handleFitBounds}
            className="p-2.5 hover:bg-muted transition text-foreground flex items-center justify-center"
            title="Fit All Filtered Markers"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="h-[1px] bg-border" />
          <button
            onClick={handleResetIndiaView}
            className="p-2.5 hover:bg-muted transition text-foreground flex items-center justify-center text-primary"
            title="Default India Overview"
          >
            <Compass className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Map Legend on Bottom Right */}
      <div className="absolute bottom-4 right-4 z-[400] bg-background/95 backdrop-blur-md p-2 rounded-xl border shadow-xl text-xs hidden md:flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600 shadow-sm"></span>
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Farms</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span>
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Farmers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></span>
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Vets</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></span>
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Sellers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm"></span>
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Cattle</span>
        </div>
      </div>
    </div>
  );
}
