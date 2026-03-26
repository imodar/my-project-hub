import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MemberLocation {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  is_sharing: boolean;
  name: string;
  role: string;
  isMe: boolean;
}

interface FamilyMapProps {
  locations: MemberLocation[];
  selectedMemberId: string | null;
  onMemberSelect: (id: string) => void;
  className?: string;
}

const ROLE_COLORS: Record<string, string> = {
  father: "#2563eb",
  mother: "#ec4899",
  son: "#16a34a",
  daughter: "#a855f7",
  worker: "#f59e0b",
  maid: "#f59e0b",
  driver: "#f59e0b",
};

function createMemberIcon(name: string, role: string, isMe: boolean, isSelected: boolean, isHidden = false) {
  const baseColor = isMe ? "#ef4444" : (ROLE_COLORS[role] || "#6b7280");
  const color = isHidden ? "#9ca3af" : baseColor;
  const opacity = isHidden ? 0.5 : 1;
  const size = isSelected ? 44 : 36;
  const initial = name.charAt(0) || "?";
  const border = isSelected ? "3px solid white" : "2px solid white";

  const eyeOffSvg = isHidden
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;bottom:-4px;right:-4px;background:#6b7280;border-radius:50%;padding:1px;border:1.5px solid white;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : "";

  return L.divIcon({
    className: "custom-member-marker",
    html: `<div style="
      position:relative;width:${size}px;height:${size}px;border-radius:50%;
      background:${color};color:white;display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:${isSelected ? 16 : 14}px;
      border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.3);
      opacity:${opacity};transition:all 0.2s;
    ">${initial}${eyeOffSvg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

export default function FamilyMap({ locations, selectedMemberId, onMemberSelect, className }: FamilyMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const fittedRef = useRef(false);

  const sharingLocations = locations.filter((l) => l.is_sharing);
  const allWithCoords = locations.filter((l) => l.lat && l.lng);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const defaultCenter: [number, number] = sharingLocations.length > 0
      ? [sharingLocations[0].lat, sharingLocations[0].lng]
      : [24.7136, 46.6753];

    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      touchZoom: true,
      doubleClickZoom: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
    } as L.MapOptions);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      fittedRef.current = false;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    allWithCoords.forEach((loc) => {
      const isSelected = loc.user_id === selectedMemberId;
      const isHidden = !loc.is_sharing;
      const icon = createMemberIcon(loc.name, loc.role, loc.isMe, isSelected, isHidden);
      const statusText = isHidden ? "الموقع مخفي" : timeSince(loc.updated_at);
      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="text-align:center;direction:rtl">
            <p style="font-weight:bold;font-size:13px;margin:0">${loc.name} ${loc.isMe ? "(أنا)" : ""}</p>
            <p style="font-size:11px;color:${isHidden ? "#ef4444" : "#888"};margin:2px 0 0">${statusText}</p>
          </div>
        `);
      marker.on("click", () => onMemberSelect(loc.user_id));
      markersRef.current.set(loc.user_id, marker);
    });

    // Fit bounds on first load
    if (allWithCoords.length > 0 && !fittedRef.current) {
      const bounds = L.latLngBounds(allWithCoords.map((l) => [l.lat, l.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      fittedRef.current = true;
    }
  }, [allWithCoords, selectedMemberId, onMemberSelect]);

  // Fly to selected member
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedMemberId) return;
    const loc = sharingLocations.find((l) => l.user_id === selectedMemberId);
    if (loc) map.flyTo([loc.lat, loc.lng], 16, { duration: 0.8 });
  }, [selectedMemberId]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    />
  );
}
