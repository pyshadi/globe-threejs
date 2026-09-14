import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Globe } from '../src/globe.js';
import { getSunDirection, latLonToLocalPoint } from '../src/geo.js';

const JUNE = new Date('2024-06-21T12:00:00Z');
const DECEMBER = new Date('2024-12-21T12:00:00Z');

beforeEach(() => {
    // Loading textures needs a browser; these tests only look at the scene graph and maths.
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('Globe', () => {
    it('can be added to a scene immediately after construction', () => {
        const globe = new Globe();
        const scene = new THREE.Scene();

        globe.addToScene(scene);

        expect(globe.earth).toBeInstanceOf(THREE.Mesh);
        expect(scene.children).toContain(globe.earth);
    });

    it('resolves the default textures relative to the package', () => {
        const globe = new Globe();

        expect(globe.options.dayTexture).toMatch(/\/assets\/earth-day-4k\.jpg$/);
        expect(globe.options.nightTexture).toMatch(/\/assets\/earth-night-4k\.jpg$/);
        expect(() => new URL(globe.options.dayTexture)).not.toThrow();
    });

    it('loads 10K textures from the CDN when requested', () => {
        const globe = new Globe({ textureResolution: '10k' });

        expect(globe.options.dayTexture).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/pyshadi\/globe-threejs@[0-9a-f]{40}\/assets\/8081_earthmap10k\.jpg$/);
        expect(globe.options.nightTexture).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/pyshadi\/globe-threejs@[0-9a-f]{40}\/assets\/8081_earthlights10k\.jpg$/);
    });

    it('prefers custom texture URLs over textureResolution', () => {
        const globe = new Globe({ textureResolution: '10k', dayTexture: 'my-day.jpg' });

        expect(globe.options.dayTexture).toBe('my-day.jpg');
        expect(globe.options.nightTexture).toMatch(/8081_earthlights10k\.jpg$/);
    });

    it('rejects unknown texture resolutions', () => {
        expect(() => new Globe({ textureResolution: '8k' })).toThrow(/textureResolution/);
    });

    it('lights the globe for startTime and setDateTime', () => {
        const globe = new Globe({ startTime: JUNE });
        const sunDirection = globe.earth.material.uniforms.sunDirection.value;

        expect(sunDirection.distanceTo(getSunDirection(JUNE))).toBeLessThan(1e-9);

        globe.setDateTime(DECEMBER);
        expect(globe.getDateTime()).toEqual(DECEMBER);
        expect(sunDirection.distanceTo(getSunDirection(DECEMBER))).toBeLessThan(1e-9);
    });

    it('advances its own clock from startTime when updated manually', () => {
        const globe = new Globe({ startTime: JUNE, autoUpdate: false });

        globe.update(1000);
        globe.update(61000);

        expect(globe.getDateTime().getTime()).toBe(JUNE.getTime() + 60000);
        expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('converts clicked points correctly after the globe has moved and spun', () => {
        const globe = new Globe({ autoUpdate: false });
        globe.earth.position.set(3, -2, 1);
        globe.earth.rotation.y = 1.234;
        globe.earth.updateMatrixWorld();

        for (const [lat, lon] of [[48.85, 2.35], [-33.87, 151.21], [40.71, -74.01], [0, 179]]) {
            const worldPoint = globe.earth.localToWorld(latLonToLocalPoint(lat, lon, 5));
            const original = worldPoint.clone();

            const result = globe.convertPointToLatLon(worldPoint);

            expect(result.lat).toBeCloseTo(lat, 6);
            expect(result.lon).toBeCloseTo(lon, 6);
            expect(worldPoint).toEqual(original);
        }
    });

    describe('handleMouseClick', () => {
        const domElement = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
        let camera;

        beforeEach(() => {
            camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
            camera.position.z = 15;
            camera.updateMatrixWorld();
        });

        it('reports location and local time for the point under the cursor', () => {
            const onLocationClick = vi.fn();
            const globe = new Globe({ autoUpdate: false, onLocationClick, startTime: JUNE });
            globe.earth.rotation.y = 2;
            globe.earth.updateMatrixWorld();

            globe.handleMouseClick({ clientX: 50, clientY: 50 }, camera, domElement);

            expect(onLocationClick).toHaveBeenCalledOnce();
            const info = onLocationClick.mock.calls[0][0];
            const expected = globe.convertPointToLatLon(new THREE.Vector3(0, 0, 5));
            expect(info.lat).toBeCloseTo(expected.lat, 1);
            expect(info.lon).toBeCloseTo(expected.lon, 1);
            expect(info.timezoneName).toEqual(expect.any(String));
            expect(info.localTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });

        it('ignores clicks that only hit the atmosphere', () => {
            const onLocationClick = vi.fn();
            const globe = new Globe({ autoUpdate: false, onLocationClick });
            globe.earth.updateMatrixWorld();

            // Aim the ray so it passes 5.04 units from the centre: outside the earth (5), inside the atmosphere (5.08).
            const missDistance = 5.04;
            const targetY = (missDistance * 15) / Math.sqrt(15 * 15 - missDistance * missDistance);
            const ndcY = targetY / (15 * Math.tan(THREE.MathUtils.degToRad(37.5)));

            globe.handleMouseClick({ clientX: 50, clientY: (1 - ndcY) * 50 }, camera, domElement);

            expect(onLocationClick).not.toHaveBeenCalled();
        });
    });

    it('dispose stops the animation loop and removes the globe from the scene', () => {
        const globe = new Globe();
        const scene = new THREE.Scene();
        globe.addToScene(scene);

        globe.dispose();

        expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
        expect(scene.children).not.toContain(globe.earth);
    });
});
