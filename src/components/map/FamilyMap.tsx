import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

function createMemberIcon(name: string, role: string, isMe: boolean, isSelected: boolean) {
  const color = isMe ? "#ef4444" : (ROLE_COLORS[role] || "#6b7280");
  const size = isSelected ? 44 : 36;
  const initial = name.charAt(0) || "?";
  const border = isSelected ? "3px solid white" : "2px solid white";

  return L.divIcon({
    className: "custom-member-marker",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};color:white;display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:${isSelected ? 16 : 14}px;
      border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.3);
      transition:all 0.2s;
    ">${initial}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Auto-fit bounds when locations change
function FitBounds({ locations }: { locations: MemberLocation[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (locations.length === 0 || fitted.current) return;
    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    fitted.current = true;
  }, [locations, map]);

  return null;
}

// Fly to selected member
function FlyToMember({ locations, selectedId }: { locations: MemberLocation[]; selectedId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId) return;
    const loc = locations.find((l) => l.user_id === selectedId);
    if (loc) map.flyTo([loc.lat, loc.lng], 16, { duration: 0.8 });
  }, [selectedId, locations, map]);

  return null;
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
  const sharingLocations = locations.filter((l) => l.is_sharing);
  const defaultCenter: [number, number] = sharingLocations.length > 0
    ? [sharingLocations[0].lat, sharingLocations[0].lng]
    : [24.7136, 46.6753]; // Riyadh default

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      className={className}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds locations={sharingLocations} />
      <FlyToMember locations={sharingLocations} selectedId={selectedMemberId} />

      {sharingLocations.map((loc) => (
        <Marker
          key={loc.user_id}
          position={[loc.lat, loc.lng]}
          icon={createMemberIcon(loc.name, loc.role, loc.isMe, loc.user_id === selectedMemberId)}
          eventHandlers={{ click: () => onMemberSelect(loc.user_id) }}
        >
          <Popup>
            <div className="text-center" dir="rtl">
              <p className="font-bold text-sm">{loc.name} {loc.isMe ? "(أنا)" : ""}</p>
              <p className="text-xs text-muted-foreground">{timeSince(loc.updated_at)}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
