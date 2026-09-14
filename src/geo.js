import * as THREE from 'three';
import tzlookup from '@photostructure/tz-lookup';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Converts latitude/longitude (degrees) to a point in the globe's local frame,
 * matching how THREE.SphereGeometry lays out an equirectangular texture.
 */
export function latLonToLocalPoint(lat, lon, radius = 1) {
    const latRad = lat * DEG2RAD;
    const lonRad = lon * DEG2RAD;
    return new THREE.Vector3(
        radius * Math.cos(latRad) * Math.cos(lonRad),
        radius * Math.sin(latRad),
        -radius * Math.cos(latRad) * Math.sin(lonRad)
    );
}

/** Inverse of latLonToLocalPoint. Works for any radius. */
export function localPointToLatLon(point) {
    const radius = point.length();
    const lat = Math.asin(THREE.MathUtils.clamp(point.y / radius, -1, 1)) * RAD2DEG;
    const lon = -Math.atan2(point.z, point.x) * RAD2DEG;
    return { lat, lon };
}

/**
 * Approximate point on Earth where the sun is directly overhead.
 * Accurate to about a degree, which is plenty for day/night shading.
 */
export function getSubsolarPoint(date) {
    const dayOfYear = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000;
    const declination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * DEG2RAD);

    // Equation of time (minutes): how far solar noon drifts from 12:00 UTC at longitude 0.
    const b = (360 / 365) * (dayOfYear - 81) * DEG2RAD;
    const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);

    const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const lon = -15 * (utcHours - 12 + equationOfTime / 60);

    return { lat: declination, lon: ((lon + 540) % 360) - 180 };
}

/** Direction sunlight travels (sun towards Earth) in the globe's local frame. */
export function getSunDirection(date) {
    const { lat, lon } = getSubsolarPoint(date);
    return latLonToLocalPoint(lat, lon).negate();
}

// "GMT+02:00" -> "GMT+2", "GMT+05:30" -> "GMT+5:30", "GMT" -> "GMT+0"
function formatGmtOffset(timeZone, date) {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName').value;
    const match = offset.match(/^GMT([+-])(\d{2}):(\d{2})$/);
    if (!match) {
        return 'GMT+0';
    }
    const [, sign, hours, minutes] = match;
    return `GMT${sign}${Number(hours)}${minutes === '00' ? '' : `:${minutes}`}`;
}

/**
 * Local time information for a location, including daylight saving time.
 * Independent of the viewer's own time zone.
 */
export function getLocalTimeInfo(lat, lon, date) {
    const timeZone = tzlookup(lat, lon);
    const format = (options) => new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(date);

    return {
        timezone: formatGmtOffset(timeZone, date),
        timezoneName: timeZone,
        localTime: format({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
        localDay: format({ weekday: 'long' }),
        localDate: format({ year: 'numeric', month: 'long', day: 'numeric' }),
    };
}
