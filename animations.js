import * as THREE from 'three';

export const ACTIVE_SMOKES = [];
export const ACTIVE_SLOW_ZONES = [];

const ACTIVE_PROJECTILES = [];
const SPARK_PARTICLES = [];
const SKIN_FINISHERS = [];
const SHELL_CASINGS = [];
const SMOKE_SHADERS = [];
function createValorantSmokeMaterial(coreHex, rimHex) {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uCoreColor: { value: new THREE.Color(coreHex) },
            uRimColor: { value: new THREE.Color(rimHex) }
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vLocalPos;
            uniform float uTime;
            void main() {
                vLocalPos = position;
                float wave = sin(position.x * 3.0 + uTime * 2.5) * cos(position.y * 3.0 + uTime * 2.0) * 0.08;
                vec3 displaced = position + normal * wave;
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
                vViewPosition = -mvPos.xyz;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            uniform vec3 uCoreColor;
            uniform vec3 uRimColor;
            uniform float uTime;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vLocalPos;
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 1.8);
                float swirl = 0.5 + 0.5 * sin(vLocalPos.y * 4.0 - uTime * 3.0 + sin(vLocalPos.x * 3.0));
                vec3 col = mix(uCoreColor, uRimColor, fresnel * 0.75 + swirl * 0.2);
                gl_FragColor = vec4(col, 0.94);
            }
        `
    });
    SMOKE_SHADERS.push(mat);
    return mat;
}
export function buildAnimatedSky(scene) {
    const clouds = [];
    const cloudGeo = new THREE.PlaneGeometry(28, 12);
    const cloudMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide
    });
    for (let i = 0; i < 18; i++) {
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.position.set((Math.random() - 0.5) * 220, 36 + Math.random() * 14, (Math.random() - 0.5) * 220);
        cloud.rotation.x = Math.PI / 2;
        cloud.rotation.z = Math.random() * Math.PI;
        scene.add(cloud);
        clouds.push({ mesh: cloud, speed: 1.2 + Math.random() * 1.4 });
    }
    return clouds;
}

export function buildFirstPersonAbilityHand(agentName = 'JETT') {
    const holder = new THREE.Group();
    const sleeveColors = {
        JETT: 0x38bdf8, PHOENIX: 0xf97316, REYNA: 0x7e22ce,
        OMEN: 0x4338ca, SAGE: 0x10b981, SOVA: 0x1d4ed8
    };
    const orbColors = {
        JETT: 0xe0f2fe, PHOENIX: 0xfb923c, REYNA: 0xd946ef,
        OMEN: 0xa855f7, SAGE: 0x2dd4bf, SOVA: 0x38bdf8
    };

    const sleeveMat = new THREE.MeshToonMaterial({ color: sleeveColors[agentName] || 0x38bdf8 });
    const gloveMat = new THREE.MeshToonMaterial({ color: 0x111827 });
    const orbMat = new THREE.MeshBasicMaterial({ color: orbColors[agentName] || 0x00ffcc });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.38), sleeveMat);
    arm.position.set(0, -0.04, 0.22);
    arm.rotation.x = 0.2;

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.055, 0.09), gloveMat);
    hand.position.set(0, 0, 0.02);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 14), orbMat);
    orb.position.set(0, 0.065, -0.02);

    const auraRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 20), ringMat);
    auraRing.position.copy(orb.position);

    holder.add(arm, hand, orb, auraRing);
    holder.position.set(-0.22, -0.45, -0.38);
    holder.visible = false;
    holder.userData = { orb, auraRing };
    return holder;
}
export function buildSpikeViewmodel() {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.09, 0.28, 8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x440011 })
    );
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.085, 0.012, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0xff4655 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(core, ring);
    group.position.set(0, -0.22, -0.42);
    group.visible = false;
    group.userData = { ring };
    return group;
}

export function spawnSignatureFinisher(scene, skinName, victimPos, victimGroup) {
    if (skinName === 'REAVER') {
        const portal = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 1.8, 24),
            new THREE.MeshBasicMaterial({ color: 0xa855f7, side: THREE.DoubleSide })
        );
        portal.rotation.x = -Math.PI / 2;
        portal.position.set(victimPos.x, 0.05, victimPos.z);
        scene.add(portal);
        SKIN_FINISHERS.push({ type: 'REAVER', mesh: portal, victimGroup, age: 0, duration: 2.2, scene });
    } else if (skinName === 'PRIME') {
        const cage = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 1.1, 3.2, 8, 1, true),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true })
        );
        cage.position.set(victimPos.x, 1.6, victimPos.z);
        scene.add(cage);
        SKIN_FINISHERS.push({ type: 'PRIME', mesh: cage, victimGroup, age: 0, duration: 2.2, scene });
    } else if (skinName === 'GLITCHPOP') {
        const holo = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.4, 1),
            new THREE.MeshBasicMaterial({ color: 0xec4899, wireframe: true })
        );
        holo.position.set(victimPos.x, 1.5, victimPos.z);
        scene.add(holo);
        SKIN_FINISHERS.push({ type: 'GLITCHPOP', mesh: holo, victimGroup, age: 0, duration: 2.0, scene });
    }
}

export function spawnHeadshotSparks(scene, hitPos) {
    for (let i = 0; i < 10; i++) {
        const spark = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.05, 0.05),
            new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xfacc15 : 0xff4655 })
        );
        spark.position.copy(hitPos);
        const vel = new THREE.Vector3((Math.random() - 0.5) * 9, 1.5 + Math.random() * 5, (Math.random() - 0.5) * 9);
        scene.add(spark);
        SPARK_PARTICLES.push({ mesh: spark, vel, life: 0.35, scene });
    }
}

export function spawnShellCasing(scene, camera) {
    const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.032, 6),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 })
    );
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    shell.position.copy(camera.position).addScaledVector(right, 0.28).addScaledVector(fwd, 0.45).add(new THREE.Vector3(0, -0.15, 0));
    const vel = right.multiplyScalar(2.4 + Math.random() * 1.2).add(new THREE.Vector3(0, 2.2 + Math.random(), 0));
    scene.add(shell);
    SHELL_CASINGS.push({ mesh: shell, vel, life: 1.1, scene });
}
export function launchAbilityProjectile(type, startPos, direction, scene, colliders, onImpactFn) {
    if (type === 'SMOKE' || type === 'DARK_SMOKE') {
        const isDark = type === 'DARK_SMOKE';
        const smokeMat = isDark
            ? createValorantSmokeMaterial(0x090d16, 0x6366f1)
            : createValorantSmokeMaterial(0x94a3b8, 0x38bdf8);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(4.3, 24, 24), smokeMat);
        dome.position.set(startPos.x + direction.x * 6, 2.4, startPos.z + direction.z * 6);
        scene.add(dome);

        const smokeEntry = { mesh: dome, pos: dome.position.clone(), radius: 4.3, isDark };
        ACTIVE_SMOKES.push(smokeEntry);
        setTimeout(() => {
            scene.remove(dome);
            const idx = ACTIVE_SMOKES.indexOf(smokeEntry);
            if (idx > -1) ACTIVE_SMOKES.splice(idx, 1);
        }, 10000);
    } else if (type === 'FLASH' || type === 'LEER') {
        const flashOrb = new THREE.Mesh(
            new THREE.SphereGeometry(type === 'LEER' ? 0.38 : 0.24, 14, 14),
            new THREE.MeshBasicMaterial({ color: type === 'LEER' ? 0xd946ef : 0xfacc15, wireframe: type === 'LEER' })
        );
        flashOrb.position.copy(startPos);
        scene.add(flashOrb);
        ACTIVE_PROJECTILES.push({ kind: type, mesh: flashOrb, vel: direction.clone().multiplyScalar(type === 'LEER' ? 18 : 24), life: type === 'LEER' ? 2.5 : 0.45, scene, onImpactFn });
    } else if (type === 'RECON' || type === 'SHOCK') {
        const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.75, 8), new THREE.MeshBasicMaterial({ color: type === 'RECON' ? 0x00ffcc : 0x38bdf8 }));
        arrow.rotation.x = Math.PI / 2;
        arrow.position.copy(startPos);
        scene.add(arrow);
        ACTIVE_PROJECTILES.push({ kind: type, mesh: arrow, vel: direction.clone().multiplyScalar(36), bouncesLeft: 2, life: 0.85, scene, onImpactFn });
    } else if (type === 'MOLLY') {
        const fireOrb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
        fireOrb.position.copy(startPos);
        scene.add(fireOrb);
        const vel = direction.clone().multiplyScalar(22);
        vel.y += 4.0;
        ACTIVE_PROJECTILES.push({ kind: 'MOLLY', mesh: fireOrb, vel, life: 0.75, scene, onImpactFn });
    } else if (type === 'SLOW_ORB') {
        const jadeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshBasicMaterial({ color: 0x2dd4bf }));
        jadeOrb.position.copy(startPos);
        scene.add(jadeOrb);
        const vel = direction.clone().multiplyScalar(25);
        vel.y += 3.5;
        ACTIVE_PROJECTILES.push({ kind: 'SLOW_ORB', mesh: jadeOrb, vel, life: 0.8, scene });
    } else if (type === 'WALL') {
        const targetPos = startPos.clone().addScaledVector(direction, 8);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 1), new THREE.MeshToonMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.9 }));
        wall.position.set(targetPos.x, -1.6, targetPos.z);
        scene.add(wall);
        const box = new THREE.Box3().setFromObject(wall);
        colliders.push(box);
        ACTIVE_PROJECTILES.push({ kind: 'WALL', mesh: wall, box, riseTimer: 0.4, life: 10.0, scene, colliders });
    }
}
export function updateWorldAnimations(skyClouds, ultOrbs, spikeMesh, delta, now) {
    const timeSec = now * 0.001;
    SMOKE_SHADERS.forEach(mat => {
        if (mat.uniforms && mat.uniforms.uTime) mat.uniforms.uTime.value = timeSec;
    });

    if (skyClouds) {
        skyClouds.forEach(c => {
            c.mesh.position.x += c.speed * delta;
            if (c.mesh.position.x > 110) c.mesh.position.x = -110;
        });
    }

    if (ultOrbs) {
        ultOrbs.forEach(o => {
            if (o.active) {
                o.mesh.rotation.y += 2.2 * delta;
                o.mesh.position.y = 1.15 + Math.sin(timeSec * 3.5) * 0.14;
            }
        });
    }

    if (spikeMesh && spikeMesh.visible) {
        spikeMesh.rotation.y += 3.0 * delta;
    }
    for (let i = ACTIVE_PROJECTILES.length - 1; i >= 0; i--) {
        const p = ACTIVE_PROJECTILES[i];
        p.life -= delta;

        if (p.kind === 'FLASH' || p.kind === 'LEER') {
            p.mesh.position.addScaledVector(p.vel, delta);
            p.mesh.rotation.y += 8 * delta;
            if (p.life <= 0) {
                p.scene.remove(p.mesh);
                if (p.onImpactFn) p.onImpactFn();
                ACTIVE_PROJECTILES.splice(i, 1);
            }
        } else if (p.kind === 'RECON' || p.kind === 'SHOCK') {
            p.mesh.position.addScaledVector(p.vel, delta);
            if (Math.abs(p.mesh.position.x) > 47 && p.bouncesLeft > 0) {
                p.vel.x *= -1;
                p.bouncesLeft--;
            }
            if (p.life <= 0) {
                const pos = p.mesh.position.clone();
                p.scene.remove(p.mesh);
                if (p.onImpactFn) p.onImpactFn(pos);
                ACTIVE_PROJECTILES.splice(i, 1);
            }
        } else if (p.kind === 'MOLLY') {
            p.vel.y -= 18 * delta;
            p.mesh.position.addScaledVector(p.vel, delta);
            if (p.mesh.position.y <= 0.2 || p.life <= 0) {
                const pos = p.mesh.position.clone();
                p.scene.remove(p.mesh);
                const pool = new THREE.Mesh(
                    new THREE.CylinderGeometry(3.8, 3.8, 0.08, 20),
                    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.72 })
                );
                pool.position.set(pos.x, 0.04, pos.z);
                p.scene.add(pool);
                if (p.onImpactFn) p.onImpactFn(pool);
                ACTIVE_PROJECTILES.splice(i, 1);
            }
        } else if (p.kind === 'SLOW_ORB') {
            p.vel.y -= 18 * delta;
            p.mesh.position.addScaledVector(p.vel, delta);
            if (p.mesh.position.y <= 0.2 || p.life <= 0) {
                const pos = p.mesh.position.clone();
                p.scene.remove(p.mesh);
                const iceField = new THREE.Mesh(
                    new THREE.CylinderGeometry(4.4, 4.4, 0.08, 24),
                    new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.55 })
                );
                iceField.position.set(pos.x, 0.04, pos.z);
                p.scene.add(iceField);
                const zone = { mesh: iceField, pos: new THREE.Vector3(pos.x, 0, pos.z), radius: 4.4 };
                ACTIVE_SLOW_ZONES.push(zone);
                setTimeout(() => {
                    p.scene.remove(iceField);
                    const idx = ACTIVE_SLOW_ZONES.indexOf(zone);
                    if (idx > -1) ACTIVE_SLOW_ZONES.splice(idx, 1);
                }, 7000);
                ACTIVE_PROJECTILES.splice(i, 1);
            }
        } else if (p.kind === 'WALL') {
            if (p.riseTimer > 0) {
                p.riseTimer -= delta;
                p.mesh.position.y = THREE.MathUtils.lerp(p.mesh.position.y, 1.6, delta * 14);
                p.box.setFromObject(p.mesh);
            }
            if (p.life <= 0) {
                p.scene.remove(p.mesh);
                const cIdx = p.colliders.indexOf(p.box);
                if (cIdx > -1) p.colliders.splice(cIdx, 1);
                ACTIVE_PROJECTILES.splice(i, 1);
            }
        }
    }
    for (let i = SPARK_PARTICLES.length - 1; i >= 0; i--) {
        const sp = SPARK_PARTICLES[i];
        sp.life -= delta;
        sp.vel.y -= 18 * delta;
        sp.mesh.position.addScaledVector(sp.vel, delta);
        if (sp.life <= 0) {
            sp.scene.remove(sp.mesh);
            SPARK_PARTICLES.splice(i, 1);
        }
    }

    for (let i = SHELL_CASINGS.length - 1; i >= 0; i--) {
        const sc = SHELL_CASINGS[i];
        sc.life -= delta;
        sc.vel.y -= 16 * delta;
        sc.mesh.position.addScaledVector(sc.vel, delta);
        sc.mesh.rotation.x += 18 * delta;
        sc.mesh.rotation.z += 14 * delta;
        if (sc.mesh.position.y <= 0.05) {
            sc.mesh.position.y = 0.05;
            sc.vel.y = Math.abs(sc.vel.y) * 0.4;
        }
        if (sc.life <= 0) {
            sc.scene.remove(sc.mesh);
            SHELL_CASINGS.splice(i, 1);
        }
    }

    for (let i = SKIN_FINISHERS.length - 1; i >= 0; i--) {
        const fin = SKIN_FINISHERS[i];
        fin.age += delta;
        fin.mesh.rotation.y += 4 * delta;
        if (fin.victimGroup) {
            fin.victimGroup.position.y += (fin.type === 'REAVER' ? -1.4 : 1.6) * delta;
            fin.victimGroup.rotation.y += 5 * delta;
        }
        if (fin.age >= fin.duration) {
            fin.scene.remove(fin.mesh);
            if (fin.victimGroup) fin.victimGroup.visible = false;
            SKIN_FINISHERS.splice(i, 1);
        }
    }
}
export function updateViewmodelAnimations(animState, viewmodelHolder, knifeModel, abilityHandHolder, spikeHandHolder, activeGunMesh, delta, now, moveSpeed, isADS, isCrouching) {
    const timeSec = now * 0.001;

    if (spikeHandHolder) {
        spikeHandHolder.visible = Boolean(animState.isPlantingOrDefusing);
        if (spikeHandHolder.visible) {
            viewmodelHolder.visible = false;
            knifeModel.visible = false;
            spikeHandHolder.userData.ring.rotation.z += delta * (animState.isDefusing ? -10 : 8);
            return;
        }
    }

    if (abilityHandHolder) {
        abilityHandHolder.visible = animState.abilityCastTimer > 0;
        if (abilityHandHolder.visible) {
            abilityHandHolder.position.y = THREE.MathUtils.lerp(abilityHandHolder.position.y, -0.18, delta * 18);
            abilityHandHolder.userData.auraRing.rotation.z += delta * 12;
        } else {
            abilityHandHolder.position.y = -0.45;
        }
    }

    if (animState.equippedSlot === 'KNIFE') {
        knifeModel.visible = true;
        if (animState.knifeSwingTimer > 0) {
            const p = 1 - (animState.knifeSwingTimer / 0.32);
            knifeModel.rotation.z = Math.sin(p * Math.PI) * 1.4;
            knifeModel.position.z = -0.35 - Math.sin(p * Math.PI) * 0.22;
        } else {
            knifeModel.rotation.z = THREE.MathUtils.lerp(knifeModel.rotation.z, 0, delta * 12);
            knifeModel.position.z = THREE.MathUtils.lerp(knifeModel.position.z, -0.35, delta * 12);
        }
        return;
    }

    const targetX = isADS ? 0 : 0.25;
    const targetY = isADS ? -0.064 : (isCrouching ? -0.25 : -0.22);
    const targetZ = isADS ? -0.30 : -0.42;

    const bobAmp = isADS ? 0.0015 : 0.008;
    const walkBobY = moveSpeed > 1.5 ? Math.sin(timeSec * 11) * bobAmp : Math.sin(timeSec * 2.2) * 0.002;
    const walkBobX = moveSpeed > 1.5 ? Math.cos(timeSec * 5.5) * bobAmp : 0;

    viewmodelHolder.position.x = THREE.MathUtils.lerp(viewmodelHolder.position.x, targetX + walkBobX - (animState.mouseDeltaX || 0) * 0.0004, delta * 16);
    viewmodelHolder.position.y = THREE.MathUtils.lerp(viewmodelHolder.position.y, targetY + walkBobY - (animState.landDip || 0), delta * 16);
    viewmodelHolder.position.z = THREE.MathUtils.lerp(viewmodelHolder.position.z, targetZ, delta * 16);

    const mag = activeGunMesh?.userData?.magMesh;
    if (animState.isReloading && animState.reloadTimer > 0) {
        const progress = 1 - (animState.reloadTimer / animState.reloadDuration);
        const tiltCurve = Math.sin(progress * Math.PI);

        if (animState.skinName === 'REAVER' && mag) {
            viewmodelHolder.rotation.z = tiltCurve * 0.35;
            viewmodelHolder.position.y = targetY + tiltCurve * 0.06;
            mag.position.y = (activeGunMesh.userData.magBaseY || -0.065) - tiltCurve * 0.26;
            mag.rotation.y = progress * Math.PI * 6;
            return;
        }

        viewmodelHolder.rotation.z = tiltCurve * 0.55;
        if (mag) {
            mag.position.y = (activeGunMesh.userData.magBaseY || -0.065) - tiltCurve * 0.22;
        }
    } else {
        viewmodelHolder.rotation.z = THREE.MathUtils.lerp(viewmodelHolder.rotation.z, -(animState.strafeDir || 0) * 0.04, delta * 12);
        if (mag) {
            mag.position.y = THREE.MathUtils.lerp(mag.position.y, activeGunMesh.userData.magBaseY || -0.065, delta * 16);
            mag.rotation.y = 0;
        }
    }

    if (activeGunMesh?.userData?.gunBuddy) {
        activeGunMesh.userData.gunBuddy.rotation.z = Math.sin(timeSec * 6) * (moveSpeed > 1 ? 0.35 : 0.08);
    }
}
export function updateThirdPersonPose(bot, delta, now, isMoving) {
    if (!bot || !bot.alive) return;
    const t = now * 0.008;
    if (isMoving) {
        bot.leftLeg.rotation.x = Math.sin(t) * 0.55;
        bot.rightLeg.rotation.x = -Math.sin(t) * 0.55;
        bot.torso.position.y = 1.12 + Math.abs(Math.sin(t)) * 0.04;
    } else {
        bot.leftLeg.rotation.x = THREE.MathUtils.lerp(bot.leftLeg.rotation.x, 0, delta * 10);
        bot.rightLeg.rotation.x = THREE.MathUtils.lerp(bot.rightLeg.rotation.x, 0, delta * 10);
    }
}

export function animateCharacterDeath(victimGroup) {
    if (!victimGroup) return;
    let progress = 0;
    const fallInterval = setInterval(() => {
        progress += 0.08;
        victimGroup.rotation.x = -progress * (Math.PI / 2);
        victimGroup.position.y = Math.max(0.2, 1.0 - progress * 0.8);
        if (progress >= 1) {
            clearInterval(fallInterval);
            setTimeout(() => { victimGroup.visible = false; victimGroup.rotation.x = 0; }, 1200);
        }
    }, 24);
}
