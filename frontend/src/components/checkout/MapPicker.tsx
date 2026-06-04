import { useEffect, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  reverseGeocodeKg,
  type ResolvedMerchantAddress,
} from "../../utils/nominatimGeocode";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const BISHKEK_CENTER: [number, number] = [42.87, 74.59];

type MapPickerProps = {
  lat: number | null;
  lng: number | null;
  setLat: (value: number) => void;
  setLng: (value: number) => void;
  setAddress: (value: string) => void;
  onResolved?: (value: ResolvedMerchantAddress) => void;
};

function MapViewToSelection({
  lat,
  lng,
}: {
  lat: number | null;
  lng: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

function LocationMarker({
  setLat,
  setLng,
  setAddress,
  setReverseBusy,
  onResolved,
}: Omit<MapPickerProps, "lat" | "lng"> & {
  setReverseBusy: (v: boolean) => void;
}) {
  useMapEvents({
    click: async (e) => {
      const nextLat = e.latlng.lat;
      const nextLng = e.latlng.lng;
      setLat(nextLat);
      setLng(nextLng);
      setReverseBusy(true);
      try {
        const resolved = await reverseGeocodeKg(nextLat, nextLng);
        if (resolved.ok) {
          setAddress(resolved.value.displayAddress);
          onResolved?.(resolved.value);
        }
      } catch {
        /* адрес можно ввести вручную */
      } finally {
        setReverseBusy(false);
      }
    },
  });

  return null;
}

export default function MapPicker({
  lat,
  lng,
  setLat,
  setLng,
  setAddress,
  onResolved,
}: MapPickerProps) {
  const [reverseBusy, setReverseBusy] = useState(false);
  const center: [number, number] =
    lat != null && lng != null ? [lat, lng] : BISHKEK_CENTER;

  return (
    <div className="checkout-map-picker">
      <MapContainer
        center={center}
        zoom={13}
        className="checkout-map-picker__map"
        style={{ height: 300, width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewToSelection lat={lat} lng={lng} />
        <LocationMarker
          setLat={setLat}
          setLng={setLng}
          setAddress={setAddress}
          setReverseBusy={setReverseBusy}
          onResolved={onResolved}
        />
        {lat != null && lng != null ? <Marker position={[lat, lng]} /> : null}
      </MapContainer>
      {reverseBusy ? (
        <p className="checkout-map-picker__geocode" role="status" aria-live="polite">
          Подбираем адрес…
        </p>
      ) : null}
    </div>
  );
}
