import * as THREE from 'three';
import * as turf from '@turf/turf';


class Globe {
    static TILT = 0.41;

    constructor(options = {}) {
        const defaultOptions = {
            dayTexture: '../assets/8081_earthmap10k.jpg',
            nightTexture: '../assets/8081_earthlights10k.jpg',
            startTime: new Date(),
            earthRadius: 5,
            onLocationClick: null,
            timezoneGeoJSON: '../assets/all-timezones_.geojson', // Path to timezone GeoJSON
        };

        this.options = { ...defaultOptions, ...options };
        this.startTime = this.options.startTime;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.init();
    }

    async init() {
        await this.loadTimezones();
        this.createGlobe();
        this.updateLighting();
        requestAnimationFrame(this.update.bind(this));
    }

    async loadTimezones() {
        const response = await fetch(this.options.timezoneGeoJSON);
        this.timezonesData = await response.json();
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
        if (this.earth instanceof THREE.Object3D) {
            scene.add(this.earth);
        } else {
            console.error('Earth is not an instance of THREE.Object3D', this.earth);
        }
    }

    calculateSunPosition() {
        const now = new Date();
        const dayOfYear = (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86400000;
        const declination = 23.44 * Math.cos(((360 / 365) * (dayOfYear + 10)) * (Math.PI / 180));

        const earthTilt = declination * (Math.PI / 180);
        const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
        const sunAngle = (utcHours / 24) * 2 * Math.PI;

        const sunPosition = new THREE.Vector3(
            Math.cos(sunAngle),
            Math.sin(earthTilt),
            Math.sin(sunAngle)
        );

        return sunPosition.normalize();
    }

    updateLighting() {
        const sunDirection = this.calculateSunPosition();
        this.earth.material.uniforms.sunDirection.value.copy(sunDirection);
    }

    setDateTime(date) {
        this.startTime = date;
        this.updateLighting();
    }

    update() {
        const now = new Date();
        const rotation = (2 * Math.PI) / 86164;
        this.earth.rotation.y += rotation * (now - this.startTime) / 1000;
        this.startTime = now;
        this.updateLighting();
        requestAnimationFrame(this.update.bind(this));
    }

    handleMouseClick(event, camera, domElement) {
        this.mouse.x = ((event.clientX - domElement.getBoundingClientRect().left) / domElement.clientWidth) * 2 - 1;
        this.mouse.y = -((event.clientY - domElement.getBoundingClientRect().top) / domElement.clientHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, camera);

        const intersects = this.raycaster.intersectObject(this.earth);
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const point = intersect.point;
            const latLon = this.convertPointToLatLon(point);
            const timezoneInfo = this.calculateTimezoneAndLocalTime(latLon.lat, latLon.lon);
            if (typeof this.options.onLocationClick === 'function') {
                this.options.onLocationClick({ ...latLon, ...timezoneInfo });
            }
        }
    }

    convertPointToLatLon(point) {
        const radius = this.options.earthRadius;

        const tiltMatrix = new THREE.Matrix4().makeRotationZ(-Globe.TILT);
        point.applyMatrix4(tiltMatrix);

        const lat = Math.asin(point.y / radius) * (180 / Math.PI);
        let lon = Math.atan2(point.z, point.x) * (180 / Math.PI);

        lon *= -1;

        return { lat, lon };
    }

    calculateTimezoneAndLocalTime(lat, lon) {
        const point = turf.point([lon, lat]);

        let timezoneOffset = 0;
        let timezoneInfo = 'GMT';
        let localTime = 'Unknown';
        let localDay = 'Unknown';
        let localDate = 'Unknown';

        if (this.timezonesData) {
            for (const feature of this.timezonesData.features) {
                if (turf.booleanPointInPolygon(point, feature)) {
                    timezoneOffset = feature.properties.ZONE;
                    timezoneInfo = `GMT${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;
                    const localDateTime = this.calculateLocalDateTime(timezoneOffset, lat, lon);
                    localTime = localDateTime.localTime;
                    localDay = localDateTime.localDay;
                    localDate = localDateTime.localDate;
                    break;
                }
            }
        }

        return {
            timezone: timezoneInfo,
            localTime: localTime,
            localDay: localDay,
            localDate: localDate,
        };
    }

    calculateLocalDateTime(timezoneOffset, lat, lon) {
        const now = new Date();

        const utcHours = now.getUTCHours();
        const utcMinutes = now.getUTCMinutes();

        let localHours = utcHours + timezoneOffset;

        const isDST = this.isDST(lat, lon, now);
        if (isDST) {
            localHours += 1;
        }

        let adjustedDate = new Date(now.getTime());

        if (localHours >= 24) {
            localHours -= 24;
            adjustedDate.setDate(adjustedDate.getDate() + 1);
        } else if (localHours < 0) {
            localHours += 24;
            adjustedDate.setDate(adjustedDate.getDate() - 1);
        }

        adjustedDate.setHours(localHours);
        adjustedDate.setMinutes(utcMinutes);

        const localTime = adjustedDate.toTimeString().split(' ')[0];

        const localDay = adjustedDate.toLocaleString('en-US', { weekday: 'long' });
        const localDate = adjustedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        return {
            localTime: localTime,
            localDay: localDay,
            localDate: localDate,
        };
    }

    isDST(lat, lon, date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();

        const isNorthernHemisphere = lat >= 0;
        if (isNorthernHemisphere) {
            return (month > 3 && month < 11) || 
                   (month === 3 && day >= this.getLastSundayOfMonth(date).getDate()) || 
                   (month === 10 && day <= this.getLastSundayOfMonth(date).getDate());
        } else {
            return (month < 4 || month > 9) || 
                   (month === 4 && day <= this.getLastSundayOfMonth(date).getDate()) || 
                   (month === 9 && day >= this.getLastSundayOfMonth(date).getDate());
        }
    }

    getLastSundayOfMonth(date) {
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const dayOfWeek = lastDayOfMonth.getDay();
        const lastSunday = lastDayOfMonth.getDate() - dayOfWeek;
        return new Date(date.getFullYear(), date.getMonth(), lastSunday);
    }
}

export { Globe };
