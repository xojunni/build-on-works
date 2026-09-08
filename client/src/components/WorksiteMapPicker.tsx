import { useRef } from "react";
import { Crosshair, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapView } from "@/components/Map";

export type WorksiteLocation = { latitude: number; longitude: number };

type Props = {
  value: WorksiteLocation | null;
  onChange: (location: WorksiteLocation) => void;
};

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 };

export function WorksiteMapPicker({ value, onChange }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const setMarker = async (position: google.maps.LatLngLiteral) => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
    if (markerRef.current) markerRef.current.position = position;
    else markerRef.current = new AdvancedMarkerElement({ map, position, title: "출퇴근 인증 현장" });
    map.panTo(position);
    onChange({ latitude: position.lat, longitude: position.lng });
  };

  const handleReady = (map: google.maps.Map) => {
    mapRef.current = map;
    map.addListener("click", (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      void setMarker({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    });
    if (value) void setMarker({ lat: value.latitude, lng: value.longitude });
  };

  const useCurrentMapCenter = () => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    void setMarker({ lat: center.lat(), lng: center.lng() });
  };

  const initialCenter = value ? { lat: value.latitude, lng: value.longitude } : DEFAULT_CENTER;
  return <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/[.06]"><div className="flex items-center justify-between px-3 py-2"><p className="flex items-center gap-1.5 text-xs font-bold text-white/80"><MapPin className="h-3.5 w-3.5 text-[#ff9b70]" />현장 위치 핀</p><Button type="button" onClick={useCurrentMapCenter} size="sm" variant="ghost" className="h-7 px-2 text-xs text-white hover:bg-white/10 hover:text-white"><Crosshair className="mr-1 h-3.5 w-3.5" />중심으로 지정</Button></div><MapView className="h-[260px] bg-[#dfe6df]" initialCenter={initialCenter} initialZoom={value ? 16 : 12} onMapReady={handleReady} /><p className="px-3 py-2 text-[11px] leading-4 text-white/60">지도를 눌러 현장 위치를 정확히 지정하세요. 이 위치를 기준으로 인부의 출퇴근 반경을 확인합니다.</p></div>;
}
