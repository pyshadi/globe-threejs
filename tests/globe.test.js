/**
 * Tests for the Globe class.
 *
 * Three.js is mocked via __mocks__/three.js to avoid WebGL requirements.
 * `fetch` and `requestAnimationFrame` are mocked globally below.
 */

// Minimal timezone GeoJSON used by several tests
const MOCK_TIMEZONE_DATA = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]],
            },
            properties: { ZONE: 1 },
        },
    ],
};

// Stub browser globals unavailable in Node.js
global.fetch = jest.fn(() =>
    Promise.resolve({ json: () => Promise.resolve(MOCK_TIMEZONE_DATA) })
);
global.requestAnimationFrame = jest.fn();

const { Globe } = require('../src/globe.js');

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a Globe instance whose async `init()` has fully resolved.
 * @param {object} [options]
 * @returns {Promise<Globe>}
 */
async function makeGlobe(options = {}) {
    const globe = new Globe(options);
    // Wait for the promise returned by init() to settle
    await globe._initPromise;
    return globe;
}

// ─── constructor / init ────────────────────────────────────────────────────────

describe('Globe constructor', () => {
    test('applies default options', async () => {
        const globe = await makeGlobe();
        expect(globe.options.earthRadius).toBe(5);
        expect(globe.options.onLocationClick).toBeNull();
    });

    test('merges custom options over defaults', async () => {
        const globe = await makeGlobe({ earthRadius: 8 });
        expect(globe.options.earthRadius).toBe(8);
        // Defaults not overridden should still be present
        expect(typeof globe.options.dayTexture).toBe('string');
    });

    test('creates earth Mesh after init', async () => {
        const { Mesh } = require('../src/globe.js').__THREE || require('../__mocks__/three.js');
        const globe = await makeGlobe();
        expect(globe.earth).toBeDefined();
    });

    test('loads timezone data via fetch', async () => {
        global.fetch.mockClear();
        await makeGlobe();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain('geojson');
    });
});

// ─── calculateSunPosition ──────────────────────────────────────────────────────

describe('Globe.calculateSunPosition', () => {
    test('returns a roughly unit-length vector', async () => {
        const globe = await makeGlobe();
        const sun = globe.calculateSunPosition();
        const len = Math.sqrt(sun.x ** 2 + sun.y ** 2 + sun.z ** 2);
        expect(len).toBeCloseTo(1, 5);
    });

    test('returns a Vector3-like object with x, y, z', async () => {
        const globe = await makeGlobe();
        const sun = globe.calculateSunPosition();
        expect(typeof sun.x).toBe('number');
        expect(typeof sun.y).toBe('number');
        expect(typeof sun.z).toBe('number');
    });
});

// ─── convertPointToLatLon ──────────────────────────────────────────────────────

describe('Globe.convertPointToLatLon', () => {
    test('north pole maps to ~90° latitude', async () => {
        const globe = await makeGlobe({ earthRadius: 5 });
        const { Vector3 } = require('../__mocks__/three.js');
        // Approximate north pole (ignoring tilt correction for this check)
        const point = new Vector3(0, 5, 0);
        const { lat } = globe.convertPointToLatLon(point);
        // After tilt rotation the latitude will be near 90 but not exactly;
        // verify it is in the valid range.
        expect(lat).toBeGreaterThan(60);
        expect(lat).toBeLessThanOrEqual(90);
    });

    test('returns lat in [-90, 90] and lon in [-180, 180]', async () => {
        const globe = await makeGlobe({ earthRadius: 5 });
        const { Vector3 } = require('../__mocks__/three.js');
        const point = new Vector3(3, 2, 4);
        const { lat, lon } = globe.convertPointToLatLon(point);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
        expect(lon).toBeGreaterThanOrEqual(-180);
        expect(lon).toBeLessThanOrEqual(180);
    });
});

// ─── getLastSundayOfMonth ──────────────────────────────────────────────────────

describe('Globe.getLastSundayOfMonth', () => {
    test('result is always a Sunday', async () => {
        const globe = await makeGlobe();
        const date = new Date(2024, 2, 15); // March 2024
        const lastSunday = globe.getLastSundayOfMonth(date);
        expect(lastSunday.getDay()).toBe(0); // 0 = Sunday
    });

    test('result falls in the same month', async () => {
        const globe = await makeGlobe();
        const date = new Date(2024, 9, 1); // October 2024
        const lastSunday = globe.getLastSundayOfMonth(date);
        expect(lastSunday.getMonth()).toBe(9); // October
    });
});

// ─── isDST ────────────────────────────────────────────────────────────────────

describe('Globe.isDST', () => {
    test('northern hemisphere mid-summer is DST', async () => {
        const globe = await makeGlobe();
        const july = new Date(2024, 6, 15); // July
        expect(globe.isDST(51, 0, july)).toBe(true); // London-ish lat
    });

    test('northern hemisphere mid-winter is not DST', async () => {
        const globe = await makeGlobe();
        const january = new Date(2024, 0, 15); // January
        expect(globe.isDST(51, 0, january)).toBe(false);
    });

    test('southern hemisphere mid-summer (Jan) is DST', async () => {
        const globe = await makeGlobe();
        const january = new Date(2024, 0, 15);
        expect(globe.isDST(-33, 151, january)).toBe(true); // Sydney-ish lat
    });
});

// ─── setDateTime ──────────────────────────────────────────────────────────────

describe('Globe.setDateTime', () => {
    test('updates startTime', async () => {
        const globe = await makeGlobe();
        const newDate = new Date('2024-06-21T12:00:00Z');
        globe.setDateTime(newDate);
        expect(globe.startTime).toEqual(newDate);
    });
});

// ─── addToScene ───────────────────────────────────────────────────────────────

describe('Globe.addToScene', () => {
    test('adds earth to a mock scene', async () => {
        const globe = await makeGlobe();
        const scene = { add: jest.fn() };
        globe.addToScene(scene);
        expect(scene.add).toHaveBeenCalledWith(globe.earth);
    });

    test('does not throw when earth is not yet an Object3D', async () => {
        const globe = await makeGlobe();
        const originalEarth = globe.earth;
        globe.earth = null; // simulate uninitialized state
        const scene = { add: jest.fn() };
        expect(() => globe.addToScene(scene)).not.toThrow();
        globe.earth = originalEarth; // restore
    });
});
