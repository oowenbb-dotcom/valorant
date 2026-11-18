import * as THREE from 'three';

export const WEAPONS = {
    CLASSIC:     { name: 'CLASSIC',     dmg: 26, head: 78,  rate: 240, mag: 12, auto: false, pitch: 220, sup: false, climb: 0.008, penTier: 1, speed: 0.95, cost: 0 },
    SHERIFF:     { name: 'SHERIFF',     dmg: 55, head: 159, rate: 400, mag: 6,  auto: false, pitch: 130, sup: false, climb: 0.025, penTier: 3, speed: 0.92, cost: 800 },
    STINGER:     { name: 'STINGER',     dmg: 27, head: 67,  rate: 62,  mag: 20, auto: true,  pitch: 290, sup: false, climb: 0.009, penTier: 1, speed: 0.92, cost: 1100 },
    SPECTRE:     { name: 'SPECTRE',     dmg: 22, head: 66,  rate: 85,  mag: 30, auto: true,  pitch: 260, sup: true,  climb: 0.006, penTier: 1, speed: 0.91, cost: 1600 },
    BULLDOG:     { name: 'BULLDOG',     dmg: 35, head: 115, rate: 105, mag: 24, auto: true,  pitch: 175, sup: false, climb: 0.011, penTier: 2, speed: 0.87, cost: 2050 },
    GUARDIAN:    { name: 'GUARDIAN',    dmg: 65, head: 195, rate: 210, mag: 12, auto: false, pitch: 165, sup: false, climb: 0.018, penTier: 3, speed: 0.87, cost: 2250 },
    PHANTOM:     { name: 'PHANTOM',     dmg: 35, head: 140, rate: 95,  mag: 30, auto: true,  pitch: 185, sup: true,  climb: 0.009, penTier: 2, speed: 0.86, cost: 2900 },
    VANDAL:      { name: 'VANDAL',      dmg: 40, head: 160, rate: 110, mag: 25, auto: true,  pitch: 150, sup: false, climb: 0.013, penTier: 2, speed: 0.86, cost: 2900 },
    MARSHAL:     { name: 'MARSHAL',     dmg: 101,head: 202, rate: 750, mag: 5,  auto: false, pitch: 115, sup: false, climb: 0.028, penTier: 2, speed: 0.85, cost: 950 },
    OPERATOR:    { name: 'OPERATOR',    dmg: 150,head: 255, rate: 1200,mag: 5,  auto: false, pitch: 90,  sup: false, climb: 0.045, penTier: 3, speed: 0.76, cost: 4700 },
    KNIFE:       { name: 'KNIFE',       dmg: 75, head: 150, rate: 450, mag: 1,  auto: false, pitch: 420, sup: true,  climb: 0.000, penTier: 1, speed: 1.00, cost: 0 },
    BLADE_STORM: { name: 'BLADE_STORM', dmg: 50, head: 150, rate: 280, mag: 5,  auto: false, pitch: 480, sup: true,  climb: 0.000, penTier: 1, speed: 1.00, cost: 0 }
};
const viewmodelOutlineMat = new THREE.MeshBasicMaterial({ color: 0x0b0f17, side: THREE.BackSide });

function inkOutline(mesh, thickness = 1.06) {
    const hull = new THREE.Mesh(mesh.geometry, viewmodelOutlineMat);
    hull.scale.setScalar(thickness);
    mesh.add(hull);
    return mesh;
}

