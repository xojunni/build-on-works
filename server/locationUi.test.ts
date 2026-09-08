import { describe, expect, it } from "vitest";
import { geolocationErrorMessage } from "../client/src/lib/location";

describe("GPS mobile guidance", () => {
  it("gives a clear Korean message for denied, unavailable, and timed out positions", () => {
    expect(geolocationErrorMessage(1)).toContain("위치 권한");
    expect(geolocationErrorMessage(2)).toContain("현장 근처");
    expect(geolocationErrorMessage(3)).toContain("시간이 초과");
  });
});
