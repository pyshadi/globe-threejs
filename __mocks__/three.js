// Mock for Three.js – avoids WebGL dependency in Node.js test environment

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    normalize() {
        const len = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2) || 1;
        this.x /= len; this.y /= len; this.z /= len;
        return this;
    }
    applyMatrix4(m) {
        const x = this.x, y = this.y, z = this.z;
        const e = m.elements;
        this.x = e[0] * x + e[4] * y + e[8]  * z + e[12];
        this.y = e[1] * x + e[5] * y + e[9]  * z + e[13];
        this.z = e[2] * x + e[6] * y + e[10] * z + e[14];
        return this;
    }
}

class Vector2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}

class Matrix4 {
    constructor() {
        // identity
        this.elements = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    }
    makeRotationZ(theta) {
        const c = Math.cos(theta), s = Math.sin(theta);
        this.elements = [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
        return this;
    }
}

class SphereGeometry {}
class TextureLoader {
    load() { return {}; }
}
class ShaderMaterial {
    constructor(params = {}) {
        this.uniforms = params.uniforms || {};
    }
}
class MeshBasicMaterial {}
class Object3D {}
class Mesh extends Object3D {
    constructor(geometry, material) {
        super();
        this.geometry = geometry;
        this.material = material;
        this.rotation = { x: 0, y: 0, z: 0 };
        this.children = [];
    }
    add(child) { this.children.push(child); }
}
class Raycaster {
    setFromCamera() {}
    intersectObject() { return []; }
}

const BackSide = 1;

module.exports = {
    Vector3,
    Vector2,
    Matrix4,
    SphereGeometry,
    TextureLoader,
    ShaderMaterial,
    MeshBasicMaterial,
    Mesh,
    Raycaster,
    Object3D,
    BackSide,
};