const SLEEVE_COLORS = {
    JETT: 0x38bdf8,
    PHOENIX: 0xf97316,
    REYNA: 0x7e22ce,
    OMEN: 0x4338ca,
    SAGE: 0x10b981,
    SOVA: 0x1d4ed8
};
const SKIN_THEMES = {
    STANDARD:  { body: 0x1e293b, trim: 0x0f172a, accent: 0x00ffcc, emissive: 0x003322 },
    PRIME:     { body: 0xf8fafc, trim: 0xfacc15, accent: 0x38bdf8, emissive: 0x0284c7 },
    REAVER:    { body: 0x110c1d, trim: 0x4c1d95, accent: 0xa855f7, emissive: 0x6b21a8 },
    GLITCHPOP: { body: 0xec4899, trim: 0xfacc15, accent: 0x22d3ee, emissive: 0xbe185d }
};
function attachFirstPersonHands(group, agentName, isPistol = false) {
    const sleeveMat = new THREE.MeshToonMaterial({ color: SLEEVE_COLORS[agentName] || 0x38bdf8 });
    const gloveMat = new THREE.MeshToonMaterial({ color: 0x0f172a });

    const rightArm = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.34), sleeveMat));
    rightArm.position.set(0.04, -0.09, 0.24);
    rightArm.rotation.x = 0.28;
    rightArm.rotation.y = -0.15;

    const rightHand = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.075), gloveMat));
    rightHand.position.set(0, -0.045, 0.05);

    const leftArm = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.36), sleeveMat));
    leftArm.position.set(isPistol ? -0.04 : -0.09, -0.085, isPistol ? 0.21 : 0.08);
    leftArm.rotation.x = 0.25;
    leftArm.rotation.y = isPistol ? 0.25 : 0.42;

    const leftHand = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.07), gloveMat));
    leftHand.position.set(isPistol ? -0.01 : -0.01, -0.035, isPistol ? 0.04 : -0.14);

    group.add(rightArm, rightHand, leftArm, leftHand);
}
function attachGunBuddy(group, accentHex) {
    const buddyPivot = new THREE.Group();
    buddyPivot.position.set(-0.026, 0.005, -0.06);

    const strap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.002, 0.002, 0.025, 6),
        new THREE.MeshBasicMaterial({ color: 0x0f172a })
    );
    strap.position.y = -0.012;

    const charm = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.016, 0),
        new THREE.MeshBasicMaterial({ color: accentHex })
    );
    charm.position.y = -0.032;

    buddyPivot.add(strap, charm);
    group.add(buddyPivot);
    group.userData.gunBuddy = buddyPivot;
}
export function buildWeaponMesh(weaponName = 'VANDAL', agentName = 'JETT', skinName = 'STANDARD') {
    const group = new THREE.Group();
    const theme = SKIN_THEMES[skinName] || SKIN_THEMES.STANDARD;

    const bodyMat = new THREE.MeshStandardMaterial({
        color: theme.body,
        roughness: 0.35,
        metalness: 0.55
    });
    const darkTrim = new THREE.MeshStandardMaterial({
        color: theme.trim,
        roughness: 0.5,
        metalness: 0.7
    });
    const accentGlow = new THREE.MeshStandardMaterial({
        color: theme.accent,
        emissive: theme.emissive,
        emissiveIntensity: 1.4
    });

    const isPistol = weaponName === 'CLASSIC' || weaponName === 'SHERIFF';
    attachFirstPersonHands(group, agentName, isPistol);
    if (weaponName === 'BLADE_STORM') {
        const bladeMat = new THREE.MeshStandardMaterial({
            color: 0xe0f2fe,
            emissive: 0x38bdf8,
            emissiveIntensity: 1.2,
            metalness: 0.8
        });

        for (let i = -2; i <= 2; i++) {
            const kunai = inkOutline(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.16, 4), bladeMat));
            kunai.rotation.x = -Math.PI / 2;
            kunai.position.set(i * 0.045, 0.03 - Math.abs(i) * 0.012, -0.18 - Math.abs(i) * 0.02);
            kunai.rotation.z = i * 0.14;
            group.add(kunai);
        }
        return group;
    }
    if (isPistol) {
        const frame = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.21), bodyMat));
        frame.position.set(0, 0.01, -0.06);

        const upperSlide = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.026, 0.22), darkTrim));
        upperSlide.position.set(0, 0.034, -0.065);
        group.userData.slideMesh = upperSlide;

        const grip = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.045), darkTrim));
        grip.position.set(0, -0.05, 0.02);
        grip.rotation.x = 0.24;

        const magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.09, 0.034), accentGlow);
        magMesh.position.set(0, -0.055, 0.022);
        magMesh.rotation.x = 0.24;
        group.userData.magMesh = magMesh;
        group.userData.magBaseY = -0.055;
        group.userData.magBaseX = 0;

        if (weaponName === 'SHERIFF') {
            const cylinder = inkOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.055, 10), darkTrim));
            cylinder.rotation.x = Math.PI / 2;
            cylinder.position.set(0, 0.018, -0.05);
            group.add(cylinder);
        }

        group.add(frame, upperSlide, grip, magMesh);
        attachGunBuddy(group, theme.accent);
    }
    if (!isPistol) {
        const isSniper = weaponName === 'OPERATOR' || weaponName === 'MARSHAL';
        const isSMG = weaponName === 'SPECTRE' || weaponName === 'STINGER';

        const receiverLen = isSniper ? 0.44 : (isSMG ? 0.28 : 0.36);
        const receiver = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.068, receiverLen), bodyMat));
        receiver.position.set(0, 0.012, -0.10);

        const stock = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.075, 0.22), darkTrim));
        stock.position.set(0, -0.005, 0.16);

        const grip = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.11, 0.044), darkTrim));
        grip.position.set(0, -0.055, 0.04);
        grip.rotation.x = 0.26;

        const magCurve = weaponName === 'VANDAL' ? -0.25 : (isSniper ? 0 : -0.1);
        const magH = isSniper ? 0.06 : 0.14;
        const magMesh = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.028, magH, 0.052), darkTrim));
        magMesh.position.set(0, -0.065, -0.12);
        magMesh.rotation.x = magCurve;

        group.userData.magMesh = magMesh;
        group.userData.magBaseY = -0.065;
        group.userData.magBaseX = 0;

        group.add(receiver, stock, grip, magMesh);
        attachGunBuddy(group, theme.accent);
        const barrelLen = isSniper ? 0.56 : (isSMG ? 0.24 : 0.34);
        const barrelRadius = weaponName === 'PHANTOM' || weaponName === 'SPECTRE' ? 0.022 : 0.012;
        const barrel = inkOutline(new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius, barrelRadius, barrelLen, 10), darkTrim));
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.016, -0.10 - receiverLen / 2 - barrelLen / 2);

        const accentCore = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.016, receiverLen * 0.72), accentGlow);
        accentCore.position.set(0, 0.024, -0.10);
        group.userData.accentCore = accentCore;

        group.add(barrel, accentCore);
        if (isSniper) {
            const scopeTube = inkOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.28, 12), darkTrim));
            scopeTube.rotation.x = Math.PI / 2;
            scopeTube.position.set(0, 0.068, -0.08);

            const frontLens = new THREE.Mesh(
                new THREE.CircleGeometry(0.022, 12),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
            );
            frontLens.position.set(0, 0.068, -0.221);
            frontLens.rotation.y = Math.PI;
            group.add(scopeTube, frontLens);
        } else {
            const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.012, 0.072), darkTrim);
            sightBase.position.set(0, 0.046, -0.06);

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.036, 0.055), darkTrim);
            leftWall.position.set(-0.02, 0.064, -0.06);
            const rightWall = leftWall.clone();
            rightWall.position.x = 0.02;
            const topHood = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.005, 0.055), darkTrim);
            topHood.position.set(0, 0.082, -0.06);

            const glassLens = new THREE.Mesh(
                new THREE.PlaneGeometry(0.036, 0.032),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
            );
            glassLens.position.set(0, 0.064, -0.06);

            const holoDot = new THREE.Mesh(
                new THREE.SphereGeometry(0.0028, 6, 6),
                new THREE.MeshBasicMaterial({ color: 0xff4655 })
            );
            holoDot.position.set(0, 0.064, -0.061);

            const holoRing = new THREE.Mesh(
                new THREE.RingGeometry(0.007, 0.009, 16),
                new THREE.MeshBasicMaterial({ color: 0xff4655, side: THREE.DoubleSide })
            );
            holoRing.position.set(0, 0.064, -0.061);

            group.add(sightBase, leftWall, rightWall, topHood, glassLens, holoDot, holoRing);
        }
    }
    const muzzleGroup = new THREE.Group();
    const flashColor = skinName === 'PRIME' ? 0x38bdf8
                     : skinName === 'REAVER' ? 0xa855f7
                     : skinName === 'GLITCHPOP' ? 0xec4899
                     : 0xfef08a;

    const flashMat = new THREE.MeshBasicMaterial({
        color: flashColor,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide
    });

    for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 4), flashMat);
        fin.rotation.x = -Math.PI / 2;
        fin.rotation.z = (i * Math.PI) / 3;
        fin.position.z = -0.09;
        muzzleGroup.add(fin);
    }
    const coreGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    muzzleGroup.add(coreGlow);

    const muzzleZ = (weaponName === 'OPERATOR' || weaponName === 'MARSHAL') ? -0.95
                  : isPistol ? -0.22
                  : -0.68;
    muzzleGroup.position.set(0, 0.016, muzzleZ);
    muzzleGroup.visible = false;
    group.add(muzzleGroup);
    group.userData.muzzleFlashMesh = muzzleGroup;

    return group;
}
export function buildKnifeMesh(skinName = 'STANDARD') {
    const group = new THREE.Group();
    const theme = SKIN_THEMES[skinName] || SKIN_THEMES.STANDARD;

    const handleMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.4,
        metalness: 0.6
    });
    const bladeMat = new THREE.MeshStandardMaterial({
        color: theme.accent,
        emissive: theme.emissive,
        emissiveIntensity: 1.3,
        metalness: 0.85,
        roughness: 0.2
    });

    const grip = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.11, 0.036), handleMat));
    grip.rotation.x = 0.35;
    group.add(grip);
    const fingerRing = inkOutline(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 16), bladeMat));
    fingerRing.position.set(0, -0.068, 0.022);
    fingerRing.rotation.y = Math.PI / 2;

    const lowerBlade = inkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.075, 0.028), bladeMat));
    lowerBlade.position.set(0, 0.068, -0.028);
    lowerBlade.rotation.x = -0.45;

    const upperTip = inkOutline(new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.085, 4), bladeMat));
    upperTip.position.set(0, 0.115, -0.068);
    upperTip.rotation.x = -1.05;

    group.add(fingerRing, lowerBlade, upperTip);
    return group;
}
    return group;
}

