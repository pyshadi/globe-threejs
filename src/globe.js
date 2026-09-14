import * as THREE from 'three';
import { getLocalTimeInfo, getSunDirection, localPointToLatLon } from './geo.js';

const SIDEREAL_DAY_SECONDS = 86164;

// 10K textures are too large for the npm package, so they're served from the GitHub repo via jsDelivr,
// pinned to a commit so the files can never change underneath users.
const HIGH_RES_TEXTURE_BASE = 'https://cdn.jsdelivr.net/gh/pyshadi/globe-threejs@08f0eeab16a1c28fce80a7fa43116c3076470455/assets/';

const TEXTURES = {
    // Resolved relative to this file, so they work when installed from npm and bundled.
    '4k': {
        day: new URL('../assets/earth-day-4k.jpg', import.meta.url).href,
        night: new URL('../assets/earth-night-4k.jpg', import.meta.url).href,
    },
    '10k': {
        day: `${HIGH_RES_TEXTURE_BASE}8081_earthmap10k.jpg`,
        night: `${HIGH_RES_TEXTURE_BASE}8081_earthlights10k.jpg`,
    },
};

class Globe {
    static TILT = 0.41;

    constructor(options = {}) {
        const defaultOptions = {
            textureResolution: '4k', // '4k' (bundled) or '10k' (loaded from jsDelivr)
            dayTexture: null, // custom texture URLs override textureResolution
            nightTexture: null,
            startTime: new Date(),
            earthRadius: 5,
            onLocationClick: null,
            autoUpdate: true, // set to false to call update() from your own animation loop
        };

        this.options = { ...defaultOptions, ...options };

        const textures = TEXTURES[this.options.textureResolution];
        if (!textures) {
            throw new Error(`Unknown textureResolution "${this.options.textureResolution}". Use '4k' or '10k'.`);
        }
        this.options.dayTexture ??= textures.day;
        this.options.nightTexture ??= textures.night;
        this.currentTime = new Date(this.options.startTime);
        this.lastFrameTime = null;
        this.animationFrameId = null;
        this.loop = this.loop.bind(this);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.init();
    }

    init() {
        this.createGlobe();
        this.updateLighting();
        if (this.options.autoUpdate) {
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    }

    createGlobe() {
        const earthGeometry = new THREE.SphereGeometry(this.options.earthRadius, 128, 128);
        const loader = new THREE.TextureLoader();
        const dayTexture = loader.load(this.options.dayTexture);
        const nightTexture = loader.load(this.options.nightTexture);

        const earthMaterial = new THREE.ShaderMaterial({
            uniforms: {
                dayTexture: { value: dayTexture },
                nightTexture: { value: nightTexture },
                sunDirection: { value: new THREE.Vector3(1, 0, 0) },
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {
                    vUv = uv;
                    vNormal = normal;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D dayTexture;
                uniform sampler2D nightTexture;
                uniform vec3 sunDirection;

                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {
                    vec3 transformedNormal = normalize(vNormal);
                    float intensity = dot(transformedNormal, -sunDirection);
                    intensity = clamp(intensity, -0.05, 1.0);
                    vec4 dayColor = texture2D(dayTexture, vUv);
                    vec4 nightColor = texture2D(nightTexture, vUv);
                    gl_FragColor = mix(nightColor, dayColor, intensity);
                }
            `
        });

        this.earth = new THREE.Mesh(earthGeometry, earthMaterial);
        this.earth.rotation.z = Globe.TILT;
        this.createAtmosphere();
    }

    createAtmosphere() {
        const atmosphereRadius = this.options.earthRadius * 1.016;
        const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, 128, 128);

        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide,
        });

        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.earth.add(this.atmosphere);
    }

    addToScene(scene) {
        scene.add(this.earth);
    }

    updateLighting() {
        this.earth.material.uniforms.sunDirection.value.copy(getSunDirection(this.currentTime));
    }

    setDateTime(date) {
        this.currentTime = new Date(date);
        this.updateLighting();
    }

    getDateTime() {
        return new Date(this.currentTime);
    }

    // Advances the globe's clock by the real time elapsed since the previous call.
    update(now = performance.now()) {
        if (this.lastFrameTime !== null) {
            const elapsedMs = now - this.lastFrameTime;
            this.currentTime = new Date(this.currentTime.getTime() + elapsedMs);
            this.earth.rotation.y += ((2 * Math.PI) / SIDEREAL_DAY_SECONDS) * (elapsedMs / 1000);
        }
        this.lastFrameTime = now;
        this.updateLighting();
    }

    loop(now) {
        this.update(now);
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    handleMouseClick(event, camera, domElement) {
        const rect = domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, camera);

        // Not recursive: clicks that only graze the atmosphere shell are ignored.
        const intersects = this.raycaster.intersectObject(this.earth, false);
        if (intersects.length > 0) {
            const latLon = this.convertPointToLatLon(intersects[0].point);
            const timezoneInfo = this.calculateTimezoneAndLocalTime(latLon.lat, latLon.lon);
            if (typeof this.options.onLocationClick === 'function') {
                this.options.onLocationClick({ ...latLon, ...timezoneInfo });
            }
        }
    }

    // Takes a point in world space; accounts for the globe's position, tilt, spin and scale.
    convertPointToLatLon(point) {
        this.earth.updateWorldMatrix(true, false);
        return localPointToLatLon(this.earth.worldToLocal(point.clone()));
    }

    calculateTimezoneAndLocalTime(lat, lon) {
        return getLocalTimeInfo(lat, lon, this.currentTime);
    }

    dispose() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.earth.removeFromParent();
        this.earth.geometry.dispose();
        this.earth.material.uniforms.dayTexture.value.dispose();
        this.earth.material.uniforms.nightTexture.value.dispose();
        this.earth.material.dispose();
        this.atmosphere.geometry.dispose();
        this.atmosphere.material.dispose();
    }
}

export { Globe };
