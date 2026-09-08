export type Coordinate = { latitude: number; longitude: number };

export type WorksiteGeofence = {
  siteLatitude: number | null;
  siteLongitude: number | null;
  geofenceRadiusMeters: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function haversineDistanceMeters(from: Coordinate, to: Coordinate) {
  const dLat = radians(to.latitude - from.latitude);
  const dLng = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function verifyWorksiteGeofence(worksite: WorksiteGeofence, position: Coordinate | null) {
  if (worksite.siteLatitude === null || worksite.siteLongitude === null) return { required: false, withinRange: true, distanceMeters: null };
  if (!position) return { required: true, withinRange: false, distanceMeters: null };
  const distanceMeters = haversineDistanceMeters(position, { latitude: worksite.siteLatitude, longitude: worksite.siteLongitude });
  return { required: true, withinRange: distanceMeters <= worksite.geofenceRadiusMeters, distanceMeters };
}