export function getWeaponCategory(weaponName) {
    if (weaponName === 'CLASSIC' || weaponName === 'SHERIFF') return 'SIDEARM';
    if (weaponName === 'STINGER' || weaponName === 'SPECTRE') return 'SMG';
    if (weaponName === 'MARSHAL' || weaponName === 'OPERATOR') return 'SNIPER';
    if (weaponName === 'KNIFE' || weaponName === 'BLADE_STORM') return 'MELEE';
    return 'RIFLE';
}
export function getPenetrationLabel(penTier) {
    if (penTier === 3) return 'HIGH PENETRATION';
    if (penTier === 2) return 'MEDIUM PENETRATION';
    return 'LOW PENETRATION';
}

export function getFalloffProfile(weaponName) {
    const shortRange = ['CLASSIC', 'STINGER', 'SPECTRE', 'PHANTOM'];
    if (shortRange.includes(weaponName)) {
        return { near: 1.0, mid: 0.88, far: 0.78 };
    }
    return { near: 1.0, mid: 1.0, far: 1.0 };
}
export function getSkinAccentHex(skinName = 'STANDARD') {
    const theme = SKIN_THEMES[skinName] || SKIN_THEMES.STANDARD;
    return theme.accent;
}

export function getSkinEmissiveHex(skinName = 'STANDARD') {
    const theme = SKIN_THEMES[skinName] || SKIN_THEMES.STANDARD;
    return theme.emissive;
}
export function updateWeaponSkinVFX(gunMesh, ammo, maxMag, now) {
    if (!gunMesh || !gunMesh.userData.accentCore) return;
    const core = gunMesh.userData.accentCore;
    const ammoRatio = Math.max(0.1, ammo / Math.max(1, maxMag));
    const pulseSpeed = ammoRatio < 0.25 ? 0.025 : 0.006;
    core.material.emissiveIntensity = 1.0 + Math.sin(now * pulseSpeed) * 0.45;
}
export const BUYABLE_WEAPONS = Object.values(WEAPONS).filter(
    w => w.name !== 'KNIFE' && w.name !== 'BLADE_STORM'
);
