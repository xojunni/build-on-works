import { describe, expect, it } from "vitest";
import { haversineDistanceMeters, verifyWorksiteGeofence } from "./geofence";

describe("worksite GPS geofence", () => {
  const site = { latitude: 37.5665, longitude: 126.9780 };

  it("calculates zero metres for an identical coordinate and rejects locations beyond the configured radius", () => {
    expect(haversineDistanceMeters(site, site)).toBe(0);
    const result = verifyWorksiteGeofence({ siteLatitude: site.latitude, siteLongitude: site.longitude, geofenceRadiusMeters: 100 }, { latitude: 37.568, longitude: 126.978 });
    expect(result.required).toBe(true);
    expect(result.withinRange).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(100);
  });

  it("allows a nearby coordinate and preserves legacy jobs without saved coordinates", () => {
    expect(verifyWorksiteGeofence({ siteLatitude: site.latitude, siteLongitude: site.longitude, geofenceRadiusMeters: 200 }, { latitude: 37.567, longitude: 126.978 }).withinRange).toBe(true);
    expect(verifyWorksiteGeofence({ siteLatitude: site.latitude, siteLongitude: site.longitude, geofenceRadiusMeters: 150 }, null)).toEqual({ required: true, withinRange: false, distanceMeters: null });
    expect(verifyWorksiteGeofence({ siteLatitude: null, siteLongitude: null, geofenceRadiusMeters: 150 }, null)).toEqual({ required: false, withinRange: true, distanceMeters: null });
  });
});
