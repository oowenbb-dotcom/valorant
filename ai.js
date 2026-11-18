import * as THREE from 'three';
import { ACTIVE_SMOKES, launchAbilityProjectile } from './animations.js';
import { playBulletWhiz, playSpatialFootstep, playSpatialGunshot } from './audio.js';

const losRay = new THREE.Raycaster();

const MAP_WAYPOINTS = {
    ATK_A:   [new THREE.Vector3(-34, 0, 26), new THREE.Vector3(-34, 0, 4), new THREE.Vector3(-34, 0, -14), new THREE.Vector3(-34, 0, -26)],
    ATK_B:   [new THREE.Vector3(34, 0, 26),  new THREE.Vector3(34, 0, 4),  new THREE.Vector3(34, 0, -14),  new THREE.Vector3(34, 0, -26)],
    ATK_C:   [new THREE.Vector3(0, 0, 26),   new THREE.Vector3(0, 0, 4),   new THREE.Vector3(0, 0, -14),   new THREE.Vector3(0, 0, -28)],
    ATK_MID: [new THREE.Vector3(0, 0, 26),   new THREE.Vector3(0, 0, 6),   new THREE.Vector3(0, 0, -14),   new THREE.Vector3(-22, 0, -26)],
    DEF_A:   [new THREE.Vector3(-34, 0, -36), new THREE.Vector3(-30, 0, -24)],
    DEF_B:   [new THREE.Vector3(34, 0, -36),  new THREE.Vector3(30, 0, -24)],
    DEF_C:   [new THREE.Vector3(0, 0, -36),   new THREE.Vector3(0, 0, -26)]
};
function isBlockedBySmoke(startPos, endPos) {
    const line = new THREE.Line3(startPos, endPos);
    const closestPt = new THREE.Vector3();
    for (const s of ACTIVE_SMOKES) {
        line.closestPointToPoint(s.pos, true, closestPt);
        if (closestPt.distanceTo(s.pos) < s.radius) return true;
    }
    return false;
}
export function getRankDifficultyProfile(mode, rankIdx = 9, placementsPlayed = 0) {
    if (mode !== 'COMPETITIVE') {
        return {
            label: 'STANDARD',
            reactionTime: 0.52,
            shootInterval: 1.30,
            hitChance: 0.32,
            headshotChance: 0.08,
            moveSpeed: 4.3,
            counterStrafe: false,
            useUtility: false
        };
    }

    const effectiveRank = placementsPlayed < 5 ? 8 : rankIdx;
    const t = Math.min(1, Math.max(0, effectiveRank / 24));

    return {
        label: effectiveRank >= 21 ? 'RADIANT' : effectiveRank >= 15 ? 'ASCENDANT+' : effectiveRank >= 9 ? 'GOLD/PLAT' : 'IRON/SILVER',
        reactionTime: Number((0.60 - t * 0.47).toFixed(2)),
        shootInterval: Number((1.40 - t * 0.95).toFixed(2)),
        hitChance: Number((0.28 + t * 0.44).toFixed(2)),
        headshotChance: Number((0.06 + t * 0.36).toFixed(2)),
        moveSpeed: Number((4.2 + t * 1.3).toFixed(2)),
        counterStrafe: effectiveRank >= 9,
        useUtility: effectiveRank >= 9
    };
}
export function updateTacticalBots(bots, delta, now, camera, state, mapData, spawnTracer, takeDamage, plantSpikeFn, defuseSpikeFn, spikePos, scene) {
    const aiSkill = state.aiProfile || getRankDifficultyProfile(state.mode, 9, 5);
    const isThreeSite = state.map === 'HAVEN' || state.map === 'LOTUS';

    bots.forEach((bot, idx) => {
        if (!bot.alive) return;

        if (!bot.route) {
            const atkLanes = isThreeSite
                ? [MAP_WAYPOINTS.ATK_A, MAP_WAYPOINTS.ATK_B, MAP_WAYPOINTS.ATK_C]
                : [MAP_WAYPOINTS.ATK_A, MAP_WAYPOINTS.ATK_B, MAP_WAYPOINTS.ATK_MID];
            const defLanes = isThreeSite
                ? [MAP_WAYPOINTS.DEF_A, MAP_WAYPOINTS.DEF_B, MAP_WAYPOINTS.DEF_C]
                : [MAP_WAYPOINTS.DEF_A, MAP_WAYPOINTS.DEF_B];

            bot.route = bot.team === 'ATK' ? atkLanes[idx % atkLanes.length] : defLanes[idx % defLanes.length];
            bot.wpIndex = 0;
            bot.hasThrownUtility = false;
            bot.stepTimer = 0;
        }
        const isEnemy = state.mode === 'DEATHMATCH' || state.mode === 'RANGE' || bot.team !== state.team;
        const botEye = bot.group.position.clone().add(new THREE.Vector3(0, 1.55, 0));
        const toPlayer = camera.position.clone().sub(botEye);
        const dist = toPlayer.length();

        let hasLineOfSight = false;
        if (isEnemy && state.alive && dist < 44) {
            losRay.set(botEye, toPlayer.clone().normalize());
            losRay.far = dist;
            const wallHits = losRay.intersectObjects(mapData.solidMeshes);
            hasLineOfSight = wallHits.length === 0 && !isBlockedBySmoke(botEye, camera.position);
        }

        if (aiSkill.useUtility && !bot.hasThrownUtility && bot.wpIndex === 2 && scene) {
            bot.hasThrownUtility = true;
            const throwDir = new THREE.Vector3(0, 0.1, bot.team === 'ATK' ? -1 : 1);
            launchAbilityProjectile('SMOKE', botEye, throwDir, scene, mapData.colliders, null);
        }
        let moveTarget = null;
        if (state.mode === 'DEATHMATCH' || state.mode === 'RANGE' || state.mode === 'CUSTOM') {
            moveTarget = new THREE.Vector3(
                Math.sin(now * 0.0007 + idx) * 36,
                0,
                Math.cos(now * 0.0005 + idx) * 36
            );
        } else if (bot.team === 'DEF' && state.spikePlanted && spikePos) {
            moveTarget = new THREE.Vector3(spikePos.x, 0, spikePos.z);
        } else {
            moveTarget = bot.route[Math.min(bot.wpIndex, bot.route.length - 1)];
            if (bot.group.position.distanceTo(moveTarget) < 2.2 && bot.wpIndex < bot.route.length - 1) {
                bot.wpIndex++;
            }
        }
        let isBotMoving = false;
        if (hasLineOfSight && aiSkill.counterStrafe) {
            const strafeWave = Math.sin(now * 0.0055 + idx * 2.1);
            const rightVec = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
            const nextPos = bot.group.position.clone().addScaledVector(rightVec, strafeWave * (aiSkill.moveSpeed * 0.65) * delta);
            const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(nextPos.x, 1, nextPos.z), new THREE.Vector3(0.75, 1.8, 0.75));
            if (!mapData.colliders.some(c => c.intersectsBox(box))) {
                bot.group.position.copy(nextPos);
                isBotMoving = true;
            }
        } else if (moveTarget) {
            const step = moveTarget.clone().sub(bot.group.position);
            step.y = 0;
            if (step.length() > 1.8) {
                step.normalize();
                const nextPos = bot.group.position.clone().addScaledVector(step, aiSkill.moveSpeed * delta);
                const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(nextPos.x, 1, nextPos.z), new THREE.Vector3(0.75, 1.8, 0.75));
                if (!mapData.colliders.some(c => c.intersectsBox(box))) {
                    bot.group.position.copy(nextPos);
                    bot.group.lookAt(moveTarget.x, 0, moveTarget.z);
                    isBotMoving = true;
                }
            }
            else if (bot.team === 'ATK' && !state.spikePlanted && bot.wpIndex === bot.route.length - 1 && (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE')) {
                bot.plantProgress = (bot.plantProgress || 0) + delta;
                if (bot.plantProgress >= 3.5 && plantSpikeFn) {
                    bot.plantProgress = 0;
                    plantSpikeFn(bot.group.position);
                }
            } else if (bot.team === 'DEF' && state.spikePlanted && spikePos && bot.group.position.distanceTo(spikePos) < 2.8) {
                bot.defuseProgress = (bot.defuseProgress || 0) + delta;
                if (bot.defuseProgress >= 7.0 && defuseSpikeFn) {
                    bot.defuseProgress = 0;
                    defuseSpikeFn();
                }
            }
        }
        if (isBotMoving && state.alive) {
            bot.stepTimer = (bot.stepTimer || 0) + delta;
            if (bot.stepTimer >= 0.42) {
                bot.stepTimer = 0;
                playSpatialFootstep('STONE', bot.group.position, camera.position, camera.rotation.y);
            }
        }
        if (hasLineOfSight) {
            bot.group.lookAt(camera.position.x, 0, camera.position.z);
            bot.spottedTimer = (bot.spottedTimer || 0) + delta;

            if (bot.spottedTimer >= aiSkill.reactionTime) {
                bot.shootCD -= delta;
                if (bot.shootCD <= 0) {
                    bot.shootCD = aiSkill.shootInterval * (0.85 + Math.random() * 0.3);
                    const spread = (1 - aiSkill.hitChance) * 1.5;
                    const aimPoint = camera.position.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * spread,
                        -0.2 + (Math.random() - 0.5) * spread * 0.5,
                        0
                    ));

                    spawnTracer(botEye, aimPoint, false);
                    playSpatialGunshot(165, false, botEye, camera.position, camera.rotation.y);

                    if (Math.random() < aiSkill.hitChance) {
                        const isHeadshot = Math.random() < aiSkill.headshotChance;
                        takeDamage(isHeadshot ? 78 : 26, bot.id, isHeadshot);
                    } else {
                        playBulletWhiz(botEye, camera.position, camera.rotation.y);
                    }
                }
            }
        } else {
            bot.spottedTimer = 0;
        }
    });
}
