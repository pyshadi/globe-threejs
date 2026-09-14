import type { Camera, Mesh, MeshBasicMaterial, Object3D, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

/** Information passed to `onLocationClick`. */
export interface LocationInfo {
    /** Latitude in degrees, from -90 (south) to 90 (north). */
    lat: number;
    /** Longitude in degrees, from -180 (west) to 180 (east). */
    lon: number;
    /** UTC offset, e.g. `GMT+2` or `GMT+5:30`. */
    timezone: string;
    /** IANA time zone name, e.g. `Europe/Berlin`. */
    timezoneName: string;
    /** Local time, e.g. `14:05:09`. */
    localTime: string;
    /** Local day of the week, e.g. `Monday`. */
    localDay: string;
    /** Local date, e.g. `July 1, 2024`. */
    localDate: string;
}

export interface GlobeOptions {
    /**
     * Resolution of the built-in textures. `'4k'` (default) ships with the package;
     * `'10k'` is sharper but much larger and is loaded from the jsDelivr CDN.
     */
    textureResolution?: '4k' | '10k';
    /** URL of a custom daytime texture. Overrides `textureResolution`. */
    dayTexture?: string;
    /** URL of a custom nighttime texture. Overrides `textureResolution`. */
    nightTexture?: string;
    /** Date and time the globe starts at. Defaults to now. */
    startTime?: Date | string | number;
    /** Radius of the globe in Three.js units. Defaults to 5. */
    earthRadius?: number;
    /** Called when a location on the globe is clicked. */
    onLocationClick?: ((location: LocationInfo) => void) | null;
    /** Run an internal animation loop. Set to false to call `update()` yourself. Defaults to true. */
    autoUpdate?: boolean;
}

export class Globe {
    /** Axial tilt applied to the globe, in radians. */
    static TILT: number;

    constructor(options?: GlobeOptions);

    options: Required<GlobeOptions>;

    /** The globe mesh. Add children to have them rotate with the Earth. */
    earth: Mesh<SphereGeometry, ShaderMaterial>;

    atmosphere: Mesh<SphereGeometry, MeshBasicMaterial>;

    /** Adds the globe to a scene (or any other object). */
    addToScene(scene: Object3D): void;

    /** Sets the globe's date and time. The clock keeps running from there. */
    setDateTime(date: Date | string | number): void;

    /** Returns the globe's current date and time. */
    getDateTime(): Date;

    /**
     * Advances the clock, rotation and lighting by the time since the previous call.
     * Only needed when `autoUpdate` is false.
     * @param now Timestamp in milliseconds, e.g. from `requestAnimationFrame`. Defaults to `performance.now()`.
     */
    update(now?: number): void;

    /** Raycasts a mouse or pointer event and calls `onLocationClick` if the globe was hit. */
    handleMouseClick(event: { clientX: number; clientY: number }, camera: Camera, domElement: Element): void;

    /** Converts a point on the globe's surface in world space to latitude and longitude. */
    convertPointToLatLon(point: Vector3): { lat: number; lon: number };

    /** Time zone and local time for a location, at the globe's current date and time. */
    calculateTimezoneAndLocalTime(lat: number, lon: number): Omit<LocationInfo, 'lat' | 'lon'>;

    /** Stops the animation loop, removes the globe from its scene and frees GPU resources. */
    dispose(): void;
}
