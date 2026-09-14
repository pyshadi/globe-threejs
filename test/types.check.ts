// Compiled by `npm run typecheck` to make sure src/globe.d.ts describes real usage. Never executed.
import * as THREE from 'three';
import { Globe, type GlobeOptions, type LocationInfo } from '../src/globe.js';

const options: GlobeOptions = {
    earthRadius: 5,
    startTime: '2024-06-21T12:00:00Z',
    autoUpdate: false,
    onLocationClick(info: LocationInfo) {
        const label: string = `${info.timezoneName} ${info.localTime} ${info.localDay} ${info.localDate}`;
        const position: number = info.lat + info.lon;
        console.log(label, position);
    },
};

const globe = new Globe(options);
const renderer = new THREE.WebGLRenderer();
const camera = new THREE.PerspectiveCamera();

globe.addToScene(new THREE.Scene());
globe.earth.add(new THREE.Mesh());
globe.earth.material.uniforms.sunDirection.value.set(1, 0, 0);
globe.setDateTime(new Date());
const now: Date = globe.getDateTime();
globe.update(performance.now());
renderer.domElement.addEventListener('pointerup', (event) => globe.handleMouseClick(event, camera, renderer.domElement));
const { lat, lon } = globe.convertPointToLatLon(new THREE.Vector3(0, 0, 5));
const zone: string = globe.calculateTimezoneAndLocalTime(lat, lon).timezone;
globe.dispose();
console.log(now, zone, Globe.TILT);

// @ts-expect-error earthRadius must be a number
new Globe({ earthRadius: 'large' });

new Globe({ textureResolution: '10k' });

// @ts-expect-error only 4k and 10k textures exist
new Globe({ textureResolution: '8k' });

// @ts-expect-error unknown options are rejected
new Globe({ timezoneGeoJSON: 'timezones.geojson' });
