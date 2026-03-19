import SunCalc from 'suncalc'

const RAD_TO_DEG = 180 / Math.PI

export interface SunPosition {
  altitudeDeg: number
  azimuthDeg: number
}

export interface GoldenHourWindow {
  start: Date
  end: Date
}

export interface BlueHourWindow {
  start: Date
  end: Date
}

/**
 * Returns the sun position (altitude and azimuth in degrees) for the given
 * location and moment in time.
 *
 * SunCalc returns azimuth in radians measured from South clockwise, so we
 * convert to the conventional 0–360° bearing from North.
 */
export function getSunPosition(lat: number, lng: number, date: Date): SunPosition {
  const pos = SunCalc.getPosition(date, lat, lng)
  const altitudeDeg = pos.altitude * RAD_TO_DEG
  // SunCalc azimuth is measured from South (positive = west), convert to
  // 0–360° bearing from North (clockwise)
  const azimuthDeg = (pos.azimuth * RAD_TO_DEG + 180) % 360
  return { altitudeDeg, azimuthDeg }
}

/**
 * Returns the evening golden-hour window for the given date and location.
 * SunCalc's `goldenHour` key is the start of the golden hour (before sunset)
 * and `goldenHourEnd` is the start of the golden hour after sunrise. We use
 * the evening window (around sunset).
 */
export function getGoldenHour(lat: number, lng: number, date: Date): GoldenHourWindow {
  const times = SunCalc.getTimes(date, lat, lng)
  return {
    start: times.goldenHour,
    end: times.sunsetStart,
  }
}

/**
 * Returns the evening blue-hour window for the given date and location.
 * The blue hour sits between the end of civil twilight (sunset) and the start
 * of nautical twilight (dusk).
 */
export function getBlueHour(lat: number, lng: number, date: Date): BlueHourWindow {
  const times = SunCalc.getTimes(date, lat, lng)
  return {
    start: times.sunset,
    end: times.dusk,
  }
}
