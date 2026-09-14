import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Globe } from '../src/globe.js';
import { latLonToLocalPoint } from '../src/geo.js';

const info = document.getElementById('info');
const clock = document.getElementById('clock');
const dateTimeInput = document.getElementById('datetime');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 7;
controls.maxDistance = 60;

const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 })
);
marker.visible = false;

// Open the demo with ?res=10k to try the high-resolution textures.
const textureResolution = new URLSearchParams(window.location.search).get('res') === '10k' ? '10k' : '4k';
document.getElementById(`res-${textureResolution}`).classList.add('active');

const globe = new Globe({
    textureResolution,
    onLocationClick(location) {
        // The marker is a child of the globe, so it should stay on the clicked spot as the globe spins.
        marker.position.copy(latLonToLocalPoint(location.lat, location.lon, globe.options.earthRadius));
        marker.visible = true;
        info.textContent = [
            `Lat, lon:  ${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`,
            `Time zone: ${location.timezoneName} (${location.timezone})`,
            `Local:     ${location.localTime}`,
            `           ${location.localDay}, ${location.localDate}`,
        ].join('\n');
    },
});
globe.earth.add(marker);
globe.addToScene(scene);

// Treat a pointer press as a click only if it wasn't a drag to orbit the camera.
let pointerDown = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', (event) => {
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 5) {
        globe.handleMouseClick(event, camera, renderer.domElement);
    }
    pointerDown = null;
});

dateTimeInput.addEventListener('change', () => {
    if (dateTimeInput.value) {
        globe.setDateTime(new Date(dateTimeInput.value));
    }
});
document.getElementById('now').addEventListener('click', () => {
    dateTimeInput.value = '';
    globe.setDateTime(new Date());
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
});

setInterval(() => {
    clock.textContent = `Globe time: ${globe.getDateTime().toUTCString()}`;
}, 250);

// Handy for experimenting from the browser console, e.g. globe.setDateTime('2024-12-21T12:00Z')
window.globe = globe;
window.demo = { globe, renderer, scene, camera, controls };
