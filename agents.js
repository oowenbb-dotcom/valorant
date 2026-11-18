import * as THREE from 'three';

function createToonGradient() {
    const data = new Uint8Array([
        68, 76, 92, 255,
        130, 140, 158, 255,
        205, 212, 224, 255,
        255, 255, 255, 255
    ]);
    const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
}

const toonGradient = createToonGradient();
const inkOutlineMat = new THREE.MeshBasicMaterial({ color: 0x0b0f17, side: THREE.BackSide });
function addInkOutline(mesh, thickness = 1.07) {
    const hull = new THREE.Mesh(mesh.geometry, inkOutlineMat);
    hull.scale.setScalar(thickness);
    mesh.add(hull);
    return mesh;
}
function createFresnelRimShader(isEnemy) {
    const rimColor = isEnemy ? new THREE.Color(0xff2a3c) : new THREE.Color(0x00ffcc);
    return new THREE.ShaderMaterial({
        uniforms: { uRimColor: { value: rimColor } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPos;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vViewPos = -mvPos.xyz;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            uniform vec3 uRimColor;
            varying vec3 vNormal;
            varying vec3 vViewPos;
            void main() {
                vec3 n = normalize(vNormal);
                vec3 v = normalize(vViewPos);
                float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.6);
                gl_FragColor = vec4(uRimColor, fresnel * 0.72);
            }
        `
    });
}
const AGENT_STYLES = {
    JETT:    { primary: 0xe0f2fe, secondary: 0x0284c7, accent: 0x38bdf8, skin: 0xfde6d8, hair: 0xf8fafc },
    PHOENIX: { primary: 0x1e293b, secondary: 0xf97316, accent: 0xfacc15, skin: 0x6b3e26, hair: 0x111827 },
    REYNA:   { primary: 0x3b0764, secondary: 0x7e22ce, accent: 0xd946ef, skin: 0xc68663, hair: 0x18181b },
    OMEN:    { primary: 0x090d16, secondary: 0x312e81, accent: 0x38bdf8, skin: 0x05080f, hair: 0x090d16 },
    SAGE:    { primary: 0xf8fafc, secondary: 0x059669, accent: 0x2dd4bf, skin: 0xfde6d8, hair: 0x0f172a },
    SOVA:    { primary: 0x1e3a8a, secondary: 0x92400e, accent: 0x38bdf8, skin: 0xfde6d8, hair: 0xfef08a }
};
export function buildAgentCharacter(id, isEnemy = true, agentName = 'JETT') {
    const group = new THREE.Group();
    const style = AGENT_STYLES[agentName] || AGENT_STYLES.JETT;

    const primaryMat = new THREE.MeshToonMaterial({ color: style.primary, gradientMap: toonGradient });
    const secondaryMat = new THREE.MeshToonMaterial({ color: style.secondary, gradientMap: toonGradient });
    const skinMat = new THREE.MeshToonMaterial({ color: style.skin, gradientMap: toonGradient });
    const darkGearMat = new THREE.MeshToonMaterial({ color: 0x0f172a, gradientMap: toonGradient });
    const accentGlowMat = new THREE.MeshBasicMaterial({ color: style.accent });
    // Left & Right Legs (Tagged with isLeg: true for 0.80x Valorant leg damage)
    const legGeo = new THREE.CylinderGeometry(0.11, 0.085, 0.82, 10);
    const lThigh = addInkOutline(new THREE.Mesh(legGeo, darkGearMat));
    lThigh.position.set(-0.15, 0.41, 0);
    lThigh.userData = { isHead: false, isLeg: true, ownerId: id };

    const rThigh = addInkOutline(new THREE.Mesh(legGeo, darkGearMat));
    rThigh.position.set(0.15, 0.41, 0);
    rThigh.userData = { isHead: false, isLeg: true, ownerId: id };

    // Tactical Knee Guards & Sidearm Holster
    const kneeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.14);
    const lKnee = new THREE.Mesh(kneeGeo, secondaryMat);
    lKnee.position.set(0, 0.04, 0.05);
    const rKnee = lKnee.clone();
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.12), secondaryMat);
    holster.position.set(0.11, 0.18, 0);

    lThigh.add(lKnee);
    rThigh.add(rKnee, holster);
    const bootGeo = new THREE.BoxGeometry(0.14, 0.12, 0.24);
    const lBoot = addInkOutline(new THREE.Mesh(bootGeo, secondaryMat));
    lBoot.position.set(0, -0.36, 0.04);
    const rBoot = addInkOutline(new THREE.Mesh(bootGeo, secondaryMat));
    rBoot.position.set(0, -0.36, 0.04);

    lThigh.add(lBoot);
    rThigh.add(rBoot);
    group.add(lThigh, rThigh);
    const torso = addInkOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.64, 12), primaryMat));
    torso.position.set(0, 1.12, 0);
    torso.castShadow = true;
    torso.userData = { isHead: false, isLeg: false, ownerId: id };

    const chestVest = addInkOutline(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.28), secondaryMat));
    chestVest.position.set(0, 0.06, 0.02);
    chestVest.userData = { isHead: false, isLeg: false, ownerId: id };

    const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.30), accentGlowMat);
    chestCore.position.set(0, 0.14, 0.02);

    torso.add(chestVest, chestCore);
    group.add(torso);
    const head = addInkOutline(new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 16), skinMat));
    head.position.set(0, 1.68, 0);
    head.scale.set(0.92, 1.08, 0.96);
    head.castShadow = true;
    head.userData = { isHead: true, isLeg: false, ownerId: id };
    group.add(head);
    if (agentName === 'OMEN') {
        const hood = addInkOutline(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 12), primaryMat));
        hood.position.set(0, 0.08, -0.02);
        hood.rotation.x = -0.18;

        for (let i = -1; i <= 1; i++) {
            const eyeSlit = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.02), accentGlowMat);
            eyeSlit.position.set(i * 0.048, 0.01, 0.175);
            head.add(eyeSlit);
        }
        head.add(hood);
    }
    else if (agentName === 'JETT') {
        const hairMat = new THREE.MeshToonMaterial({ color: style.hair, gradientMap: toonGradient });
        const bun = addInkOutline(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), hairMat));
        bun.position.set(0, 0.14, -0.14);
        const scarf = addInkOutline(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 8, 16), secondaryMat));
        scarf.rotation.x = Math.PI / 2;
        scarf.position.set(0, -0.18, 0);
        head.add(bun, scarf);
    } else if (agentName === 'PHOENIX') {
        const flameHair = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.14, 0.28),
            new THREE.MeshBasicMaterial({ color: 0xf97316 })
        );
        flameHair.position.set(0, 0.16, 0);
        head.add(flameHair);
    }
    else if (agentName === 'SOVA') {
        const hairMat = new THREE.MeshToonMaterial({ color: style.hair, gradientMap: toonGradient });
        const hairCap = addInkOutline(new THREE.Mesh(new THREE.SphereGeometry(0.195, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat));
        const bionicEye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), accentGlowMat);
        bionicEye.position.set(-0.065, 0.02, 0.165);
        head.add(hairCap, bionicEye);
    } else if (agentName === 'SAGE') {
        const hairMat = new THREE.MeshToonMaterial({ color: style.hair, gradientMap: toonGradient });
        const crownBun = addInkOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.16, 10), hairMat));
        crownBun.position.set(0, 0.21, -0.04);
        const jadeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), accentGlowMat);
        jadeOrb.position.set(0.26, -0.45, 0.15);
        head.add(crownBun, jadeOrb);
    } else if (agentName === 'REYNA') {
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.04), accentGlowMat);
        visor.position.set(0, 0.025, 0.165);
        head.add(visor);
    }
    const armGeo = new THREE.CylinderGeometry(0.068, 0.055, 0.56, 10);
    const lArm = addInkOutline(new THREE.Mesh(armGeo, primaryMat));
    lArm.position.set(-0.29, 0.08, 0.14);
    lArm.rotation.x = -0.85;
    lArm.rotation.z = 0.22;

    const rArm = addInkOutline(new THREE.Mesh(armGeo, primaryMat));
    rArm.position.set(0.29, 0.08, 0.18);
    rArm.rotation.x = -1.05;
    rArm.rotation.z = -0.18;

    const gloveGeo = new THREE.BoxGeometry(0.085, 0.085, 0.11);
    const lGlove = new THREE.Mesh(gloveGeo, darkGearMat);
    lGlove.position.set(0, -0.28, 0);
    const rGlove = lGlove.clone();

    lArm.add(lGlove);
    rArm.add(rGlove);
    torso.add(lArm, rArm);
    const worldGun = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.12, 0.72),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.3 })
    );
    worldGun.position.set(0.08, -0.02, 0.38);
    const gunStripe = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.45), accentGlowMat);
    gunStripe.position.set(0, 0.03, 0);
    worldGun.add(gunStripe);
    torso.add(worldGun);
    const rimMat = createFresnelRimShader(isEnemy);
    const torsoRim = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.195, 0.66, 12), rimMat);
    torsoRim.position.copy(torso.position);
    const headRim = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 14), rimMat);
    headRim.position.copy(head.position);
    group.add(torsoRim, headRim);
    const shadowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 16),
        new THREE.MeshBasicMaterial({ color: 0x090d16, transparent: true, opacity: 0.45 })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.01;
    group.add(shadowDisc);

    return {
        group,
        head,
        torso,
        leftLeg: lThigh,
        rightLeg: rThigh,
        leftArm: lArm,
        rightArm: rArm
    };
}
export const AGENT_ROLES = {
    JETT: 'DUELIST',
    PHOENIX: 'DUELIST',
    REYNA: 'DUELIST',
    OMEN: 'CONTROLLER',
    SAGE: 'SENTINEL',
    SOVA: 'INITIATOR'
};

export function getAgentAccentColor(agentName = 'JETT') {
    const style = AGENT_STYLES[agentName] || AGENT_STYLES.JETT;
    return style.accent;
}
export function setAgentOutlineHighlight(characterObj, isHighlighted = false) {
    if (!characterObj || !characterObj.group) return;
    characterObj.group.scale.setScalar(isHighlighted ? 1.02 : 1.0);
}
export function setAgentStance(characterObj, isCrouching = false) {
    if (!characterObj) return;
    characterObj.torso.position.y = isCrouching ? 0.84 : 1.12;
    characterObj.head.position.y = isCrouching ? 1.38 : 1.68;
}
export const AVAILABLE_AGENTS = Object.keys(AGENT_STYLES);
