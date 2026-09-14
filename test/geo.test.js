import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
    getLocalTimeInfo,
    getSubsolarPoint,
    getSunDirection,
    latLonToLocalPoint,
    localPointToLatLon,
} from '../src/geo.js';

describe('latLonToLocalPoint / localPointToLatLon', () => {
    it('are inverses of each other', () => {
        for (const [lat, lon] of [[0, 0], [48.85, 2.35], [-33.87, 151.21], [40.71, -74.01], [89, -179]]) {
            const result = localPointToLatLon(latLonToLocalPoint(lat, lon, 5));
            expect(result.lat).toBeCloseTo(lat, 9);
            expect(result.lon).toBeCloseTo(lon, 9);
        }
    });

    it('matches the texture layout of THREE.SphereGeometry', () => {
        const geometry = new THREE.SphereGeometry(5, 64, 32);
        const position = geometry.attributes.position;
        const uv = geometry.attributes.uv;
        const vertex = new THREE.Vector3();
        let checked = 0;

        for (let i = 0; i < position.count; i++) {
            const expectedLat = (uv.getY(i) - 0.5) * 180;
            const expectedLon = uv.getX(i) * 360 - 180;
            // Skip the poles and the texture seam, where longitude is ambiguous.
            if (Math.abs(expectedLat) > 89 || Math.abs(expectedLon) > 179.9) continue;

            // Geometry is stored as 32-bit floats, so allow for rounding.
            const { lat, lon } = localPointToLatLon(vertex.fromBufferAttribute(position, i));
            expect(lat).toBeCloseTo(expectedLat, 4);
            expect(lon).toBeCloseTo(expectedLon, 4);
            checked++;
        }
        expect(checked).toBeGreaterThan(1000);
    });
});

describe('getSubsolarPoint', () => {
    it('puts the sun over the Tropic of Cancer at the June solstice', () => {
        const { lat, lon } = getSubsolarPoint(new Date('2024-06-21T12:00:00Z'));
        expect(Math.abs(lat - 23.44)).toBeLessThan(1);
        expect(Math.abs(lon)).toBeLessThan(2);
    });

    it('puts the sun over the Tropic of Capricorn at the December solstice', () => {
        const { lat } = getSubsolarPoint(new Date('2024-12-21T12:00:00Z'));
        expect(Math.abs(lat + 23.44)).toBeLessThan(1);
    });

    it('puts the sun over the equator at the March equinox', () => {
        const { lat } = getSubsolarPoint(new Date('2024-03-20T12:00:00Z'));
        expect(Math.abs(lat)).toBeLessThan(1.5);
    });

    it('moves west by 15 degrees per hour', () => {
        expect(Math.abs(getSubsolarPoint(new Date('2024-06-21T18:00:00Z')).lon + 90)).toBeLessThan(2);
        expect(Math.abs(Math.abs(getSubsolarPoint(new Date('2024-06-21T00:00:00Z')).lon) - 180)).toBeLessThan(2);
    });
});

describe('getSunDirection', () => {
    it('shines straight down onto the subsolar point', () => {
        const date = new Date('2024-09-14T08:30:00Z');
        const { lat, lon } = getSubsolarPoint(date);
        const surfaceNormal = latLonToLocalPoint(lat, lon);
        expect(surfaceNormal.dot(getSunDirection(date).negate())).toBeCloseTo(1, 9);
    });
});

describe('getLocalTimeInfo', () => {
    it.each([
        ['Berlin in summer (DST)', 52.52, 13.405, '2024-07-01T12:00:00Z', 'Europe/Berlin', 'GMT+2', '14:00:00', 'Monday', 'July 1, 2024'],
        ['Berlin in winter', 52.52, 13.405, '2024-01-15T12:00:00Z', 'Europe/Berlin', 'GMT+1', '13:00:00', 'Monday', 'January 15, 2024'],
        ['Tokyo has no DST', 35.68, 139.69, '2024-07-01T12:00:00Z', 'Asia/Tokyo', 'GMT+9', '21:00:00', 'Monday', 'July 1, 2024'],
        ['Delhi half-hour offset', 28.61, 77.21, '2024-07-01T12:00:00Z', 'Asia/Kolkata', 'GMT+5:30', '17:30:00', 'Monday', 'July 1, 2024'],
        ['New York previous day', 40.71, -74.01, '2024-07-01T02:00:00Z', 'America/New_York', 'GMT-4', '22:00:00', 'Sunday', 'June 30, 2024'],
        ['Sydney in southern winter', -33.87, 151.21, '2024-07-01T12:00:00Z', 'Australia/Sydney', 'GMT+10', '22:00:00', 'Monday', 'July 1, 2024'],
        ['Adelaide in southern summer', -34.93, 138.6, '2024-01-15T12:00:00Z', 'Australia/Adelaide', 'GMT+10:30', '22:30:00', 'Monday', 'January 15, 2024'],
    ])('%s', (_, lat, lon, iso, timezoneName, timezone, localTime, localDay, localDate) => {
        expect(getLocalTimeInfo(lat, lon, new Date(iso))).toEqual({ timezoneName, timezone, localTime, localDay, localDate });
    });
});
