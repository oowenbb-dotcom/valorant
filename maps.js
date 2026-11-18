import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export function createSurfaceTexture(baseHex, lineHex, style = 'WALL') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    // Broad low-frequency hand-painted Valorant brush strokes
    for (let i = 0; i < 45; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(15,25,35,0.035)';
        ctx.fillRect(Math.random() * 440, Math.random() * 440, 60 + Math.random() * 90, 18 + Math.random() * 35);
    }

    ctx.strokeStyle = lineHex;
    ctx.lineWidth = style === 'CRATE' ? 18 : 6;
    ctx.strokeRect(4, 4, 504, 504);
    if (style === 'CRATE') {
        ctx.fillStyle = '#0f1923';
        ctx.fillRect(24, 210, 464, 92);
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(36, 244, 440, 24);
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText('KINGDOM // RADIANITE', 54, 185);
    } else if (style === 'WOOD') {
        ctx.lineWidth = 5;
        for (let x = 64; x < 512; x += 64) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 512);
            ctx.stroke();
        }
    } else if (style.startsWith('SITE_')) {
        const letter = style.split('_')[1];
        ctx.fillStyle = 'rgba(255, 70, 85, 0.22)';
        ctx.fillRect(24, 24, 464, 464);
        ctx.strokeStyle = '#ff4655';
        ctx.lineWidth = 14;
        ctx.strokeRect(24, 24, 464, 464);
        ctx.fillStyle = '#ece8e1';
        ctx.font = 'bold 230px sans-serif';
        ctx.fillText(letter, 172, 340);
    } else {
        ctx.fillStyle = lineHex;
        ctx.fillRect(0, 420, 512, 28);
        ctx.fillRect(0, 64, 512, 12);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
}
export function buildMap(scene, mapName = 'ASCENT') {
    const colliders = [];
    const solidMeshes = [];
    const penetrableMeshes = [];
    const buyBarriers = [];
    const teleporters = [];
    const ramps = [];
    const destructibles = [];

    const palettes = {
        ASCENT: { sky: 0x7dd3fc, wall: '#eadbc8', trim: '#c7b299', roof: 0xb85d43, floor: '#566373' },
        BIND:   { sky: 0xfde68a, wall: '#e5c097', trim: '#b48a5a', roof: 0x92400e, floor: '#78634a' },
        HAVEN:  { sky: 0x93c5fd, wall: '#d6d3d1', trim: '#a8a29e', roof: 0x991b1b, floor: '#475569' },
        ICEBOX: { sky: 0xbae6fd, wall: '#e0f2fe', trim: '#0284c7', roof: 0x0f172a, floor: '#cbd5e1' },
        LOTUS:  { sky: 0xf9a8d4, wall: '#ead5b7', trim: '#db2777', roof: 0x9d174d, floor: '#3f5e4d' },
        SUNSET: { sky: 0xfdba74, wall: '#ffedd5', trim: '#0d9488', roof: 0xe11d48, floor: '#64748b' }
    };
    const pal = palettes[mapName] || palettes.ASCENT;

    scene.background = new THREE.Color(pal.sky);
    scene.fog = new THREE.FogExp2(pal.sky, 0.0055);

    const floorTex = createSurfaceTexture(pal.floor, '#1e293b', 'FLOOR');
    floorTex.repeat.set(22, 24);
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 110),
        new THREE.MeshToonMaterial({ map: floorTex })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshToonMaterial({ map: createSurfaceTexture(pal.wall, pal.trim, 'WALL') });
    const crateMat = new THREE.MeshToonMaterial({ map: createSurfaceTexture('#0d9488', '#0f1923', 'CRATE') });
    const woodMat = new THREE.MeshToonMaterial({ map: createSurfaceTexture('#92400e', '#451a03', 'WOOD') });
    const roofMat = new THREE.MeshToonMaterial({ color: pal.roof });
    function addBlock(x, y, z, w, h, d, mat = wallMat, opts = {}) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        colliders.push(box);
        if (opts.penetrable) penetrableMeshes.push(mesh);
        else solidMeshes.push(mesh);
        return { mesh, box };
    }

    function addRamp(x, z, width, length, height, dirZ = -1) {
        const slopeAngle = Math.atan2(height, length);
        const rampGeo = new THREE.BoxGeometry(width, 0.3, Math.hypot(length, height));
        const ramp = new THREE.Mesh(rampGeo, woodMat);
        ramp.position.set(x, height / 2, z);
        ramp.rotation.x = dirZ * slopeAngle;
        ramp.receiveShadow = true;
        scene.add(ramp);
        ramps.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - length / 2, maxZ: z + length / 2, height, dirZ });
    }

    function addSiteDecal(x, z, letter) {
        const decal = new THREE.Mesh(
            new THREE.PlaneGeometry(7, 7),
            new THREE.MeshBasicMaterial({ map: createSurfaceTexture('#1e293b', '#ff4655', `SITE_${letter}`), transparent: true })
        );
        decal.rotation.x = -Math.PI / 2;
        decal.position.set(x, 0.02, z);
        scene.add(decal);
    }

    function addSiteBoundaryLines(x, z, w, d) {
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const n = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.22), borderMat);
        n.rotation.x = -Math.PI / 2; n.position.set(x, 0.03, z - d / 2);
        const s = n.clone(); s.position.set(x, 0.03, z + d / 2);
        const e = new THREE.Mesh(new THREE.PlaneGeometry(0.22, d), borderMat);
        e.rotation.x = -Math.PI / 2; e.position.set(x + w / 2, 0.03, z);
        const west = e.clone(); west.position.set(x - w / 2, 0.03, z);
        scene.add(n, s, e, west);
    }

    function addDetailedRadianiteCrate(x, y, z, size = 2.8) {
        const frame = addBlock(x, y, z, size, size, size, crateMat, { penetrable: true });
        const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 0.14, size * 1.02), coreMat);
        vBar.position.set(x, y, z);
        const cornerTrim = new THREE.Mesh(
            new THREE.BoxGeometry(size * 1.03, size * 1.01, size * 1.03),
            new THREE.MeshBasicMaterial({ color: 0x0f1923, wireframe: true })
        );
        cornerTrim.position.set(x, y, z);
        scene.add(vBar, cornerTrim);
        return frame;
    }

    function addBuildingFacadeDetails(x, z, depth) {
        const pillarMat = new THREE.MeshToonMaterial({ color: pal.trim });
        for (let offsetZ = -depth / 2 + 2; offsetZ <= depth / 2 - 2; offsetZ += 6) {
            const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.2, 0.9), pillarMat);
            pilaster.position.set(x, 4.1, z + offsetZ);
            scene.add(pilaster);
        }
    }
    // Outer Arena Perimeter Walls
    addBlock(0, 6, -55, 100, 12, 2);
    addBlock(0, 6, 55, 100, 12, 2);
    addBlock(-50, 6, 0, 2, 12, 110);
    addBlock(50, 6, 0, 2, 12, 110);

    // Eye-Level (1.65m) Architectural Trim Line for Headshot Crosshair Placement
    const eyeTrimMat = new THREE.MeshBasicMaterial({ color: pal.trim });
    const northEyeLine = new THREE.Mesh(new THREE.BoxGeometry(98, 0.08, 0.1), eyeTrimMat);
    northEyeLine.position.set(0, 1.65, -53.9);
    const southEyeLine = northEyeLine.clone();
    southEyeLine.position.z = 53.9;
    scene.add(northEyeLine, southEyeLine);

    // Glowing Teal Buy-Phase Spawn Barriers
    const barrierMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    function addBarrier(x, z, w) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 8), barrierMat);
        mesh.position.set(x, 4, z);
        scene.add(mesh);
        const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 4, z), new THREE.Vector3(w, 8, 0.6));
        colliders.push(box);
        buyBarriers.push({ mesh, box });
    }
    addBarrier(-34, 18, 28);
    addBarrier(0, 18, 22);
    addBarrier(34, 18, 28);
    addBarrier(-34, -18, 28);
    addBarrier(0, -18, 22);
    addBarrier(34, -18, 28);
    if (mapName === 'HAVEN' || mapName === 'LOTUS') {
        addBlock(-17, 4, -6, 8, 8, 34);
        addBlock(-17, 8.3, -6, 9.2, 0.7, 35.2, roofMat);
        addBlock(17, 4, -6, 8, 8, 34);
        addBlock(17, 8.3, -6, 9.2, 0.7, 35.2, roofMat);

        if (mapName === 'LOTUS') {
            const goldPillarMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.4 });
            addBlock(-11, 3.5, -18, 2.2, 7, 2.2, goldPillarMat);
            addBlock(11, 3.5, -18, 2.2, 7, 2.2, goldPillarMat);
        }

        addSiteDecal(-34, -28, 'A');
        addSiteDecal(0, -28, 'B');
        addSiteDecal(34, -28, 'C');
        addSiteBoundaryLines(-34, -28, 15, 15);
        addSiteBoundaryLines(0, -28, 15, 15);
        addSiteBoundaryLines(34, -28, 15, 15);

        addDetailedRadianiteCrate(-34, 1.4, -28, 2.8);
        addDetailedRadianiteCrate(0, 1.4, -28, 2.8);
        addDetailedRadianiteCrate(34, 1.4, -28, 2.8);
    }
    else {
        // Central Mid-Lane Architectural Divider Buildings
        addBlock(-16, 4, 0, 10, 8, 36);
        addBlock(-16, 8.3, 0, 11.4, 0.7, 37.4, roofMat);
        addBuildingFacadeDetails(-10.8, 0, 36);

        addBlock(16, 4, 0, 10, 8, 36);
        addBlock(16, 8.3, 0, 11.4, 0.7, 37.4, roofMat);
        addBuildingFacadeDetails(10.8, 0, 36);

        // Tight Chokepoint Entry Walls & 50/50 Corner Cubbies
        addBlock(-42, 4, -14, 14, 8, 2.5);
        addBlock(-26, 4, -14, 4, 8, 2.5);
        addBlock(-47, 4, -20, 4, 8, 4);

        addBlock(42, 4, -14, 14, 8, 2.5);
        addBlock(26, 4, -14, 4, 8, 2.5);
        addBlock(47, 4, -20, 4, 8, 4);

        // Mid-to-Site Connector Walls
        addBlock(-11, 4, -24, 2.5, 8, 12);
        addBlock(11, 4, -24, 2.5, 8, 12);

        addSiteDecal(-34, -26, 'A');
        addSiteDecal(34, -26, 'B');
        addSiteBoundaryLines(-34, -26, 16, 16);
        addSiteBoundaryLines(34, -26, 16, 16);

        addDetailedRadianiteCrate(-34, 1.4, -26, 2.8);
        addDetailedRadianiteCrate(-34, 4.1, -26, 2.4);
        addDetailedRadianiteCrate(34, 1.4, -26, 2.8);
        addDetailedRadianiteCrate(0, 1.2, 4, 2.4);
        addBlock(-26, 1.2, 8, 3, 2.4, 1.5, woodMat, { penetrable: true });
        addBlock(26, 1.2, 8, 3, 2.4, 1.5, woodMat, { penetrable: true });
    }
    if (mapName === 'BIND') {
        const tpMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true });
        const tpA = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3.5, 16), tpMat);
        tpA.position.set(-44, 1.75, 4);
        const tpB = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3.5, 16), tpMat);
        tpB.position.set(44, 1.75, 4);
        scene.add(tpA, tpB);
        teleporters.push({ pos: new THREE.Vector3(-44, 1.7, 4), dest: new THREE.Vector3(38, 1.7, 4) });
        teleporters.push({ pos: new THREE.Vector3(44, 1.7, 4), dest: new THREE.Vector3(-38, 1.7, 4) });
    }

    if (mapName === 'ASCENT' || mapName === 'ICEBOX') {
        // Walkable Ramp to A-Heaven Balcony
        addRamp(-44, -34, 4.5, 10, 3.0, -1);

        // Destructible Metal Blast Door at A-Main Chokepoint (400 HP)
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
        const blastDoor = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.5, 0.4), doorMat);
        blastDoor.position.set(-24, 2.25, -14);
        scene.add(blastDoor);
        const doorBox = new THREE.Box3().setFromObject(blastDoor);
        colliders.push(doorBox);
        solidMeshes.push(blastDoor);
        destructibles.push({ mesh: blastDoor, box: doorBox, hp: 400 });
    }

    return { colliders, solidMeshes, penetrableMeshes, buyBarriers, teleporters, floor, ramps, destructibles };
}
export function setupRayTracingSystem(scene, renderer, sun, floor, solidMeshes, penetrableMeshes) {
    const rtMirror = new Reflector(new THREE.PlaneGeometry(100, 110), {
        clipBias: 0.003,
        textureWidth: 1024,
        textureHeight: 1024,
        color: 0x8899aa
    });
    rtMirror.rotation.x = -Math.PI / 2;
    rtMirror.position.y = 0.005;
    rtMirror.visible = false;
    scene.add(rtMirror);

    const bounceLight = new THREE.PointLight(0x38bdf8, 0, 55);
    bounceLight.position.set(0, 6, 0);
    scene.add(bounceLight);

    const toonCache = new Map();
    const pbrCache = new Map();
    function setQuality(quality = 'OFF') {
        const isRT = quality !== 'OFF';
        rtMirror.visible = isRT;
        bounceLight.intensity = isRT ? 1.8 : 0;

        if (isRT) {
            const res = quality === 'HIGH' ? 4096 : (quality === 'MEDIUM' ? 2048 : 1024);
            sun.shadow.mapSize.set(res, res);
            if (sun.shadow.map) {
                sun.shadow.map.dispose();
                sun.shadow.map = null;
            }
            floor.material.transparent = true;
            floor.material.opacity = quality === 'HIGH' ? 0.62 : (quality === 'MEDIUM' ? 0.72 : 0.82);
        } else {
            floor.material.transparent = false;
            floor.material.opacity = 1.0;
        }

        [...solidMeshes, ...penetrableMeshes].forEach(mesh => {
            if (!toonCache.has(mesh)) {
                toonCache.set(mesh, mesh.material);
                pbrCache.set(mesh, new THREE.MeshStandardMaterial({
                    map: mesh.material.map,
                    color: mesh.material.color,
                    roughness: 0.25,
                    metalness: 0.55
                }));
            }
            mesh.material = isRT ? pbrCache.get(mesh) : toonCache.get(mesh);
        });
    }

    function update(playerPos) {
        if (bounceLight.intensity > 0) {
            bounceLight.position.set(playerPos.x, 4.5, playerPos.z);
        }
    }

    return { setQuality, update };
}
