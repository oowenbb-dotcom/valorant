import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
    announceVoice, playAbilityWhoosh, playArmorBreak, playBarrierDrop,
    playDefuseHalfway, playEquipSound, playFallDamage, playFinisherChord,
    playFootstep, playGunshot, playHeadshot, playHeartbeat, playKillBanner,
    playMatchFound, playOmenPhase, playPingSound, playReloadStage,
    playSpatialFootstep, playSpatialGunshot, playSpikeBeep, playSurfaceImpact,
    playTeleportSound, playUltimateReady
} from './audio.js';
import { buildKnifeMesh, buildWeaponMesh, WEAPONS } from './weapons.js';
import { buildMap, setupRayTracingSystem } from './maps.js';
import { buildAgentCharacter } from './agents.js';
import { getRankDifficultyProfile, updateTacticalBots } from './ai.js';
import {
    ACTIVE_SLOW_ZONES, ACTIVE_SMOKES, animateCharacterDeath, buildAnimatedSky,
    buildFirstPersonAbilityHand, buildSpikeViewmodel, launchAbilityProjectile,
    spawnHeadshotSparks, spawnShellCasing, spawnSignatureFinisher,
    updateThirdPersonPose, updateViewmodelAnimations, updateWorldAnimations
} from './animations.js';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.35);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xffeed6, 1.85);
sun.position.set(48, 75, 32);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.bias = -0.0005;
scene.add(sun);

let bloomEnabled = false;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.4, 0.82);
composer.addPass(bloomPass);
const aimSettings = JSON.parse(localStorage.getItem('valor_aim') || 'null') || {
    sens: 0.35, adsMult: 0.80, rawInput: true, invertY: false
};

const controls = new PointerLockControls(camera, document.body);
controls.pointerSpeed = aimSettings.sens;
scene.add(camera);

const sensSlider = document.getElementById('mouse-sens');
const adsSlider = document.getElementById('ads-sens');
const rawToggle = document.getElementById('raw-input-toggle');
const invertToggle = document.getElementById('invert-y-toggle');

sensSlider.value = aimSettings.sens;
document.getElementById('sens-val').innerText = aimSettings.sens.toFixed(2);
adsSlider.value = aimSettings.adsMult;
document.getElementById('ads-sens-val').innerText = aimSettings.adsMult.toFixed(2);
rawToggle.checked = aimSettings.rawInput;
invertToggle.checked = aimSettings.invertY;

function saveAimSettings() {
    localStorage.setItem('valor_aim', JSON.stringify(aimSettings));
}

async function lockPointerWithRawInput() {
    try {
        await document.body.requestPointerLock({ unadjustedMovement: aimSettings.rawInput });
    } catch {
        controls.lock();
    }
}
sensSlider.oninput = (e) => {
    aimSettings.sens = Number(e.target.value);
    document.getElementById('sens-val').innerText = aimSettings.sens.toFixed(2);
    controls.pointerSpeed = state.isADS ? aimSettings.sens * aimSettings.adsMult : aimSettings.sens;
    saveAimSettings();
};

adsSlider.oninput = (e) => {
    aimSettings.adsMult = Number(e.target.value);
    document.getElementById('ads-sens-val').innerText = aimSettings.adsMult.toFixed(2);
    controls.pointerSpeed = state.isADS ? aimSettings.sens * aimSettings.adsMult : aimSettings.sens;
    saveAimSettings();
};

rawToggle.onchange = (e) => { aimSettings.rawInput = e.target.checked; saveAimSettings(); };
invertToggle.onchange = (e) => { aimSettings.invertY = e.target.checked; saveAimSettings(); };

let mouseDeltaX = 0, mouseDeltaY = 0;
document.addEventListener('mousemove', (e) => {
    if (!controls.isLocked) return;
    mouseDeltaX = e.movementX;
    mouseDeltaY = e.movementY;
    if (aimSettings.invertY) {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.x += e.movementY * 0.004 * controls.pointerSpeed;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }
});
const state = {
    id: 'LOCAL', isHost: true, mode: 'UNRATED', serverShard: 'NA-EAST',
    map: 'ASCENT', skin: 'STANDARD', agent: 'JETT', playerTitle: 'VANGUARD',
    team: 'ATK', phase: 'BUY', timer: 15, spikeTimer: 45,
    spikePlanted: false, defuseSaved: 0, halftimeDone: false,
    atkScore: 0, defScore: 0, credits: 800, lossStreak: 0,
    hp: 100, shield: 0, alive: true, kills: 0, deaths: 0, assists: 0,
    roundStreak: 0, firstBloodClaimed: false, firstBloods: 0,
    totalDamage: 0, headshots: 0, bodyshots: 0,
    incomingHits: { head: 0, body: 0 },
    primaryGun: null, sidearmGun: WEAPONS.CLASSIC,
    gun: WEAPONS.CLASSIC, equippedSlot: 'SIDEARM',
    ammo: 12, isReloading: false, reloadTimer: 0, reloadDuration: 1.5,
    isADS: false, zoomLevel: 0, isCrouching: false,
    taggedTimer: 0, sprayShots: 0, recoilPitch: 0, recoilYaw: 0, recoilResetTimer: 0,
    cCharges: 1, maxCCharges: 2, qCharges: 1, maxQCharges: 2,
    eReady: true, eCooldownTimer: 0, jettDashKills: 0,
    ultPoints: 0, maxUlt: 6, phoenixAnchor: null, reconScanTimer: 0,
    omenPhasing: false, omenDist: 16, orbHoldTimer: 0,
    agentLocked: false, pregameTime: 45, teamLocks: {},
    aiProfile: null, cheats: { infCreds: false, infAb: false, ghostActive: false }
};
const RANK_TIERS = [
    { name: 'IRON 1', short: 'I1', color: '#71717a' }, { name: 'IRON 2', short: 'I2', color: '#71717a' }, { name: 'IRON 3', short: 'I3', color: '#71717a' },
    { name: 'BRONZE 1', short: 'B1', color: '#b45309' }, { name: 'BRONZE 2', short: 'B2', color: '#b45309' }, { name: 'BRONZE 3', short: 'B3', color: '#b45309' },
    { name: 'SILVER 1', short: 'S1', color: '#cbd5e1' }, { name: 'SILVER 2', short: 'S2', color: '#cbd5e1' }, { name: 'SILVER 3', short: 'S3', color: '#cbd5e1' },
    { name: 'GOLD 1', short: 'G1', color: '#facc15' }, { name: 'GOLD 2', short: 'G2', color: '#facc15' }, { name: 'GOLD 3', short: 'G3', color: '#facc15' },
    { name: 'PLATINUM 1', short: 'P1', color: '#22d3ee' }, { name: 'PLATINUM 2', short: 'P2', color: '#22d3ee' }, { name: 'PLATINUM 3', short: 'P3', color: '#22d3ee' },
    { name: 'DIAMOND 1', short: 'D1', color: '#e879f9' }, { name: 'DIAMOND 2', short: 'D2', color: '#e879f9' }, { name: 'DIAMOND 3', short: 'D3', color: '#e879f9' },
    { name: 'ASCENDANT 1', short: 'A1', color: '#10b981' }, { name: 'ASCENDANT 2', short: 'A2', color: '#10b981' }, { name: 'ASCENDANT 3', short: 'A3', color: '#10b981' },
    { name: 'IMMORTAL 1', short: 'IM1', color: '#f43f5e' }, { name: 'IMMORTAL 2', short: 'IM2', color: '#f43f5e' }, { name: 'IMMORTAL 3', short: 'IM3', color: '#f43f5e' },
    { name: 'RADIANT', short: 'RAD', color: '#fef08a' }
];

let rankedProfile = JSON.parse(localStorage.getItem('valor_ranked_v2') || 'null') || {
    placementsPlayed: 0, placementWins: 0, rankIdx: 9, rr: 50, history: []
};

function saveRankedProfile() {
    localStorage.setItem('valor_ranked_v2', JSON.stringify(rankedProfile));
}
function renderRankedUI() {
    const titleEl = document.getElementById('player-rank-title');
    const rrValEl = document.getElementById('player-rr-val');
    const barEl = document.getElementById('rr-bar-fill');
    const emblemEl = document.getElementById('rank-emblem');
    const shortEl = document.getElementById('rank-short');
    const previewAI = getRankDifficultyProfile('COMPETITIVE', rankedProfile.rankIdx, rankedProfile.placementsPlayed);

    if (rankedProfile.placementsPlayed < 5) {
        titleEl.innerText = `UNRANKED (${rankedProfile.placementsPlayed}/5 PLACEMENTS)`;
        rrValEl.innerText = `WINS: ${rankedProfile.placementWins} • BOT MMR: ${previewAI.label}`;
        barEl.style.width = `${(rankedProfile.placementsPlayed / 5) * 100}%`;
        shortEl.innerText = `${rankedProfile.placementsPlayed}/5`;
    } else {
        const tier = RANK_TIERS[rankedProfile.rankIdx];
        titleEl.innerText = tier.name;
        titleEl.style.color = tier.color;
        emblemEl.style.borderColor = tier.color;
        shortEl.style.color = tier.color;
        shortEl.innerText = tier.short;
        rrValEl.innerText = `${rankedProfile.rr} / 100 RR • BOT MMR: ${previewAI.label}`;
        barEl.style.width = tier.name === 'RADIANT' ? '100%' : `${rankedProfile.rr}%`;
        barEl.style.background = tier.color;
    }
}
renderRankedUI();

document.getElementById('open-career-btn').onclick = () => {
    const body = document.getElementById('career-body');
    body.innerHTML = rankedProfile.history.length === 0
        ? '<tr><td colspan="6" style="text-align:center; color:#8b978f;">No Competitive matches played yet.</td></tr>'
        : rankedProfile.history.map(m => `<tr><td>${m.mode}</td><td>${m.map}</td><td>${m.agent}</td><td>${m.score}</td><td>${m.kd}</td><td style="color:${m.rrText.startsWith('+') ? '#00ffcc' : '#ff4655'}; font-weight:bold;">${m.rrText}</td></tr>`).join('');
    document.getElementById('career-modal').classList.remove('hidden');
};
document.getElementById('close-career-btn').onclick = () => document.getElementById('career-modal').classList.add('hidden');
const DEFAULT_BINDS = {
    RELOAD: 'KeyR', ABILITY_C: 'KeyC', ABILITY_Q: 'KeyQ', ABILITY_E: 'KeyE',
    ULTIMATE: 'KeyX', DROP: 'KeyG', INTERACT: 'KeyF', PING: 'KeyZ', SPRAY: 'KeyT'
};
let keybinds = JSON.parse(localStorage.getItem('valor_keybinds') || 'null') || { ...DEFAULT_BINDS };
let listeningAction = null;

function renderKeybindUI() {
    const list = document.getElementById('keybind-list');
    list.innerHTML = Object.entries(keybinds).map(([action, code]) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#0f1923; padding:5px 8px; border:1px solid #364554;">
            <span>${action}</span>
            <button class="pill bind-btn" data-action="${action}" style="padding:2px 6px; font-size:0.7rem; color:#00ffcc;">${listeningAction === action ? '...' : code.replace('Key', '')}</button>
        </div>
    `).join('');
    document.querySelectorAll('.bind-btn').forEach(btn => {
        btn.onclick = () => { listeningAction = btn.dataset.action; renderKeybindUI(); };
    });
}
renderKeybindUI();

document.getElementById('reset-binds-btn').onclick = () => {
    keybinds = { ...DEFAULT_BINDS };
    localStorage.setItem('valor_keybinds', JSON.stringify(keybinds));
    listeningAction = null;
    renderKeybindUI();
};

function areCheatsAllowed() {
    return state.mode === 'CUSTOM' || state.mode === 'RANGE';
}

function syncCheatLockState() {
    const allowed = areCheatsAllowed();
    const panel = document.getElementById('cheats-panel');
    const badge = document.getElementById('cheat-lock-badge');
    panel.style.opacity = allowed ? '1' : '0.45';
    badge.innerText = allowed ? 'UNLOCKED' : 'LOCKED IN LIVE MATCH';
    badge.style.color = allowed ? '#00ffcc' : '#ff4655';
    document.querySelectorAll('.cheat-input').forEach(el => {
        el.disabled = !allowed;
        if (!allowed && el.type === 'checkbox') el.checked = false;
    });
    if (!allowed) state.cheats = { infCreds: false, infAb: false, ghostActive: false };
}
const viewmodelHolder = new THREE.Group();
viewmodelHolder.position.set(0.25, -0.22, -0.42);
camera.add(viewmodelHolder);

let activeGunMesh = buildWeaponMesh('CLASSIC', 'JETT', 'STANDARD');
viewmodelHolder.add(activeGunMesh);

let knifeModel = buildKnifeMesh('STANDARD');
knifeModel.position.set(0.24, -0.22, -0.35);
knifeModel.visible = false;
camera.add(knifeModel);

let abilityHandHolder = buildFirstPersonAbilityHand('JETT');
camera.add(abilityHandHolder);

let spikeHandHolder = buildSpikeViewmodel();
camera.add(spikeHandHolder);

const skyClouds = buildAnimatedSky(scene);
const spikeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, 0.7, 8),
    new THREE.MeshStandardMaterial({ color: 0x0f1923, emissive: 0xff4655 })
);
spikeMesh.visible = false;
scene.add(spikeMesh);

const omenMarker = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true })
);
omenMarker.visible = false;
scene.add(omenMarker);
const showcasePedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.6, 0.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x005544 })
);
showcasePedestal.position.set(0, 0.1, -4);
let showcaseAgent = buildAgentCharacter('SHOWCASE', false, 'JETT');
showcaseAgent.group.position.set(0, 0.2, -4);
scene.add(showcasePedestal, showcaseAgent.group);

const ultOrbs = [];
[-24, 24].forEach(xPos => {
    const orbMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x006655 })
    );
    orbMesh.position.set(xPos, 1.15, 0);
    scene.add(orbMesh);
    ultOrbs.push({ mesh: orbMesh, active: true });
});

let mapData = { colliders: [], solidMeshes: [], penetrableMeshes: [], buyBarriers: [], teleporters: [], ramps: [], destructibles: [] };
let rtController = null;
let activeSprayMesh = null;
const bots = [];
const remotePlayers = {};
const connections = [];
const droppedWeapons = [];
const firePools = [];
let peer = null;
let weaponRequests = {};
const AGENT_BIOS = {
    JETT:    { role: 'DUELIST',    desc: '[C] Cloudburst Smoke • [Q] Updraft High-Jump • [E] Tailwind Dash (Resets on 2 Kills) • [X] Blade Storm.' },
    PHOENIX: { role: 'DUELIST',    desc: '[C] Blaze Firewall • [Q] Curveball Flash • [E] Hot Hands Fire Pool • [X] Run It Back Respawn.' },
    REYNA:   { role: 'DUELIST',    desc: '[C] Leer Blind Eye • [Q] Devour Overheal • [E] Dismiss Soul Heal • [X] Empress Overheal.' },
    OMEN:    { role: 'CONTROLLER', desc: '[C] Shrouded Step Blink • [Q] Paranoia Blind • [E] Dark Cover Shadow Smoke • [X] From the Shadows.' },
    SAGE:    { role: 'SENTINEL',   desc: '[C] Barrier Ice Wall • [Q] Slow Orb Ice Field • [E] Healing Orb • [X] Ally Resurrection.' },
    SOVA:    { role: 'INITIATOR',  desc: '[C] Owl Recon Pulse • [Q] Shock Bolt • [E] Recon Bolt (2-Bounce Radar) • [X] Hunter\'s Fury Beam.' }
};

const AGENT_QUOTES = {
    JETT: '"Cool. Let\'s go!"', PHOENIX: '"Just take a seat, I got this."', REYNA: '"They will cower!"',
    OMEN: '"I am the beginning. I am the end."', SAGE: '"I am both shield and sword."', SOVA: '"Wherever they run, I will find them."'
};

const AGENT_ABILITY_NAMES = {
    JETT:    { C: 'CLOUDBURST',    Q: 'UPDRAFT',    E: 'TAILWIND',   X: 'BLADE STORM' },
    PHOENIX: { C: 'BLAZE',         Q: 'CURVEBALL',  E: 'HOT HANDS',  X: 'RUN IT BACK' },
    REYNA:   { C: 'LEER',          Q: 'DEVOUR',     E: 'DISMISS',    X: 'EMPRESS' },
    OMEN:    { C: 'SHROUDED STEP', Q: 'PARANOIA',   E: 'DARK COVER', X: 'FROM SHADOWS' },
    SAGE:    { C: 'BARRIER ORB',   Q: 'SLOW ORB',   E: 'HEALING ORB',X: 'RESURRECTION' },
    SOVA:    { C: 'OWL PULSE',     Q: 'SHOCK BOLT', E: 'RECON BOLT', X: 'HUNTER FURY' }
};

function bindPillGroup(groupId, stateKey) {
    document.querySelectorAll(`#${groupId} .pill`).forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(`#${groupId} .pill`).forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            state[stateKey] = btn.dataset[stateKey === 'serverShard' ? 'server' : stateKey === 'playerTitle' ? 'title' : stateKey];
        };
    });
}
bindPillGroup('mode-select', 'mode');
bindPillGroup('server-select', 'serverShard');
bindPillGroup('map-select', 'map');
bindPillGroup('skin-select', 'skin');
bindPillGroup('title-select', 'playerTitle');
let queueInterval = null;
let pregameInterval = null;

document.getElementById('find-match-btn').onclick = () => {
    document.getElementById('find-match-btn').classList.add('hidden');
    document.getElementById('queue-timer-box').classList.remove('hidden');
    document.getElementById('active-shard-label').innerText = `${state.serverShard} // ${state.mode}`;
    document.getElementById('hud-shard-ping').innerText = `${state.serverShard} (19ms)`;

    let qSecs = 0;
    queueInterval = setInterval(() => {
        qSecs++;
        document.getElementById('queue-clock').innerText = `${String(Math.floor(qSecs / 60)).padStart(2, '0')}:${String(qSecs % 60).padStart(2, '0')}`;
    }, 1000);

    setTimeout(() => {
        clearInterval(queueInterval);
        playMatchFound();
        announceVoice('Match found');
        connectToServerShard();
    }, 1600);
};

document.getElementById('cancel-queue-btn').onclick = () => {
    clearInterval(queueInterval);
    document.getElementById('queue-timer-box').classList.add('hidden');
    document.getElementById('find-match-btn').classList.remove('hidden');
};

function connectToServerShard() {
    const SHARD_ROOM_ID = `VALOR-${state.serverShard}-${state.mode}-V15`;
    const candidate = new Peer(SHARD_ROOM_ID);
    candidate.on('open', (id) => {
        peer = candidate; state.id = id; state.isHost = true; state.team = 'ATK';
        openAgentSelectScreen();
    });
    candidate.on('connection', (conn) => setupConn(conn));
    candidate.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            candidate.destroy();
            peer = new Peer();
            peer.on('open', (id) => {
                state.id = id; state.isHost = false;
                state.team = Math.random() > 0.5 ? 'DEF' : 'ATK';
                setupConn(peer.connect(SHARD_ROOM_ID));
                openAgentSelectScreen();
            });
        }
    });
}
function openAgentSelectScreen() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('agent-select-screen').classList.remove('hidden');
    document.getElementById('pregame-map-info').innerText = `${state.map} // ${state.mode} // ${state.serverShard}`;
    state.pregameTime = 45;
    renderPregameRoster();

    pregameInterval = setInterval(() => {
        state.pregameTime--;
        document.getElementById('pregame-timer').innerText = state.pregameTime;
        if (state.pregameTime <= 0) { clearInterval(pregameInterval); if (!state.agentLocked) lockInAgent(); }
    }, 1000);
}

function renderPregameRoster() {
    const roster = document.getElementById('pregame-roster');
    const teammates = [
        { name: 'YOU', agent: state.agent, locked: state.agentLocked },
        ...Object.entries(state.teamLocks).map(([id, info]) => ({ name: id.slice(0, 6), agent: info.agent, locked: info.locked })),
        { name: 'BOT_01', agent: 'SAGE', locked: true },
        { name: 'BOT_02', agent: 'OMEN', locked: true },
        { name: 'BOT_03', agent: 'SOVA', locked: true }
    ].slice(0, 5);

    roster.innerHTML = teammates.map(p => `
        <div style="background:rgba(15,25,35,0.9); border-left:4px solid ${p.locked ? '#00ffcc' : '#facc15'}; padding:8px 12px;">
            <div style="font-size:0.7rem; color:#8b978f;">${p.name} • ${p.locked ? 'LOCKED IN' : 'PICKING...'}</div>
            <div style="font-weight:bold; font-size:1rem; color:${p.locked ? '#ece8e1' : '#facc15'};">${p.agent}</div>
        </div>
    `).join('');
}

document.querySelectorAll('#agent-select .card').forEach(c => {
    c.onclick = () => {
        if (state.agentLocked || c.classList.contains('locked')) return;
        document.querySelectorAll('#agent-select .card').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        state.agent = c.dataset.agent;

        const bio = AGENT_BIOS[state.agent];
        document.getElementById('bio-role').innerText = bio.role;
        document.getElementById('bio-name').innerText = state.agent;
        document.getElementById('bio-desc').innerText = bio.desc;

        scene.remove(showcaseAgent.group);
        showcaseAgent = buildAgentCharacter('SHOWCASE', false, state.agent);
        showcaseAgent.group.position.set(0, 0.2, -4);
        scene.add(showcaseAgent.group);

        broadcast({ type: 'AGENT_HOVER', agent: state.agent, team: state.team });
        renderPregameRoster();
    };
});
function lockInAgent() {
    if (state.agentLocked) return;
    state.agentLocked = true;
    const lockBtn = document.getElementById('lock-in-btn');
    lockBtn.innerText = 'LOCKED IN';
    lockBtn.disabled = true;

    document.getElementById('cutin-agent').innerText = state.agent;
    document.getElementById('cutin-quote').innerText = AGENT_QUOTES[state.agent] || '';
    document.getElementById('lock-in-cutin').classList.remove('hidden');

    playUltimateReady();
    announceVoice(AGENT_QUOTES[state.agent].replace(/"/g, ''));
    broadcast({ type: 'AGENT_LOCK', agent: state.agent, team: state.team, credits: state.credits });
    renderPregameRoster();

    state.aiProfile = getRankDifficultyProfile(state.mode, rankedProfile.rankIdx, rankedProfile.placementsPlayed);

    setTimeout(() => {
        clearInterval(pregameInterval);
        document.getElementById('agent-select-screen').classList.add('hidden');
        mapData = buildMap(scene, state.map);
        rtController = setupRayTracingSystem(scene, renderer, sun, mapData.floor, mapData.solidMeshes, mapData.penetrableMeshes);

        if (state.isHost) {
            const botCount = state.mode === 'RANGE' ? 6 : 4;
            for (let i = 0; i < botCount; i++) createBot('ATK', -20 + i * 10, 38, ['JETT', 'PHOENIX', 'REYNA', 'SOVA'][i % 4]);
            if (state.mode !== 'RANGE') {
                for (let i = 0; i < 5; i++) createBot('DEF', -25 + i * 12, -38, ['SAGE', 'OMEN', 'JETT', 'REYNA', 'PHOENIX'][i % 5]);
            }
            startRound((state.mode === 'UNRATED' || state.mode === 'COMPETITIVE') ? 'BUY' : 'COMBAT');
        }
        enterGame();
    }, 2000);
}
document.getElementById('lock-in-btn').onclick = lockInAgent;

function enterGame() {
    showcasePedestal.visible = false;
    showcaseAgent.group.visible = false;
    syncCheatLockState();

    const loadScreen = document.getElementById('loading-screen');
    document.getElementById('load-map-title').innerText = state.map;
    document.getElementById('load-mode-label').innerText = state.mode === 'COMPETITIVE'
        ? `COMPETITIVE // MMR TIER: ${rankedProfile.placementsPlayed < 5 ? 'PLACEMENTS' : RANK_TIERS[rankedProfile.rankIdx].name}`
        : `${state.mode} // 5V5 TACTICAL`;

    const atkNames = [state.team === 'ATK' ? `${state.agent} [${state.playerTitle}]` : 'JETT (BOT)', 'PHOENIX', 'REYNA', 'OMEN', 'SOVA'];
    const defNames = [state.team === 'DEF' ? `${state.agent} [${state.playerTitle}]` : 'SAGE (BOT)', 'JETT', 'OMEN', 'REYNA', 'PHOENIX'];
    document.getElementById('load-atk-roster').innerHTML = atkNames.map(n => `<div style="background:#1b2733; border-left:4px solid #ff4655; padding:8px 12px; font-weight:bold;">${n}</div>`).join('');
    document.getElementById('load-def-roster').innerHTML = defNames.map(n => `<div style="background:#1b2733; border-right:4px solid #00ffcc; padding:8px 12px; font-weight:bold; text-align:right;">${n}</div>`).join('');

    loadScreen.classList.remove('hidden');
    resetPlayerPosition();
    equipSlot(state.primaryGun ? 'PRIMARY' : 'SIDEARM');
    updateHUD();

    setTimeout(() => {
        loadScreen.classList.add('hidden');
        lockPointerWithRawInput();
    }, 2200);
}
function setupConn(conn) {
    conn.on('open', () => {
        connections.push(conn);
        conn.send({ type: 'SYNC_STATE', state: {
            atkScore: state.atkScore, defScore: state.defScore, phase: state.phase,
            timer: state.timer, spikePlanted: state.spikePlanted
        }});
    });
    conn.on('data', (data) => handleData(conn.peer, data));
    conn.on('close', () => {
        const idx = connections.indexOf(conn);
        if (idx > -1) connections.splice(idx, 1);
        if (remotePlayers[conn.peer]) { scene.remove(remotePlayers[conn.peer].group); delete remotePlayers[conn.peer]; }
        if (!state.isHost) {
            state.isHost = true;
            showBanner('HOST MIGRATED TO YOU');
        }
    });
}

function broadcast(msg) {
    connections.forEach(c => { if (c.open) c.send(msg); });
}

function handleData(senderId, data) {
    if (data.type === 'MOVE') {
        if (!remotePlayers[senderId]) {
            const rp = buildAgentCharacter(senderId, data.team !== state.team, data.agent || 'JETT');
            scene.add(rp.group);
            remotePlayers[senderId] = { ...rp, team: data.team, agent: data.agent, credits: data.credits || 800, gunName: data.gunName || 'CLASSIC' };
        }
        const rp = remotePlayers[senderId];
        rp.group.position.set(data.x, data.y - 1.7, data.z);
        rp.group.rotation.y = data.ry;
        rp.credits = data.credits; rp.gunName = data.gunName;
    } else if (data.type === 'AGENT_HOVER' || data.type === 'AGENT_LOCK') {
        state.teamLocks[senderId] = { agent: data.agent, locked: data.type === 'AGENT_LOCK' };
        renderPregameRoster();
    } else if (data.type === 'HIT' && data.target === state.id) {
        takeDamage(data.dmg, senderId, data.isHead);
    } else if (data.type === 'ROUND_START') {
        startRound(data.phase, true);
    } else if (data.type === 'SPIKE_PLANTED') {
        state.spikePlanted = true; spikeMesh.visible = true; spikeMesh.position.set(data.x, 0.45, data.z);
        announceVoice('Spike planted'); showBanner('SPIKE PLANTED'); updateHUD();
    } else if (data.type === 'CHAT') {
        appendChat(data.agent, data.msg, '#ece8e1');
    } else if (data.type === 'RADIO') {
        addKillfeed(`[RADIO] ${data.agent}: ${data.msg}`);
    } else if (data.type === 'PING') {
        spawnPingBeacon(new THREE.Vector3(data.x, 0, data.z));
    } else if (data.type === 'REQUEST_WEAPON') {
        weaponRequests[senderId] = data.gun; renderTeamEconomy();
    } else if (data.type === 'GIFT_WEAPON' && data.target === state.id) {
        state.primaryGun = WEAPONS[data.gun]; equipSlot('PRIMARY'); showBanner(`RECEIVED ${data.gun}`);
    }
}
function createBot(team, x, z, agentType = 'JETT') {
    const id = `${team}_${agentType}_${bots.length + 1}`;
    const isEnemy = state.mode === 'DEATHMATCH' || state.mode === 'RANGE' || team !== state.team;
    const charObj = buildAgentCharacter(id, isEnemy, agentType);
    charObj.group.position.set(x, 0, z);
    scene.add(charObj.group);
    bots.push({
        id, team, agentType, ...charObj, hp: 100, alive: true,
        kills: 0, deaths: 0, dirX: Math.random() > 0.5 ? 1 : -1, shootCD: 1.5,
        flinchTimer: 0, isCrouching: false, route: null, wpIndex: 0
    });
}

let knifeSwingTimer = 0, equipTimer = 0, inspectTimer = 0, abilityCastTimer = 0, boltCycleTimer = 0, landDip = 0;

function equipSlot(slot) {
    if (state.isReloading) return;
    state.equippedSlot = slot;
    state.isADS = false;
    state.zoomLevel = 0;
    controls.pointerSpeed = aimSettings.sens;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    document.getElementById('sniper-scope').classList.add('hidden');
    equipTimer = 0.4;

    if (slot === 'KNIFE') {
        viewmodelHolder.visible = false;
        camera.remove(knifeModel);
        knifeModel = buildKnifeMesh(state.skin);
        knifeModel.position.set(0.24, -0.22, -0.35);
        camera.add(knifeModel);
        knifeModel.visible = true;
        state.gun = WEAPONS.KNIFE;
        state.ammo = 1;
        playEquipSound('KNIFE');
    } else {
        knifeModel.visible = false;
        viewmodelHolder.visible = true;
        if (slot === 'PRIMARY' && state.primaryGun) state.gun = state.primaryGun;
        else if (slot === 'ULT') state.gun = WEAPONS.BLADE_STORM;
        else { state.equippedSlot = 'SIDEARM'; state.gun = state.sidearmGun; }

        state.ammo = state.gun.mag;
        viewmodelHolder.remove(activeGunMesh);
        activeGunMesh = buildWeaponMesh(state.gun.name, state.agent, state.skin);
        viewmodelHolder.add(activeGunMesh);
        playEquipSound(state.gun.name);
    }
    updateHUD();
}

function reload() {
    if (state.isReloading || state.ammo === state.gun.mag) return;
    state.isReloading = true;
    state.isADS = false;
    state.zoomLevel = 0;
    controls.pointerSpeed = aimSettings.sens;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    document.getElementById('sniper-scope').classList.add('hidden');
    viewmodelHolder.visible = true;

    state.reloadDuration = state.gun.name === 'OPERATOR' ? 2.2 : 1.5;
    state.reloadTimer = state.reloadDuration;
    playReloadStage('OUT');
    setTimeout(() => { if (state.isReloading) playReloadStage('IN'); }, state.reloadDuration * 550);
    setTimeout(() => { if (state.isReloading) playReloadStage('SLAP'); }, state.reloadDuration * 850);
}
let isFiring = false, lastShot = 0;

function shoot() {
    const now = performance.now();
    if (state.isReloading || now - lastShot < state.gun.rate) return;

    if (state.equippedSlot === 'KNIFE') {
        lastShot = now;
        knifeSwingTimer = 0.32;
        playGunshot(420, true);
        checkMeleeHit();
        return;
    }

    if (state.ammo <= 0) { reload(); return; }
    lastShot = now;
    state.ammo--;
    state.sprayShots++;
    state.recoilResetTimer = 0.36;

    const adsMult = state.isADS ? 0.65 : 1.0;
    const crouchMult = state.isCrouching ? 0.72 : 1.0;
    if (state.sprayShots <= 6) {
        const kickPitch = state.gun.climb * 1.45 * adsMult * crouchMult;
        camera.rotation.x = Math.min(Math.PI / 2, camera.rotation.x + kickPitch);
        state.recoilPitch += kickPitch;
    } else {
        const swayDir = Math.sin(state.sprayShots * 0.85) * state.gun.climb * 1.6 * crouchMult;
        camera.rotation.y += swayDir;
        state.recoilYaw = swayDir * 14;
    }

    playGunshot(state.gun.pitch, state.gun.sup);
    spawnShellCasing(scene, camera);

    const flashMesh = activeGunMesh.userData.muzzleFlashMesh;
    if (flashMesh) {
        flashMesh.visible = true;
        flashMesh.rotation.z = Math.random() * Math.PI * 2;
        flashMesh.scale.setScalar(state.gun.sup ? 0.45 : (0.85 + Math.random() * 0.35));
        setTimeout(() => { flashMesh.visible = false; }, 45);
    }

    if (state.gun.name === 'OPERATOR' || state.gun.name === 'MARSHAL') boltCycleTimer = 0.65;
    viewmodelHolder.position.z += 0.045;
    updateHUD();
    const horizSpeed = Math.hypot(velocity.x, velocity.z);
    const inDeadzone = horizSpeed <= 2.1 && canJump;
    const baseSpread = state.isCrouching ? 0.0008 : 0.0018;
    const airSpread = !canJump ? 0.14 : 0.068;
    const spread = state.gun.name === 'BLADE_STORM' ? 0 : (inDeadzone ? baseSpread : airSpread);

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread), camera);

    const startWorld = new THREE.Vector3();
    viewmodelHolder.getWorldPosition(startWorld);

    // Check destructible blast doors first
    if (mapData.destructibles) {
        const dMeshes = mapData.destructibles.map(d => d.mesh);
        const dHits = ray.intersectObjects(dMeshes);
        if (dHits.length > 0 && dHits[0].distance < 45) {
            const doorObj = mapData.destructibles.find(d => d.mesh === dHits[0].object);
            if (doorObj) {
                doorObj.hp -= state.gun.dmg;
                playSurfaceImpact('METAL');
                if (!state.gun.sup) spawnTracer(startWorld, dHits[0].point, false);
                if (doorObj.hp <= 0) {
                    scene.remove(doorObj.mesh);
                    const cIdx = mapData.colliders.indexOf(doorObj.box);
                    if (cIdx > -1) mapData.colliders.splice(cIdx, 1);
                    const sIdx = mapData.solidMeshes.indexOf(doorObj.mesh);
                    if (sIdx > -1) mapData.solidMeshes.splice(sIdx, 1);
                    mapData.destructibles.splice(mapData.destructibles.indexOf(doorObj), 1);
                    playArmorBreak();
                    showBanner('BLAST DOOR DESTROYED');
                }
                return;
            }
        }
    }

    const targetMeshes = [
        ...bots.filter(b => b.alive && (state.mode === 'DEATHMATCH' || state.mode === 'RANGE' || b.team !== state.team)).flatMap(b => b.group.children),
        ...Object.values(remotePlayers).filter(rp => state.mode === 'DEATHMATCH' || rp.team !== state.team).flatMap(rp => rp.group.children)
    ];

    const hits = ray.intersectObjects(targetMeshes, true);
    const penHits = ray.intersectObjects(mapData.penetrableMeshes);
    const wallHits = ray.intersectObjects(mapData.solidMeshes);
    let isWallbang = false;
    let penDamageMult = 1.0;
    if (penHits.length > 0 && state.gun.penTier >= 2) {
        isWallbang = true;
        penDamageMult = state.gun.penTier === 3 ? 0.72 : 0.52;
    } else if (wallHits.length > 0 && state.gun.penTier === 3 && wallHits[0].distance < 18) {
        isWallbang = true;
        penDamageMult = 0.45;
    } else if (penHits.length > 0 || wallHits.length > 0) {
        const coverDist = Math.min(penHits.length > 0 ? penHits[0].distance : 999, wallHits.length > 0 ? wallHits[0].distance : 999);
        if (hits.length === 0 || coverDist < hits[0].distance) {
            const impactHit = (penHits.length > 0 && penHits[0].distance === coverDist) ? penHits[0] : wallHits[0];
            playSurfaceImpact(penHits.length > 0 ? 'METAL' : 'STONE');
            if (!state.gun.sup) spawnTracer(startWorld, impactHit.point, false);
            return;
        }
    }

    const endPt = hits.length > 0 ? hits[0].point : ray.ray.origin.clone().addScaledVector(ray.ray.direction, 80);
    if (!state.gun.sup) spawnTracer(startWorld, endPt, isWallbang);

    if (hits.length > 0) {
        let hitObj = hits[0].object;
        while (hitObj && !hitObj.userData.ownerId) hitObj = hitObj.parent;
        if (!hitObj) return;

        const isHead = Boolean(hitObj.userData.isHead);
        const isLeg = Boolean(hitObj.userData.isLeg);
        const hitDist = camera.position.distanceTo(hits[0].point);
        const hasFalloff = ['PHANTOM', 'SPECTRE', 'STINGER', 'CLASSIC'].includes(state.gun.name);
        const falloffMult = !hasFalloff ? 1.0 : (hitDist <= 15 ? 1.0 : (hitDist <= 30 ? 0.88 : 0.78));

        const baseDmg = isHead ? state.gun.head : (isLeg ? Math.round(state.gun.dmg * 0.80) : state.gun.dmg);
        const dmg = Math.round(baseDmg * penDamageMult * falloffMult);

        state.totalDamage += dmg;
        if (isHead) { state.headshots++; playHeadshot(); spawnHeadshotSparks(scene, hits[0].point); }
        else state.bodyshots++;

        spawnFloatingDamage(hits[0].point, dmg, isHead);
        logCombat(`OUT -> ${hitObj.userData.ownerId}: ${dmg} (${isHead ? 'HEAD' : isLeg ? 'LEG' : 'BODY'})`);
        const ownerId = hitObj.userData.ownerId;
        const bot = bots.find(b => b.id === ownerId);
        if (bot) {
            bot.hp -= dmg;
            bot.lastDamagedByPlayer = performance.now();
            if (isHead && bot.hp > 0) bot.flinchTimer = 0.25;

            if (bot.hp <= 0) {
                bot.alive = false;
                bot.deaths++;
                state.kills++;
                state.roundStreak++;
                state.credits = Math.min(9000, state.credits + 200);
                gainUltPoint();
                playKillBanner(state.roundStreak);
                triggerKillBanner(state.roundStreak);

                if (!state.firstBloodClaimed && (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE')) {
                    state.firstBloodClaimed = true;
                    state.firstBloods++;
                    announceVoice('First blood');
                    showBanner('FIRST BLOOD');
                }

                if (state.agent === 'JETT' && !state.eReady) {
                    state.jettDashKills++;
                    if (state.jettDashKills >= 2) {
                        state.eReady = true; state.jettDashKills = 0;
                        playUltimateReady(); showBanner('TAILWIND RECHARGED (2/2 KILLS)');
                    }
                }

                const enemiesLeft = bots.filter(b => b.team !== state.team && b.alive).length;
                if (enemiesLeft === 0 && state.skin !== 'STANDARD') {
                    playFinisherChord(state.skin);
                    spawnSignatureFinisher(scene, state.skin, bot.group.position, bot.group);
                } else {
                    animateCharacterDeath(bot.group);
                }

                addKillfeed(`${state.agent} [${state.gun.name}${isHead ? ' ⊕' : ''}${isWallbang ? ' ⑃' : ''}] ${bot.id}`);
                updateEconomyPreview();
                updateHUD();

                if (state.mode === 'DEATHMATCH' || state.mode === 'RANGE') {
                    setTimeout(() => {
                        bot.hp = 100; bot.alive = true; bot.group.visible = true;
                        bot.group.position.set((Math.random() - 0.5) * 65, 0, (Math.random() - 0.5) * 65);
                    }, 2200);
                } else if (state.isHost) {
                    checkEliminationWin();
                }
            }
        } else if (remotePlayers[ownerId]) {
            broadcast({ type: 'HIT', target: ownerId, dmg, isHead });
        }
    }
}

function checkMeleeHit() {
    bots.forEach(b => {
        if (!b.alive) return;
        if (camera.position.distanceTo(b.group.position) < 2.8) {
            b.hp -= 75;
            spawnFloatingDamage(b.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 75, false);
            if (b.hp <= 0) {
                b.alive = false; state.kills++; state.roundStreak++;
                animateCharacterDeath(b.group);
                addKillfeed(`${state.agent} [KARAMBIT] ${b.id}`);
                updateHUD();
                if (state.isHost) checkEliminationWin();
            }
        }
    });
}
function triggerAbility(slot) {
    if (!state.alive || abilityCastTimer > 0) return;
    if (slot === 'C' && state.cCharges <= 0 && !state.cheats.infAb) return;
    if (slot === 'Q' && state.qCharges <= 0 && !state.cheats.infAb) return;
    if (slot === 'E' && !state.eReady && !state.cheats.infAb) return;

    const key = `${state.agent}_${slot}`;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (keys['ShiftLeft']) dir.multiplyScalar(0.45);
    const handPos = camera.position.clone().addScaledVector(dir, 0.7).add(new THREE.Vector3(0, -0.2, 0));

    // Omen Phased Shadow World Targeting on [E]
    if (key === 'OMEN_E') {
        if (!state.omenPhasing) {
            state.omenPhasing = true;
            state.omenDist = 16;
            omenMarker.visible = true;
            document.getElementById('omen-phase-screen').style.opacity = '1';
            playOmenPhase(true);
            showBanner('SHADOW PHASE // [LMB/RMB] RANGE • [E] DEPLOY');
            return;
        } else {
            state.omenPhasing = false;
            omenMarker.visible = false;
            document.getElementById('omen-phase-screen').style.opacity = '0';
            playOmenPhase(false);
            launchAbilityProjectile('DARK_SMOKE', omenMarker.position, new THREE.Vector3(0, 0, 0), scene, mapData.colliders, null);
        }
    }

    abilityCastTimer = 0.55;
    playAbilityWhoosh(slot === 'Q' ? 'FLASH' : 'SMOKE');

    if (key === 'JETT_C') launchAbilityProjectile('SMOKE', handPos, dir, scene, mapData.colliders, null);
    else if (key === 'JETT_Q') { velocity.y = 14.5; canJump = false; showBanner('UPDRAFT // HIGH GROUND'); }
    else if (key === 'JETT_E') { velocity.x -= dir.x * 36; velocity.z -= dir.z * 36; state.jettDashKills = 0; }
    else if (key === 'SAGE_C') launchAbilityProjectile('WALL', handPos, dir, scene, mapData.colliders, null);
    else if (key === 'SAGE_Q') launchAbilityProjectile('SLOW_ORB', handPos, dir, scene, mapData.colliders, null);
    else if (key === 'SAGE_E') { state.hp = Math.min(100, state.hp + 60); showBanner('HEALING ORB (+60 HP)'); }
    else if (key === 'PHOENIX_C' || key === 'PHOENIX_E') {
        launchAbilityProjectile('MOLLY', handPos, dir, scene, mapData.colliders, (poolMesh) => {
            const zone = { mesh: poolMesh, pos: poolMesh.position.clone() };
            firePools.push(zone);
            setTimeout(() => { scene.remove(poolMesh); const i = firePools.indexOf(zone); if (i > -1) firePools.splice(i, 1); }, 6000);
        });
    } else if (key === 'PHOENIX_Q') {
        launchAbilityProjectile('FLASH', handPos, dir, scene, mapData.colliders, () => {
            document.getElementById('flash-screen').style.opacity = '0.85';
            setTimeout(() => document.getElementById('flash-screen').style.opacity = '0', 600);
        });
    } else if (key === 'REYNA_C') launchAbilityProjectile('LEER', handPos, dir, scene, mapData.colliders, null);
    else if (key === 'REYNA_Q' || key === 'REYNA_E') { state.hp = Math.min(150, state.hp + 50); showBanner('SOUL HARVEST (+50 HP)'); }
    else if (key === 'OMEN_C') {
        playTeleportSound();
        camera.position.addScaledVector(dir, 14);
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -46, 46);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -50, 50);
    } else if (key === 'OMEN_Q') launchAbilityProjectile('LEER', handPos, dir, scene, mapData.colliders, null);
    else if (key === 'SOVA_C' || key === 'SOVA_E') {
        launchAbilityProjectile('RECON', handPos, dir, scene, mapData.colliders, () => {
            state.reconScanTimer = 4.0;
            showBanner('RECON SONAR // ENEMIES REVEALED');
        });
    } else if (key === 'SOVA_Q') {
        launchAbilityProjectile('SHOCK', handPos, dir, scene, mapData.colliders, (pos) => {
            bots.forEach(b => { if (b.alive && b.group.position.distanceTo(pos) < 5.5) b.hp -= 75; });
        });
    }

    if (!state.cheats.infAb) {
        if (slot === 'C') state.cCharges--;
        if (slot === 'Q') state.qCharges--;
        if (slot === 'E') {
            state.eReady = false;
            if (state.agent !== 'JETT') state.eCooldownTimer = 10.0;
        }
    }
    updateHUD();
}
function triggerUltimate() {
    if (!state.alive || (state.ultPoints < state.maxUlt && !state.cheats.infAb)) return;
    if (!state.cheats.infAb) state.ultPoints = 0;
    abilityCastTimer = 0.55;

    const vig = document.getElementById('ult-vignette');
    vig.style.opacity = '1';
    setTimeout(() => vig.style.opacity = '0', 3000);

    if (state.agent === 'JETT') {
        announceVoice('Watch this!');
        equipSlot('ULT');
    } else if (state.agent === 'PHOENIX') {
        announceVoice('Joke is over, you are dead!');
        state.phoenixAnchor = camera.position.clone();
        showBanner('RUN IT BACK ACTIVE');
    } else if (state.agent === 'REYNA') {
        announceVoice('They will cower!');
        state.hp = 150;
        showBanner('EMPRESS ACTIVE (150 HP)');
    } else if (state.agent === 'OMEN') {
        playTeleportSound();
        announceVoice('Scatter!');
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0, 0), camera);
        ray.far = 38;
        const surfHits = ray.intersectObjects(mapData.solidMeshes);
        if (surfHits.length > 0) {
            const pt = surfHits[0].point;
            const landingY = surfHits[0].face.normal.y > 0.5 ? pt.y + 1.7 : 1.7;
            camera.position.set(THREE.MathUtils.clamp(pt.x - ray.ray.direction.x * 0.8, -46, 46), landingY, THREE.MathUtils.clamp(pt.z - ray.ray.direction.z * 0.8, -50, 50));
        }
        showBanner('FROM THE SHADOWS // TELEPORTED');
    } else if (state.agent === 'SAGE') {
        announceVoice('Your duty is not over!');
        const deadAlly = bots.find(b => b.team === state.team && !b.alive);
        if (deadAlly) {
            deadAlly.alive = true; deadAlly.hp = 100; deadAlly.group.visible = true;
            deadAlly.group.position.copy(camera.position).add(new THREE.Vector3(2, -1.7, 0));
            showBanner(`RESURRECTED ${deadAlly.id}`);
        }
    } else if (state.agent === 'SOVA') {
        announceVoice('I am the hunter!');
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0, 0), camera);
        const end = ray.ray.origin.clone().addScaledVector(ray.ray.direction, 60);
        spawnTracer(camera.position, end, true);
        bots.forEach(b => {
            if (b.alive && b.team !== state.team && ray.ray.distanceToPoint(b.group.position) < 2.2) {
                b.hp -= 160;
                if (b.hp <= 0) { b.alive = false; animateCharacterDeath(b.group); }
            }
        });
    }
    updateHUD();
}

function gainUltPoint() {
    if (state.ultPoints < state.maxUlt) {
        state.ultPoints++;
        if (state.ultPoints === state.maxUlt) {
            playUltimateReady();
            announceVoice('Ultimate ready');
        }
        updateHUD();
    }
}
const replayBuffer = [];
const killCam = { active: false, frames: [], index: 0, killerId: '' };

function takeDamage(dmg, attacker, isHead = false) {
    if (!state.alive || state.phase === 'BUY') return;
    state.taggedTimer = 0.45;
    if (isHead) state.incomingHits.head++;
    else state.incomingHits.body++;

    if (isHead && state.shield < 50) {
        camera.rotation.x = Math.min(Math.PI / 2, camera.rotation.x + 0.075);
    }

    const hadShield = state.shield > 0;
    const absorbed = Math.min(state.shield, Math.floor(dmg * 0.66));
    state.shield -= absorbed;
    if (hadShield && state.shield === 0) playArmorBreak();

    state.hp = Math.max(0, state.hp - (dmg - absorbed));
    logCombat(`IN <- ${attacker}: ${dmg} (${isHead ? 'HEAD' : 'BODY'})`);

    const shooterBot = bots.find(b => b.id === attacker);
    if (shooterBot) {
        const toAttacker = shooterBot.group.position.clone().sub(camera.position);
        const worldAngle = Math.atan2(toAttacker.x, toAttacker.z);
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const lookAngle = Math.atan2(camDir.x, camDir.z);
        const arc = document.getElementById('damage-arc');
        arc.style.transform = `translate(-50%, -50%) rotate(${THREE.MathUtils.radToDeg(lookAngle - worldAngle)}deg)`;
        arc.classList.remove('hidden');
        setTimeout(() => arc.classList.add('hidden'), 450);
    }

    const dmgFx = document.getElementById('damage-screen');
    dmgFx.style.opacity = '1';
    setTimeout(() => dmgFx.style.opacity = '0', 260);
    updateHUD();

    if (state.hp === 0) {
        if (state.phoenixAnchor) {
            camera.position.copy(state.phoenixAnchor);
            state.phoenixAnchor = null;
            state.hp = 100;
            showBanner('RUN IT BACK // RETURNED');
            updateHUD();
            return;
        }
        state.alive = false;
        state.deaths++;
        state.primaryGun = null;
        state.shield = 0;
        addKillfeed(`${attacker} eliminated ${state.agent}`);

        if (replayBuffer.length > 10) {
            killCam.active = true;
            killCam.frames = replayBuffer.map(f => ({ playerPos: f.playerPos.clone(), bots: JSON.parse(JSON.stringify(f.bots)) }));
            killCam.index = 0;
            killCam.killerId = attacker;
            document.getElementById('kc-killer-name').innerText = attacker;
            document.getElementById('kc-weapon').innerText = 'VANDAL';
            document.getElementById('kc-hits').innerText = `${state.incomingHits.head} HEAD • ${state.incomingHits.body} BODY`;
            document.getElementById('kc-hp').innerText = shooterBot ? Math.max(1, Math.round(shooterBot.hp)) : '100';
            document.getElementById('killcam-overlay').classList.remove('hidden');
        }

        if (state.mode === 'DEATHMATCH' || state.mode === 'RANGE') {
            setTimeout(() => { state.alive = true; state.hp = 100; resetPlayerPosition(); updateHUD(); }, 2000);
        } else if (state.isHost) {
            checkEliminationWin();
        }
    }
}
function startRound(phase, fromNet = false) {
    state.phase = phase;
    state.timer = phase === 'BUY' ? 12 : 65;
    state.spikePlanted = false;
    state.spikeTimer = 45;
    state.defuseSaved = 0;
    state.roundStreak = 0;
    state.firstBloodClaimed = false;
    state.incomingHits = { head: 0, body: 0 };
    killCam.active = false;
    document.getElementById('killcam-overlay').classList.add('hidden');
    spikeMesh.visible = false;
    mapData.buyBarriers.forEach(b => b.mesh.visible = (phase === 'BUY'));

    if (phase === 'BUY') {
        boughtThisRound = [];
        state.alive = true;
        state.hp = 100;
        state.eReady = true;
        state.eCooldownTimer = 0;
        if (state.cheats.infCreds) state.credits = 9000;
        if (state.cheats.infAb) { state.cCharges = 2; state.qCharges = 2; state.ultPoints = 6; }

        ultOrbs.forEach(o => { o.active = true; o.mesh.visible = true; });
        bots.forEach((b, i) => {
            b.alive = true; b.hp = 100; b.group.visible = true; b.route = null; b.wpIndex = 0;
            b.group.position.set(-22 + (i % 5) * 11, 0, b.team === 'ATK' ? 38 : -38);
        });
        resetPlayerPosition();
        equipSlot(state.primaryGun ? 'PRIMARY' : 'SIDEARM');
        announceVoice('Buy phase');
        showBanner('BUY PHASE // PRESS [B] FOR ARMORY');
    } else {
        document.getElementById('buy-menu').classList.add('hidden');
        playBarrierDrop();
        announceVoice('Round start');
        showBanner('BARRIERS DOWN // COMBAT');
    }

    if (state.isHost && !fromNet) broadcast({ type: 'ROUND_START', phase });
    updateEconomyPreview();
    updateHUD();
}

function checkEliminationWin() {
    if (state.phase !== 'COMBAT') return;
    const atkAlive = (state.team === 'ATK' && state.alive ? 1 : 0) + bots.filter(b => b.team === 'ATK' && b.alive).length;
    const defAlive = (state.team === 'DEF' && state.alive ? 1 : 0) + bots.filter(b => b.team === 'DEF' && b.alive).length;
    if (atkAlive === 0 && !state.spikePlanted) endRound('DEF', 'ATTACKERS ELIMINATED');
    else if (defAlive === 0) endRound('ATK', 'DEFENDERS ELIMINATED');
}

function endRound(winningTeam, reason) {
    state.phase = 'END';
    timeScale = 0.35;
    setTimeout(() => { timeScale = 1.0; }, 1300);

    if (winningTeam === 'ATK') state.atkScore++;
    else state.defScore++;

    let roundIncome = 0;
    if (winningTeam === state.team) {
        state.lossStreak = 0;
        roundIncome = 3000;
    } else {
        state.lossStreak = Math.min(2, state.lossStreak + 1);
        const baseLoss = 1900 + state.lossStreak * 500;
        roundIncome = (state.team === 'ATK' && state.alive && !state.spikePlanted && reason === 'TIME EXPIRED') ? 1000 : baseLoss;
    }
    state.credits = Math.min(9000, state.credits + roundIncome);
    updateEconomyPreview();

    let specialTag = reason;
    if (winningTeam === state.team) {
        const alliesAlive = (state.alive ? 1 : 0) + bots.filter(b => b.team === state.team && b.alive).length;
        const totalAllies = 1 + bots.filter(b => b.team === state.team).length;
        if (alliesAlive === totalAllies) { specialTag = 'FLAWLESS'; announceVoice('Flawless'); }
        else if (alliesAlive === 1 && state.alive) { specialTag = 'CLUTCH'; announceVoice('Clutch'); }
    }

    const headline = winningTeam === state.team ? 'ROUND WON' : 'ROUND LOST';
    showBanner(`${headline} // ${specialTag}  |  NEXT ROUND: ¤ ${state.credits.toLocaleString()}`);
    updateHUD();

    setTimeout(() => {
        if (checkMatchVictory()) return;
        if (state.atkScore + state.defScore === 4 && !state.halftimeDone) {
            state.halftimeDone = true;
            state.team = state.team === 'ATK' ? 'DEF' : 'ATK';
            state.credits = 800; state.lossStreak = 0; state.primaryGun = null; state.shield = 0;
            announceVoice('Switching sides');
            showBanner('HALFTIME // SWITCHING SIDES');
        } else if (state.atkScore >= 6 && state.defScore >= 6) {
            state.credits = 5000; state.ultPoints = 6;
            state.team = state.team === 'ATK' ? 'DEF' : 'ATK';
            announceVoice('Overtime');
            showBanner('OVERTIME // WIN BY 2 (¤ 5,000 + FULL ULT)');
        }
        startRound('BUY');
    }, 3400);
}
function checkMatchVictory() {
    if (state.mode === 'DEATHMATCH' && state.kills >= 20) {
        showMatchEnd(true, `${state.agent} (YOU)`);
        return true;
    }
    if (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE') {
        const lead = Math.abs(state.atkScore - state.defScore);
        const isWin = (state.atkScore >= 7 || state.defScore >= 7) && (state.atkScore < 6 || state.defScore < 6 || lead >= 2);
        if (isWin) {
            const playerWon = (state.team === 'ATK' && state.atkScore > state.defScore) || (state.team === 'DEF' && state.defScore > state.atkScore);
            showMatchEnd(playerWon, `${state.agent} (YOU)`);
            return true;
        }
    }
    return false;
}

function showMatchEnd(playerWon, mvpLabel) {
    controls.unlock();
    const roundsPlayed = Math.max(1, state.atkScore + state.defScore);
    const acs = Math.round((state.totalDamage + state.kills * 50) / roundsPlayed);
    const hsPct = Math.round((state.headshots / Math.max(1, state.headshots + state.bodyshots)) * 100);
    let rrSummaryText = `${state.mode} MATCH COMPLETE`;

    if (state.mode === 'COMPETITIVE') {
        const perfBonus = (acs >= 220 || state.kills >= 12) ? 6 : 0;
        if (rankedProfile.placementsPlayed < 5) {
            rankedProfile.placementsPlayed++;
            if (playerWon) rankedProfile.placementWins++;
            if (rankedProfile.placementsPlayed === 5) {
                rankedProfile.rankIdx = Math.min(14, 6 + rankedProfile.placementWins * 2 + (perfBonus > 0 ? 1 : 0));
                rankedProfile.rr = 50;
                rrSummaryText = `CALIBRATED TO ${RANK_TIERS[rankedProfile.rankIdx].name}!`;
            } else {
                rrSummaryText = `PLACEMENT ${rankedProfile.placementsPlayed} OF 5 COMPLETE`;
            }
        } else if (playerWon) {
            const gain = 18 + Math.min(8, Math.abs(state.atkScore - state.defScore)) + perfBonus;
            rankedProfile.rr += gain;
            if (rankedProfile.rr >= 100 && rankedProfile.rankIdx < RANK_TIERS.length - 1) {
                rankedProfile.rr -= 100; rankedProfile.rankIdx++; announceVoice('Rank up');
                rrSummaryText = `+${gain} RR // RANK UP: ${RANK_TIERS[rankedProfile.rankIdx].name}!`;
            } else {
                rrSummaryText = `+${gain} RR${perfBonus ? ' (★ PERFORMANCE BONUS)' : ''} // ${RANK_TIERS[rankedProfile.rankIdx].name} (${rankedProfile.rr} RR)`;
            }
        } else {
            const loss = Math.max(10, 18 - perfBonus);
            if (rankedProfile.rr > 0) {
                rankedProfile.rr = Math.max(0, rankedProfile.rr - loss);
                rrSummaryText = `-${loss} RR // ${RANK_TIERS[rankedProfile.rankIdx].name} (${rankedProfile.rr} RR)${rankedProfile.rr === 0 ? ' [DEMOTION SHIELD]' : ''}`;
            } else if (rankedProfile.rankIdx > 0) {
                rankedProfile.rankIdx--; rankedProfile.rr = 75;
                rrSummaryText = `-${loss} RR // DEMOTED TO ${RANK_TIERS[rankedProfile.rankIdx].name}`;
            }
        }
        rankedProfile.history.unshift({
            mode: 'COMPETITIVE', map: state.map, agent: state.agent,
            score: `${state.atkScore} - ${state.defScore}`, kd: `${state.kills} / ${state.deaths}`,
            rrText: rrSummaryText.split('//')
        });
        rankedProfile.history = rankedProfile.history.slice(0, 10);
        saveRankedProfile();
        renderRankedUI();
    }

    document.getElementById('match-mvp-label').innerText = `★ MATCH MVP // ${mvpLabel}`;
    document.getElementById('match-result-title').innerText = playerWon ? 'VICTORY' : 'DEFEAT';
    document.getElementById('match-result-title').style.color = playerWon ? '#00ffcc' : '#ff4655';
    document.getElementById('rr-change-banner').innerText = rrSummaryText;
    document.getElementById('post-match-body').innerHTML = `
        <tr style="color:#00ffcc;"><td><b>${state.agent} (YOU)</b></td><td><b>${acs}</b></td><td>${state.kills} / ${state.deaths} / ${state.assists}</td><td>${hsPct}%</td><td>${state.firstBloods}</td></tr>
        ${bots.slice(0, 4).map(b => `<tr><td>${b.id}</td><td>${135 + b.kills * 35}</td><td>${b.kills} / ${b.deaths} / 1</td><td>19%</td><td>0</td></tr>`).join('')}
    `;
    document.getElementById('match-end-screen').classList.remove('hidden');
}
let boughtThisRound = [];

function updateEconomyPreview() {
    document.getElementById('credits-display').innerText = state.credits;
    document.getElementById('next-min').innerText = (state.credits + 1900).toLocaleString();
    document.getElementById('buy-c-charges').innerText = `CHARGES: ${state.cCharges} / 2`;
    document.getElementById('buy-q-charges').innerText = `CHARGES: ${state.qCharges} / 2`;
}

function refreshBuyMenuVisuals() {
    document.querySelectorAll('.val-card').forEach(card => {
        const cost = Number(card.dataset.cost);
        const gunName = card.dataset.gun;
        const armorType = card.dataset.armor;
        const abilityType = card.dataset.ability;

        const isOwned = (gunName && ((state.primaryGun && state.primaryGun.name === gunName) || state.sidearmGun.name === gunName))
                     || (armorType === 'LIGHT' && state.shield === 25)
                     || (armorType === 'HEAVY' && state.shield === 50);

        card.classList.toggle('owned', Boolean(isOwned));
        card.classList.toggle('unaffordable', !isOwned && state.credits < cost);

        if (gunName && WEAPONS[gunName]) {
            card.onmouseenter = () => {
                const w = WEAPONS[gunName];
                document.getElementById('insp-name').innerText = w.name;
                document.getElementById('insp-type').innerText = `${w.auto ? 'AUTOMATIC' : 'SEMI-AUTO'} // TIER ${w.penTier} PENETRATION`;
                document.getElementById('insp-head').innerText = w.head;
                document.getElementById('insp-body').innerText = w.dmg;
                document.getElementById('insp-mag').innerText = w.mag;
                document.getElementById('insp-rate').innerText = `${(1000 / w.rate).toFixed(1)} RDS/S`;
            };
        } else if (armorType) {
            card.onmouseenter = () => {
                const isHeavy = armorType === 'HEAVY';
                document.getElementById('insp-name').innerText = isHeavy ? 'HEAVY SHIELDS' : 'LIGHT SHIELDS';
                document.getElementById('insp-type').innerText = '66% DAMAGE ABSORPTION';
                document.getElementById('insp-head').innerText = isHeavy ? '+50 HP' : '+25 HP';
                document.getElementById('insp-body').innerText = 'BLOCKS AIM-PUNCH';
                document.getElementById('insp-mag').innerText = 'PERSISTS';
                document.getElementById('insp-rate').innerText = isHeavy ? '¤ 1,000' : '¤ 400';
            };
        } else if (abilityType) {
            card.onmouseenter = () => {
                const names = AGENT_ABILITY_NAMES[state.agent] || AGENT_ABILITY_NAMES.JETT;
                const isC = abilityType === 'C_CHARGE';
                document.getElementById('insp-name').innerText = isC ? names.C : names.Q;
                document.getElementById('insp-type').innerText = `${state.agent} // BASIC ABILITY`;
                document.getElementById('insp-head').innerText = 'MAX 2';
                document.getElementById('insp-body').innerText = 'CARRIES OVER';
                document.getElementById('insp-mag').innerText = isC ? `${state.cCharges}/2` : `${state.qCharges}/2`;
                document.getElementById('insp-rate').innerText = isC ? '¤ 150' : '¤ 200';
            };
        }
    });
}
document.querySelectorAll('.val-card').forEach(item => {
    item.onclick = () => {
        const cost = Number(item.dataset.cost);
        if (state.credits < cost) return;

        if (item.dataset.ability === 'C_CHARGE') {
            if (state.cCharges >= state.maxCCharges) return;
            state.credits -= cost; state.cCharges++;
            boughtThisRound.push({ type: 'C_CHARGE', name: 'C_CHARGE', cost });
        } else if (item.dataset.ability === 'Q_CHARGE') {
            if (state.qCharges >= state.maxQCharges) return;
            state.credits -= cost; state.qCharges++;
            boughtThisRound.push({ type: 'Q_CHARGE', name: 'Q_CHARGE', cost });
        } else if (item.dataset.gun) {
            state.credits -= cost;
            const w = WEAPONS[item.dataset.gun];
            boughtThisRound.push({ type: 'GUN', name: item.dataset.gun, cost });
            if (item.dataset.gun === 'CLASSIC' || item.dataset.gun === 'SHERIFF') { state.sidearmGun = w; equipSlot('SIDEARM'); }
            else { state.primaryGun = w; equipSlot('PRIMARY'); }
        } else if (item.dataset.armor) {
            state.credits -= cost;
            boughtThisRound.push({ type: 'ARMOR', name: item.dataset.armor, cost });
            state.shield = item.dataset.armor === 'HEAVY' ? 50 : 25;
        }
        updateEconomyPreview();
        refreshBuyMenuVisuals();
        updateHUD();
    };

    item.oncontextmenu = (e) => {
        e.preventDefault();
        if (state.phase !== 'BUY') return;
        const targetName = item.dataset.gun || item.dataset.armor || item.dataset.ability;
        const idx = boughtThisRound.findIndex(b => b.name === targetName);
        if (idx > -1) {
            const refunded = boughtThisRound.splice(idx, 1);
            state.credits += refunded.cost;
            if (refunded.type === 'GUN') {
                if (refunded.name === 'SHERIFF') { state.sidearmGun = WEAPONS.CLASSIC; equipSlot('SIDEARM'); }
                else { state.primaryGun = null; equipSlot('SIDEARM'); }
            } else if (refunded.type === 'ARMOR') { state.shield = 0; }
            else if (refunded.type === 'C_CHARGE') { state.cCharges--; }
            else if (refunded.type === 'Q_CHARGE') { state.qCharges--; }
            updateEconomyPreview();
            refreshBuyMenuVisuals();
            updateHUD();
            showBanner(`REFUNDED ${targetName} (+¤ ${refunded.cost})`);
        } else if (item.dataset.gun) {
            broadcast({ type: 'REQUEST_WEAPON', gun: item.dataset.gun });
            showBanner(`REQUESTED ${item.dataset.gun} FROM TEAM`);
        }
    };
});

document.getElementById('req-weapon-btn').onclick = () => {
    broadcast({ type: 'REQUEST_WEAPON', gun: 'VANDAL' });
    showBanner('REQUESTED VANDAL FROM TEAM');
};

function renderTeamEconomy() {
    const list = document.getElementById('team-econ-list');
    const teammates = Object.entries(remotePlayers).filter(([_, p]) => p.team === state.team);
    list.innerHTML = teammates.length === 0 ? '<p class="hint">Allies synced when connected</p>' : teammates.map(([id, p]) => {
        const req = weaponRequests[id];
        return `<div style="background:#0f1923; padding:6px 8px; border-left:3px solid #00ffcc; font-size:0.75rem;">
            <b>${p.agent || 'ALLY'}</b> • ¤ ${p.credits || 800} (${p.gunName || 'CLASSIC'})
            ${req ? `<button class="pill gift-btn" data-id="${id}" data-gun="${req}" style="margin-top:4px; width:100%; border-color:#facc15; color:#facc15;">BUY ${req}</button>` : ''}
        </div>`;
    }).join('');
    document.querySelectorAll('.gift-btn').forEach(btn => {
        btn.onclick = () => {
            const cost = WEAPONS[btn.dataset.gun]?.cost || 2900;
            if (state.credits >= cost) {
                state.credits -= cost;
                broadcast({ type: 'GIFT_WEAPON', target: btn.dataset.id, gun: btn.dataset.gun });
                delete weaponRequests[btn.dataset.id];
                updateEconomyPreview(); renderTeamEconomy();
            }
        };
    });
}
function dropWeaponOnGround(gunObj, pos) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.65), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    mesh.position.set(pos.x, 0.15, pos.z);
    scene.add(mesh);
    droppedWeapons.push({ gun: gunObj, mesh });
}

function interactWorld() {
    for (let i = droppedWeapons.length - 1; i >= 0; i--) {
        if (camera.position.distanceTo(droppedWeapons[i].mesh.position) < 2.5) {
            if (state.primaryGun) dropWeaponOnGround(state.primaryGun, camera.position);
            state.primaryGun = droppedWeapons[i].gun;
            scene.remove(droppedWeapons[i].mesh);
            droppedWeapons.splice(i, 1);
            equipSlot('PRIMARY');
            return;
        }
    }
    if (mapData.teleporters) {
        for (const tp of mapData.teleporters) {
            if (camera.position.distanceTo(tp.pos) < 2.6) {
                camera.position.copy(tp.dest);
                playTeleportSound();
                showBanner('TELEPORTED');
                return;
            }
        }
    }
}

function placeTacticalPing() {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = ray.intersectObjects(mapData.solidMeshes);
    const pt = hits.length > 0 ? hits.point : ray.ray.origin.clone().addScaledVector(ray.ray.direction, 25);
    spawnPingBeacon(pt);
    broadcast({ type: 'PING', x: pt.x, z: pt.z });
}

function spawnPingBeacon(pos) {
    playPingSound();
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 10, 12),
        new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.7 })
    );
    beam.position.set(pos.x, 5, pos.z);
    scene.add(beam);
    setTimeout(() => scene.remove(beam), 4000);
}

function createSprayTexture(agentName) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(15, 25, 35, 0.85)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#00ffcc'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#ff4655'; g.font = 'bold 24px sans-serif'; g.textAlign = 'center'; g.fillText(agentName, 64, 60);
    g.fillStyle = '#ece8e1'; g.font = 'bold 14px sans-serif'; g.fillText('VALOR // 01', 64, 84);
    return new THREE.CanvasTexture(c);
}

function spraySurface() {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    ray.far = 4.5;
    const hits = ray.intersectObjects(mapData.solidMeshes);
    if (hits.length === 0) return;
    if (activeSprayMesh) scene.remove(activeSprayMesh);
    const hit = hits;
    const spray = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 1.4),
        new THREE.MeshBasicMaterial({ map: createSprayTexture(state.agent), transparent: true, polygonOffset: true, polygonOffsetFactor: -1 })
    );
    spray.position.copy(hit.point).addScaledVector(hit.face.normal, 0.02);
    spray.lookAt(hit.point.clone().add(hit.face.normal));
    scene.add(spray);
    activeSprayMesh = spray;
    playPingSound();
}
const showTracers = () => document.getElementById('tracer-toggle').checked;

function spawnTracer(start, end, isWallbang = false) {
    if (!showTracers()) return;
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: isWallbang ? 0xff4655 : 0xfef08a });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    setTimeout(() => scene.remove(line), 70);
}

function spawnFloatingDamage(worldPos, dmg, isHead) {
    const vec = worldPos.clone().project(camera);
    if (vec.z > 1) return;
    const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vec.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.innerText = isHead ? `-${dmg} CRIT!` : `-${dmg}`;
    el.style.cssText = `position:absolute; left:${x}px; top:${y}px; color:${isHead ? '#ff4655' : '#ece8e1'}; font-weight:900; font-size:${isHead ? '1.25rem' : '0.95rem'}; text-shadow:0 2px 4px #000; transition:all 0.65s ease-out;`;
    document.getElementById('damage-numbers-layer').appendChild(el);
    requestAnimationFrame(() => { el.style.top = `${y - 45}px`; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 650);
}

function triggerKillBanner(streak) {
    const romans = ['I', 'II', 'III', 'IV', 'V'];
    const labels = ['1 KILL', 'DOUBLE KILL', 'TRIPLE KILL', 'QUADRA KILL', 'ACE!'];
    if (streak === 5) announceVoice('Ace!');
    const kb = document.getElementById('kill-banner');
    document.getElementById('kill-roman').innerText = romans[Math.min(streak - 1, 4)];
    document.getElementById('kill-text').innerText = labels[Math.min(streak - 1, 4)];
    document.getElementById('kill-wings').classList.toggle('active', streak >= 2);
    document.getElementById('ace-crown').classList.toggle('hidden', streak < 5);
    kb.classList.remove('hidden');
    setTimeout(() => kb.classList.add('hidden'), 1800);
}

function resetPlayerPosition() {
    camera.position.set(0, 1.7, state.team === 'ATK' ? 40 : -40);
    camera.rotation.set(0, state.team === 'ATK' ? 0 : Math.PI, 0);
}
function updateHUD() {
    document.getElementById('hud-hp').innerText = state.hp;
    document.getElementById('hud-shield').innerText = state.shield;
    document.getElementById('hud-gun').innerText = `${state.gun.name} [${state.skin}]`;
    document.getElementById('hud-ammo').innerText = state.ammo;
    document.getElementById('hud-mag').innerText = state.gun.mag;
    document.getElementById('atk-score').innerText = state.atkScore;
    document.getElementById('def-score').innerText = state.defScore;
    document.getElementById('phase-label').innerText = state.spikePlanted ? 'SPIKE PLANTED' : `${state.phase} PHASE`;

    if (state.spikePlanted) {
        document.getElementById('round-timer').innerHTML = '<span style="color:#ff4655; letter-spacing:2px;">⚠ SPIKE</span>';
    } else {
        const mins = Math.floor(state.timer / 60);
        const secs = String(state.timer % 60).padStart(2, '0');
        document.getElementById('round-timer').innerText = `${mins}:${secs}`;
    }

    const names = AGENT_ABILITY_NAMES[state.agent] || AGENT_ABILITY_NAMES.JETT;
    document.getElementById('c-name').innerText = names.C;
    document.getElementById('q-name').innerText = names.Q;
    document.getElementById('e-name').innerText = names.E;
    document.getElementById('x-name').innerText = names.X;

    document.getElementById('c-pips').innerText = '■'.repeat(state.cCharges) + '□'.repeat(state.maxCCharges - state.cCharges);
    document.getElementById('q-pips').innerText = '■'.repeat(state.qCharges) + '□'.repeat(state.maxQCharges - state.qCharges);
    document.getElementById('e-cd').innerText = state.eReady ? 'READY' : (state.agent === 'JETT' ? `${state.jettDashKills}/2 KILLS` : `${Math.ceil(state.eCooldownTimer)}s`);
    document.getElementById('ult-pts').innerText = `${state.ultPoints}/${state.maxUlt}`;

    document.getElementById('slot-c').className = `ab-box ${state.cCharges > 0 ? 'ready' : 'cooldown'}`;
    document.getElementById('slot-q').className = `ab-box ${state.qCharges > 0 ? 'ready' : 'cooldown'}`;
    document.getElementById('slot-e').className = `ab-box ${state.eReady ? 'ready' : 'cooldown'}`;
    document.getElementById('slot-x').className = `ab-box ult ${state.ultPoints >= state.maxUlt ? 'ready' : ''}`;
    updateTopAgentStrips();
}

function updateTopAgentStrips() {
    const allyAgents = [
        { label: state.agent.slice(0, 3), alive: state.alive, ultReady: state.ultPoints >= 6 },
        ...bots.filter(b => b.team === state.team).map((b, i) => ({
            label: ['SAG', 'OME', 'SOV', 'REY'][i % 4], alive: b.alive, ultReady: (state.atkScore + state.defScore) % 3 === 2
        }))
    ];
    const enemyAgents = bots.filter(b => b.team !== state.team).map((b, i) => ({
        label: ['JET', 'PHO', 'OME', 'SAG', 'SOV'][i % 5], alive: b.alive, ultReady: (state.atkScore + state.defScore) % 3 === 1
    }));

    document.getElementById('ally-strip').innerHTML = allyAgents.map(a =>
        `<div class="agent-pip ${a.alive ? '' : 'dead'}" style="${a.ultReady && a.alive ? 'border:1px solid #facc15; box-shadow:0 0 8px rgba(250,204,21,0.5);' : ''}">${a.label}</div>`
    ).join('');
    document.getElementById('enemy-strip').innerHTML = enemyAgents.map(e =>
        `<div class="agent-pip enemy ${e.alive ? '' : 'dead'}" style="${e.ultReady && e.alive ? 'border:1px solid #facc15;' : ''}">${e.label}</div>`
    ).join('');
}
const chatInput = document.getElementById('chat-input');
const chatLog = document.getElementById('chat-log');

function appendChat(sender, text, color = '#00ffcc') {
    const line = document.createElement('div');
    line.style.cssText = `background:rgba(15,25,35,0.72); padding:3px 8px; border-left:2px solid ${color};`;
    line.innerHTML = `<b style="color:${color}">${sender}:</b> ${text}`;
    chatLog.appendChild(line);
    setTimeout(() => line.remove(), 9000);
}

chatInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter') {
        const msg = chatInput.value.trim();
        if (msg) {
            appendChat(`${state.agent} (YOU)`, msg, '#00ffcc');
            broadcast({ type: 'CHAT', agent: state.agent, msg });
        }
        chatInput.value = '';
        chatInput.classList.add('hidden');
        lockPointerWithRawInput();
    }
});

function addKillfeed(text) {
    const el = document.createElement('div');
    el.className = 'kf-entry';
    el.innerText = text;
    document.getElementById('killfeed').appendChild(el);
    setTimeout(() => el.remove(), 4500);
}

function showBanner(text) {
    const b = document.getElementById('center-banner');
    b.innerText = text;
    b.classList.remove('hidden');
    setTimeout(() => b.classList.add('hidden'), 2600);
}

function logCombat(text) {
    const div = document.createElement('div');
    div.innerText = text;
    document.getElementById('cr-list').prepend(div);
}

function renderScoreboard() {
    const rows = [
        `<tr><td><b>${state.agent} (YOU)</b></td><td>${state.team}</td><td>${state.kills} / ${state.deaths} / ${state.assists}</td><td>¤ ${state.credits}</td><td>19ms</td></tr>`,
        ...bots.map(b => `<tr><td>${b.id}</td><td>${b.team}</td><td>${b.kills} / ${b.deaths} / 1</td><td>¤ 2900</td><td>24ms</td></tr>`)
    ];
    document.getElementById('sb-body').innerHTML = rows.join('');
}

function updateAllyNameplates() {
    const layer = document.getElementById('ally-plates-layer');
    if ((state.mode !== 'UNRATED' && state.mode !== 'COMPETITIVE') || !state.alive) { layer.innerHTML = ''; return; }
    let html = '';
    bots.filter(b => b.team === state.team && b.alive).forEach(ally => {
        const pos = ally.group.position.clone().add(new THREE.Vector3(0, 2.05, 0));
        pos.project(camera);
        if (pos.z < 1) {
            const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
            html += `<div style="position:absolute; left:${x}px; top:${y}px; transform:translate(-50%,-100%); text-align:center; font-size:0.68rem; font-weight:bold; color:#00ffcc; text-shadow:0 1px 3px #000;">
                <div>${ally.id}</div><div style="width:36px; height:3px; background:#1e293b; margin:2px auto;"><div style="width:${ally.hp}%; height:100%; background:#00ffcc;"></div></div>
            </div>`;
        }
    });
    layer.innerHTML = html;
}
function applyCrosshairSettings() {
    const color = document.getElementById('ch-color').value;
    const len = document.getElementById('ch-len').value;
    const thick = document.getElementById('ch-thick').value;
    const showDot = document.getElementById('ch-dot').checked;
    document.querySelectorAll('.ch-line').forEach(l => l.style.background = color);
    document.getElementById('ch-top').style.height = `${len}px`;
    document.getElementById('ch-bottom').style.height = `${len}px`;
    document.getElementById('ch-left').style.width = `${len}px`;
    document.getElementById('ch-right').style.width = `${len}px`;
    document.getElementById('ch-top').style.width = `${thick}px`;
    document.getElementById('ch-bottom').style.width = `${thick}px`;
    document.getElementById('ch-left').style.height = `${thick}px`;
    document.getElementById('ch-right').style.height = `${thick}px`;
    const dot = document.getElementById('ch-dot');
    dot.style.background = color;
    dot.classList.toggle('hidden', !showDot);
}
['ch-color', 'ch-len', 'ch-thick', 'ch-dot'].forEach(id => document.getElementById(id).oninput = applyCrosshairSettings);

document.getElementById('ch-apply-code').onclick = () => {
    const raw = document.getElementById('ch-code-input').value.split(';');
    const getVal = (k) => { const i = raw.indexOf(k); return i > -1 ? raw[i + 1] : null; };
    if (getVal('c')) document.getElementById('ch-color').value = getVal('c');
    if (getVal('l')) document.getElementById('ch-len').value = getVal('l');
    if (getVal('t')) document.getElementById('ch-thick').value = getVal('t');
    if (getVal('d')) document.getElementById('ch-dot').checked = getVal('d') === '1';
    applyCrosshairSettings();
    showBanner('CROSSHAIR IMPORTED');
};

document.querySelectorAll('.pro-ch-btn').forEach(btn => {
    btn.onclick = () => {
        document.getElementById('ch-code-input').value = btn.dataset.code;
        document.getElementById('ch-apply-code').click();
    };
});

document.getElementById('rt-quality').onchange = (e) => {
    if (!rtController) return;
    const q = e.target.value;
    rtController.setQuality(q);
    const autoBloom = (q === 'MEDIUM' || q === 'HIGH');
    bloomEnabled = autoBloom;
    document.getElementById('bloom-toggle').checked = autoBloom;
    showBanner(`RAY TRACING // ${q}`);
};

document.getElementById('bloom-toggle').onchange = (e) => { bloomEnabled = e.target.checked; };
document.getElementById('res-scale').onchange = (e) => {
    const scale = Number(e.target.value);
    renderer.setSize(window.innerWidth * scale, window.innerHeight * scale, false);
    composer.setSize(window.innerWidth * scale, window.innerHeight * scale);
};

document.getElementById('cheat-inf-creds').onchange = (e) => {
    if (!areCheatsAllowed()) { e.target.checked = false; return; }
    state.cheats.infCreds = e.target.checked;
    if (state.cheats.infCreds) { state.credits = 9000; updateEconomyPreview(); updateHUD(); }
};
document.getElementById('cheat-inf-ab').onchange = (e) => {
    if (!areCheatsAllowed()) { e.target.checked = false; return; }
    state.cheats.infAb = e.target.checked;
    if (state.cheats.infAb) { state.cCharges = 2; state.qCharges = 2; state.ultPoints = 6; updateHUD(); }
};
document.getElementById('cheat-restart-round').onclick = () => {
    if (!areCheatsAllowed()) return;
    toggleSettingsMenu();
    startRound('BUY');
};
function toggleBuyMenu() {
    const bm = document.getElementById('buy-menu');
    const opening = bm.classList.contains('hidden');
    bm.classList.toggle('hidden');
    if (opening) {
        updateEconomyPreview();
        refreshBuyMenuVisuals();
        renderTeamEconomy();
        controls.unlock();
    } else {
        lockPointerWithRawInput();
    }
}

function toggleSettingsMenu() {
    const sm = document.getElementById('settings-menu');
    const opening = sm.classList.contains('hidden');
    sm.classList.toggle('hidden');
    if (opening) {
        syncCheatLockState();
        controls.unlock();
    } else {
        lockPointerWithRawInput();
    }
}
document.getElementById('close-settings-btn').onclick = toggleSettingsMenu;

document.querySelectorAll('.comm-opt').forEach(btn => {
    btn.onclick = () => {
        document.getElementById('comms-wheel').classList.add('hidden');
        addKillfeed(`[RADIO] ${state.agent}: ${btn.dataset.msg}`);
        broadcast({ type: 'RADIO', agent: state.agent, msg: btn.dataset.msg });
        lockPointerWithRawInput();
    };
});

const minimapCtx = document.getElementById('minimap').getContext('2d');
const fullMapCanvas = document.getElementById('full-map-canvas');
const fullMapCtx = fullMapCanvas.getContext('2d');

function drawMinimap(now) {
    minimapCtx.clearRect(0, 0, 160, 176);
    minimapCtx.fillStyle = '#364554';
    minimapCtx.fillRect(42, 60, 22, 56);
    minimapCtx.fillRect(96, 60, 22, 56);

    minimapCtx.fillStyle = 'rgba(255, 70, 85, 0.35)';
    if (state.map === 'HAVEN' || state.map === 'LOTUS') {
        minimapCtx.fillRect(14, 34, 24, 24);
        minimapCtx.fillRect(68, 34, 24, 24);
        minimapCtx.fillRect(122, 34, 24, 24);
        minimapCtx.fillStyle = '#ece8e1';
        minimapCtx.font = 'bold 11px sans-serif';
        minimapCtx.fillText('A', 22, 50);
        minimapCtx.fillText('B', 76, 50);
        minimapCtx.fillText('C', 130, 50);
    } else {
        minimapCtx.fillRect(14, 34, 24, 24);
        minimapCtx.fillRect(122, 34, 24, 24);
        minimapCtx.fillStyle = '#ece8e1';
        minimapCtx.font = 'bold 11px sans-serif';
        minimapCtx.fillText('A', 22, 50);
        minimapCtx.fillText('B', 130, 50);
    }

    ultOrbs.forEach(orb => {
        if (!orb.active) return;
        const ox = (orb.mesh.position.x + 50) * 1.6;
        const oz = (orb.mesh.position.z + 55) * 1.6;
        minimapCtx.fillStyle = '#00ffcc';
        minimapCtx.fillRect(ox - 3, oz - 3, 6, 6);
    });

    if (state.spikePlanted) {
        const sx = (spikeMesh.position.x + 50) * 1.6;
        const sz = (spikeMesh.position.z + 55) * 1.6;
        minimapCtx.fillStyle = Math.floor(now / 250) % 2 === 0 ? '#ff4655' : '#facc15';
        minimapCtx.beginPath();
        minimapCtx.arc(sx, sz, 5, 0, Math.PI * 2);
        minimapCtx.fill();
    }
    const radarRay = new THREE.Raycaster();
    bots.forEach(b => {
        if (!b.alive) return;
        const isAlly = (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE') && b.team === state.team;
        if (isAlly) {
            const mx = (b.group.position.x + 50) * 1.6;
            const mz = (b.group.position.z + 55) * 1.6;
            minimapCtx.fillStyle = '#00ffcc';
            minimapCtx.beginPath();
            minimapCtx.arc(mx, mz, 3.5, 0, Math.PI * 2);
            minimapCtx.fill();
            return;
        }

        const toBot = b.group.position.clone().sub(camera.position);
        const dist = toBot.length();
        radarRay.set(camera.position, toBot.normalize());
        radarRay.far = dist;
        const blocked = radarRay.intersectObjects(mapData.solidMeshes).length > 0;

        if (!blocked || state.reconScanTimer > 0) {
            b.lastSpottedPos = { x: b.group.position.x, z: b.group.position.z };
            const mx = (b.group.position.x + 50) * 1.6;
            const mz = (b.group.position.z + 55) * 1.6;
            minimapCtx.fillStyle = '#ff4655';
            minimapCtx.beginPath();
            minimapCtx.arc(mx, mz, 4, 0, Math.PI * 2);
            minimapCtx.fill();
        } else if (b.lastSpottedPos) {
            const lx = (b.lastSpottedPos.x + 50) * 1.6;
            const lz = (b.lastSpottedPos.z + 55) * 1.6;
            minimapCtx.fillStyle = '#facc15';
            minimapCtx.font = 'bold 10px sans-serif';
            minimapCtx.fillText('?', lx - 3, lz + 4);
        }
    });

    const px = (camera.position.x + 50) * 1.6;
    const pz = (camera.position.z + 55) * 1.6;
    minimapCtx.fillStyle = '#facc15';
    minimapCtx.beginPath();
    minimapCtx.arc(px, pz, 4.5, 0, Math.PI * 2);
    minimapCtx.fill();

    const callout = document.getElementById('callout-label');
    if (camera.position.z < -20 && camera.position.x < -15) callout.innerText = 'A SITE';
    else if (camera.position.z < -20 && camera.position.x > 15) callout.innerText = 'B SITE';
    else if (camera.position.z > 24) callout.innerText = 'ATTACKER SPAWN';
    else if (camera.position.z < -36) callout.innerText = 'DEFENDER SPAWN';
    else callout.innerText = 'MID COURTYARD';
}

function drawFullTacticalMap() {
    fullMapCtx.clearRect(0, 0, 420, 462);
    fullMapCtx.fillStyle = '#364554';
    fullMapCtx.fillRect(110, 157, 58, 147);
    fullMapCtx.fillRect(252, 157, 58, 147);
    fullMapCtx.fillStyle = 'rgba(255, 70, 85, 0.35)';
    fullMapCtx.fillRect(36, 90, 64, 64);
    fullMapCtx.fillRect(320, 90, 64, 64);
    fullMapCtx.fillStyle = '#ece8e1';
    fullMapCtx.font = 'bold 22px sans-serif';
    fullMapCtx.fillText('A SITE', 44, 130);
    fullMapCtx.fillText('B SITE', 326, 130);

    bots.forEach(b => {
        if (!b.alive) return;
        const mx = (b.group.position.x + 50) * 4.2;
        const mz = (b.group.position.z + 55) * 4.2;
        fullMapCtx.fillStyle = b.team === state.team ? '#00ffcc' : '#ff4655';
        fullMapCtx.beginPath();
        fullMapCtx.arc(mx, mz, 7, 0, Math.PI * 2);
        fullMapCtx.fill();
    });

    const px = (camera.position.x + 50) * 4.2;
    const pz = (camera.position.z + 55) * 4.2;
    fullMapCtx.fillStyle = '#facc15';
    fullMapCtx.beginPath();
    fullMapCtx.arc(px, pz, 9, 0, Math.PI * 2);
    fullMapCtx.fill();
}

fullMapCanvas.onclick = (e) => {
    const rect = fullMapCanvas.getBoundingClientRect();
    const worldX = ((e.clientX - rect.left) / 4.2) - 50;
    const worldZ = ((e.clientY - rect.top) / 4.2) - 55;
    spawnPingBeacon(new THREE.Vector3(worldX, 0, worldZ));
    broadcast({ type: 'PING', x: worldX, z: worldZ });
    drawFullTacticalMap();
};
const keys = {};
let specIndex = 0;
let specFreeCam = false;

document.addEventListener('keydown', (e) => {
    if (listeningAction) {
        e.preventDefault();
        keybinds[listeningAction] = e.code;
        localStorage.setItem('valor_keybinds', JSON.stringify(keybinds));
        listeningAction = null;
        renderKeybindUI();
        return;
    }

    keys[e.code] = true;
    if (e.code === 'ControlLeft') state.isCrouching = true;

    if (e.code === 'Space' && killCam.active) {
        killCam.active = false;
        document.getElementById('killcam-overlay').classList.add('hidden');
        viewmodelHolder.visible = false;
        return;
    }
    if (e.code === 'Space' && !state.alive && !killCam.active) {
        specFreeCam = !specFreeCam;
        if (specFreeCam) lockPointerWithRawInput();
        return;
    }

    if (e.code === 'KeyB' && (state.phase === 'BUY' || state.mode === 'DEATHMATCH' || state.mode === 'RANGE' || state.mode === 'CUSTOM')) toggleBuyMenu();
    if (e.code === 'KeyP') toggleSettingsMenu();
    if (e.code === 'Digit1' && state.primaryGun) equipSlot('PRIMARY');
    if (e.code === 'Digit2') equipSlot('SIDEARM');
    if (e.code === 'Digit3') equipSlot('KNIFE');
    if (e.code === 'KeyY') inspectTimer = 2.2;
    if (e.code === 'KeyN') document.getElementById('combat-report').classList.toggle('hidden');

    if (e.code === 'Tab') {
        e.preventDefault();
        renderScoreboard();
        document.getElementById('scoreboard').classList.remove('hidden');
    }
    if (e.code === 'CapsLock') {
        e.preventDefault();
        controls.unlock();
        document.getElementById('full-map-overlay').classList.remove('hidden');
        drawFullTacticalMap();
    }
    if (e.code === 'Comma') {
        controls.unlock();
        document.getElementById('comms-wheel').classList.remove('hidden');
    }
    if (e.code === 'Enter') {
        controls.unlock();
        chatInput.classList.remove('hidden');
        chatInput.focus();
    }
    if (e.code === 'F5' && (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE')) {
        appendChat('SYSTEM', 'Surrender vote passed (4-1).', '#ff4655');
        endRound(state.team === 'ATK' ? 'DEF' : 'ATK', 'TEAM SURRENDERED');
    }
    if (e.code === 'KeyV' && areCheatsAllowed() && document.getElementById('cheat-ghost').checked) {
        state.cheats.ghostActive = !state.cheats.ghostActive;
        showBanner(state.cheats.ghostActive ? 'GHOST NOCLIP // ON' : 'GHOST NOCLIP // OFF');
    }
    if (e.code === 'Digit4' && state.team === 'DEF' && state.spikePlanted && camera.position.distanceTo(spikeMesh.position) < 3.5) {
        playDefuseHalfway();
    }

    if (e.code === keybinds.RELOAD && state.equippedSlot !== 'KNIFE' && state.equippedSlot !== 'ULT') reload();
    if (e.code === keybinds.ABILITY_C) triggerAbility('C');
    if (e.code === keybinds.ABILITY_Q) triggerAbility('Q');
    if (e.code === keybinds.ABILITY_E) triggerAbility('E');
    if (e.code === keybinds.ULTIMATE) triggerUltimate();
    if (e.code === keybinds.DROP && state.primaryGun && state.alive) {
        dropWeaponOnGround(state.primaryGun, camera.position);
        state.primaryGun = null;
        equipSlot('SIDEARM');
    }
    if (e.code === keybinds.INTERACT && state.alive) interactWorld();
    if (e.code === keybinds.PING && controls.isLocked) placeTacticalPing();
    if (e.code === keybinds.SPRAY && controls.isLocked) spraySurface();
});
document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'ControlLeft') state.isCrouching = false;
    if (e.code === 'Tab') document.getElementById('scoreboard').classList.add('hidden');
    if (e.code === 'CapsLock') {
        document.getElementById('full-map-overlay').classList.add('hidden');
        lockPointerWithRawInput();
    }
    if (e.code === 'Comma') {
        document.getElementById('comms-wheel').classList.add('hidden');
        lockPointerWithRawInput();
    }
});

document.addEventListener('mousedown', (e) => {
    if (!state.alive && !killCam.active && e.button === 0) {
        specIndex++;
        return;
    }
    if (!controls.isLocked) return;

    if (state.omenPhasing) {
        if (e.button === 0) state.omenDist = Math.min(48, state.omenDist + 6);
        if (e.button === 2) state.omenDist = Math.max(6, state.omenDist - 6);
        return;
    }

    if (e.button === 0) {
        isFiring = true;
        shoot();
    }

    if (e.button === 2 && state.equippedSlot !== 'KNIFE' && state.equippedSlot !== 'ULT') {
        if (state.gun.name === 'CLASSIC') {
            for (let b = 0; b < 3; b++) {
                if (state.ammo > 0) {
                    lastShot = 0;
                    state.recoilYaw += (Math.random() - 0.5) * 0.04;
                    state.recoilPitch += (Math.random() - 0.5) * 0.04;
                    shoot();
                }
            }
            return;
        }

        if (state.gun.name === 'OPERATOR') {
            state.zoomLevel = (state.zoomLevel + 1) % 3;
            state.isADS = state.zoomLevel > 0;
            camera.fov = state.zoomLevel === 1 ? 26 : (state.zoomLevel === 2 ? 12 : 75);
            document.getElementById('scope-zoom-label').innerText = state.zoomLevel === 2 ? '5.0X // DOUBLE ZOOM' : '2.5X // SINGLE ZOOM';
            document.getElementById('sniper-scope').classList.toggle('hidden', !state.isADS);
            viewmodelHolder.visible = !state.isADS;
        } else if (state.gun.name === 'MARSHAL') {
            state.isADS = !state.isADS;
            state.zoomLevel = state.isADS ? 1 : 0;
            camera.fov = state.isADS ? 22 : 75;
            document.getElementById('scope-zoom-label').innerText = '3.5X // MARSHAL OPTIC';
            document.getElementById('sniper-scope').classList.toggle('hidden', !state.isADS);
            viewmodelHolder.visible = !state.isADS;
        } else {
            state.isADS = !state.isADS;
            state.zoomLevel = state.isADS ? 1 : 0;
            camera.fov = state.isADS ? 58 : 75;
        }

        controls.pointerSpeed = state.isADS ? aimSettings.sens * aimSettings.adsMult : aimSettings.sens;
        camera.updateProjectionMatrix();
    }
});

document.addEventListener('mouseup', () => {
    isFiring = false;
});
const velocity = new THREE.Vector3();
let canJump = false;
let prevTime = performance.now();
let secondTick = 0;
let stepTick = 0;
let spikeBeepTick = 0;
let actionHold = 0;
let netTick = 0;
let airPeakY = 1.7;
let timeScale = 1.0;
let hbTimer = 0;
let fpsFrames = 0;
let fpsLastTime = performance.now();

function recordReplaySnapshot(timeSec) {
    const botPositions = {};
    bots.forEach(b => {
        botPositions[b.id] = { x: b.group.position.x, y: b.group.position.y, z: b.group.position.z, ry: b.group.rotation.y };
    });
    replayBuffer.push({ t: timeSec, playerPos: camera.position.clone(), bots: botPositions });
    while (replayBuffer.length > 0 && timeSec - replayBuffer.t > 3.5) {
        replayBuffer.shift();
    }
}

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const rawDelta = Math.min((now - prevTime) / 1000, 0.1);
    const delta = rawDelta * timeScale;
    prevTime = now;

    fpsFrames++;
    if (now - fpsLastTime >= 1000) {
        document.getElementById('fps-val').innerText = fpsFrames;
        fpsFrames = 0;
        fpsLastTime = now;
    }

    if (!document.getElementById('main-menu').classList.contains('hidden') || !document.getElementById('agent-select-screen').classList.contains('hidden')) {
        showcaseAgent.group.rotation.y += rawDelta * 0.8;
        showcasePedestal.rotation.y -= rawDelta * 0.5;
        renderer.render(scene, camera);
        return;
    }

    if (state.recoilResetTimer > 0) {
        state.recoilResetTimer -= rawDelta;
        if (state.recoilResetTimer <= 0) state.sprayShots = 0;
    }

    if (state.recoilResetTimer <= 0 && state.recoilPitch > 0.0001) {
        const recover = Math.min(state.recoilPitch, rawDelta * 0.18);
        camera.rotation.x -= recover;
        state.recoilPitch -= recover;
    }
    state.recoilYaw = THREE.MathUtils.lerp(state.recoilYaw, 0, rawDelta * 10);
    document.getElementById('crosshair').style.transform = `translate(calc(-50% + ${Math.round(state.recoilYaw * 420)}px), -50%)`;

    if (state.eCooldownTimer > 0) {
        state.eCooldownTimer -= rawDelta;
        if (state.eCooldownTimer <= 0) {
            state.eCooldownTimer = 0;
            state.eReady = true;
            updateHUD();
        }
    }

    if (state.reconScanTimer > 0) state.reconScanTimer -= rawDelta;
    if (state.taggedTimer > 0) state.taggedTimer -= rawDelta;
    if (knifeSwingTimer > 0) knifeSwingTimer -= rawDelta;
    if (equipTimer > 0) equipTimer -= rawDelta;
    if (inspectTimer > 0) inspectTimer -= rawDelta;
    if (abilityCastTimer > 0) abilityCastTimer -= rawDelta;
    if (boltCycleTimer > 0) boltCycleTimer -= rawDelta;
    if (landDip > 0) landDip = Math.max(0, landDip - rawDelta * 0.45);
    mouseDeltaX = THREE.MathUtils.lerp(mouseDeltaX, 0, rawDelta * 18);
    mouseDeltaY = THREE.MathUtils.lerp(mouseDeltaY, 0, rawDelta * 18);
    if (state.isReloading) {
        state.reloadTimer -= rawDelta;
        if (state.reloadTimer <= 0) {
            state.isReloading = false;
            state.ammo = state.gun.mag;
            updateHUD();
        }
    }

    if (state.omenPhasing) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        omenMarker.position.copy(camera.position).addScaledVector(dir, state.omenDist);
        omenMarker.position.y = 2.4;
    }

    if (controls.isLocked && state.alive) {
        if (state.cheats.ghostActive) {
            const flySpeed = (keys['ShiftLeft'] ? 30 : 15) * rawDelta;
            const fwd = Number(keys['KeyW'] || 0) - Number(keys['KeyS'] || 0);
            const rgt = Number(keys['KeyD'] || 0) - Number(keys['KeyA'] || 0);
            const up = Number(keys['Space'] || 0) - Number(keys['ControlLeft'] || 0);
            controls.moveForward(fwd * flySpeed);
            controls.moveRight(rgt * flySpeed);
            camera.position.y = Math.max(0.8, camera.position.y + up * flySpeed);
        } else {
            velocity.x -= velocity.x * 10.0 * delta;
            velocity.z -= velocity.z * 10.0 * delta;
            const isGliding = state.agent === 'JETT' && keys['Space'] && velocity.y < 0 && !canJump;
            velocity.y -= (isGliding ? 3.5 : 22) * delta;
            if (isGliding) velocity.y = Math.max(velocity.y, -1.6);

            const isWalking = keys['ShiftLeft'];
            const isPlantingOrDefusing = keys['Digit4'] && state.phase === 'COMBAT' && (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE');
            const weaponWeight = state.equippedSlot === 'KNIFE' ? 1.0 : (state.gun.speed || 0.86);
            const crouchMult = state.isCrouching ? 0.55 : 1.0;
            const tagMult = state.taggedTimer > 0 ? 0.42 : 1.0;
            const scopePenalty = (state.isADS && (state.gun.name === 'OPERATOR' || state.gun.name === 'MARSHAL')) ? 0.55 : 1.0;
            const onSlowIce = ACTIVE_SLOW_ZONES.some(z => Math.hypot(camera.position.x - z.pos.x, camera.position.z - z.pos.z) < z.radius);
            const slowMult = onSlowIce ? 0.50 : 1.0;

            const moveAccel = (isWalking ? 36 : 74) * weaponWeight * crouchMult * tagMult * scopePenalty * slowMult;
            const fwd = isPlantingOrDefusing ? 0 : (Number(keys['KeyW'] || 0) - Number(keys['KeyS'] || 0));
            const rgt = isPlantingOrDefusing ? 0 : (Number(keys['KeyD'] || 0) - Number(keys['KeyA'] || 0));

            if (fwd !== 0) velocity.z -= fwd * moveAccel * delta;
            if (rgt !== 0) velocity.x -= rgt * moveAccel * delta;
            if (keys['Space'] && canJump && !isPlantingOrDefusing) {
                velocity.y = 8.4;
                canJump = false;
            }

            const oldPos = camera.position.clone();
            controls.moveRight(-velocity.x * delta);
            controls.moveForward(-velocity.z * delta);
            const targetPos = camera.position.clone();

            const eyeHeight = state.isCrouching ? 1.1 : 1.7;
            const activeColliders = state.phase === 'BUY' ? mapData.colliders : mapData.colliders.filter(c => !mapData.buyBarriers.some(b => b.box === c));

            camera.position.set(targetPos.x, oldPos.y, oldPos.z);
            const boxX = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(0.75, eyeHeight, 0.75));
            if (activeColliders.some(b => b.intersectsBox(boxX))) camera.position.x = oldPos.x;

            camera.position.set(camera.position.x, oldPos.y, targetPos.z);
            const boxZ = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(0.75, eyeHeight, 0.75));
            if (activeColliders.some(b => b.intersectsBox(boxZ))) camera.position.z = oldPos.z;

            camera.position.y += velocity.y * delta;
            if (!canJump && camera.position.y > airPeakY) airPeakY = camera.position.y;

            let groundY = 0;
            if ((state.map === 'ASCENT' || state.map === 'ICEBOX') && camera.position.x < -24 && camera.position.z < -39) groundY = 3.0;
            if (mapData.ramps) {
                for (const r of mapData.ramps) {
                    if (camera.position.x >= r.minX && camera.position.x <= r.maxX && camera.position.z >= r.minZ && camera.position.z <= r.maxZ) {
                        const progress = (r.maxZ - camera.position.z) / (r.maxZ - r.minZ);
                        groundY = Math.max(groundY, progress * r.height);
                    }
                }
            }

            const targetEyeY = groundY + eyeHeight;
            if (camera.position.y <= targetEyeY) {
                if (!canJump) {
                    const dropDist = airPeakY - targetEyeY;
                    landDip = Math.min(0.08, dropDist * 0.025);
                    if (dropDist > 3.8 && state.phase === 'COMBAT') {
                        playFallDamage();
                        takeDamage(Math.min(45, Math.floor((dropDist - 3.5) * 14)), 'FALL DAMAGE');
                    }
                }
                camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetEyeY, delta * 18);
                velocity.y = 0;
                canJump = true;
                airPeakY = camera.position.y;
            }
        }
    }
    const speed = Math.hypot(velocity.x, velocity.z);
    if (canJump && !keys['ShiftLeft'] && speed > 2.2 && state.alive && !state.cheats.ghostActive) {
        stepTick += delta;
        if (stepTick > 0.36) {
            stepTick = 0;
            playSpatialFootstep(camera.position.y > 2.2 ? 'METAL' : 'STONE', camera.position, camera.position, camera.rotation.y);
        }
    }

    if (isFiring && state.gun.auto && controls.isLocked && state.alive) shoot();

    const insideSmoke = ACTIVE_SMOKES.find(s => camera.position.distanceTo(s.pos) < s.radius - 0.3);
    const smokeScreen = document.getElementById('smoke-vignette');
    if (insideSmoke && state.alive) {
        smokeScreen.style.background = insideSmoke.isDark ? 'rgba(18, 14, 48, 0.97)' : 'rgba(42, 54, 68, 0.96)';
        smokeScreen.style.opacity = '1';
    } else {
        smokeScreen.style.opacity = '0';
    }

    if (state.alive && state.hp > 0 && state.hp <= 25) {
        hbTimer += rawDelta;
        document.getElementById('damage-screen').style.opacity = String(0.35 + Math.sin(now * 0.012) * 0.25);
        if (hbTimer >= 1.1) { hbTimer = 0; playHeartbeat(); }
    }

    if (state.isADS && (state.gun.name === 'OPERATOR' || state.gun.name === 'MARSHAL')) {
        const isAccurate = speed <= 2.1 && canJump;
        document.getElementById('scope-accuracy-dot').classList.toggle('moving', !isAccurate);
        const accLabel = document.getElementById('scope-acc-label');
        accLabel.innerText = isAccurate ? '● ACCURATE' : '◌ MOVING ERROR';
        accLabel.style.color = isAccurate ? '#ff4655' : '#8b978f';
    }

    const barWrap = document.getElementById('action-bar-wrap');
    const barFill = document.getElementById('action-bar-fill');
    const actionLabel = document.getElementById('action-label');

    const nearOrb = ultOrbs.find(o => o.active && camera.position.distanceTo(o.mesh.position) < 3.2);
    if (keys[keybinds.INTERACT] && nearOrb && state.alive) {
        state.orbHoldTimer += rawDelta;
        barWrap.classList.remove('hidden');
        actionLabel.innerText = 'CAPTURING ULTIMATE ORB';
        barFill.style.width = `${Math.min(100, (state.orbHoldTimer / 1.2) * 100)}%`;
        if (state.orbHoldTimer >= 1.2) {
            state.orbHoldTimer = 0;
            barWrap.classList.add('hidden');
            nearOrb.active = false;
            nearOrb.mesh.visible = false;
            gainUltPoint();
            showBanner('ULTIMATE ORB CAPTURED (+1)');
        }
    } else if (keys['Digit4'] && state.alive && state.phase === 'COMBAT' && (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE')) {
        const onSite = (camera.position.z < -18 && camera.position.z > -36) && (Math.abs(camera.position.x) > 25 || (state.map === 'HAVEN' || state.map === 'LOTUS'));
        if (state.team === 'ATK' && !state.spikePlanted && onSite) {
            actionHold += delta;
            barWrap.classList.remove('hidden');
            actionLabel.innerText = 'PLANTING SPIKE';
            barFill.style.width = `${Math.min(100, (actionHold / 3.5) * 100)}%`;
            if (actionHold >= 3.5) {
                actionHold = 0;
                barWrap.classList.add('hidden');
                state.spikePlanted = true;
                spikeMesh.visible = true;
                spikeMesh.position.set(camera.position.x, 0.45, camera.position.z);
                gainUltPoint();
                announceVoice('Spike planted');
                showBanner('SPIKE PLANTED');
                broadcast({ type: 'SPIKE_PLANTED', x: camera.position.x, z: camera.position.z });
                updateHUD();
            }
        } else if (state.team === 'DEF' && state.spikePlanted && camera.position.distanceTo(spikeMesh.position) < 3.5) {
            actionHold = Math.max(actionHold, state.defuseSaved) + delta;
            barWrap.classList.remove('hidden');
            actionLabel.innerText = state.defuseSaved > 0 ? 'DEFUSING SPIKE // HALF LOCKED' : 'DEFUSING SPIKE';
            barFill.style.width = `${Math.min(100, (actionHold / 7.0) * 100)}%`;
            if (actionHold >= 3.5 && state.defuseSaved === 0) {
                state.defuseSaved = 3.5;
                playDefuseHalfway();
                spawnHeadshotSparks(scene, spikeMesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
                showBanner('HALF DEFUSED // CHECKPOINT LOCKED');
            }
            if (actionHold >= 7.0) {
                actionHold = 0;
                barWrap.classList.add('hidden');
                gainUltPoint();
                announceVoice('Spike defused');
                endRound('DEF', 'SPIKE DEFUSED');
            }
        }
    } else {
        actionHold = state.defuseSaved;
        state.orbHoldTimer = 0;
        barWrap.classList.add('hidden');
    }

    const timeSec = now * 0.001;
    if (state.alive) recordReplaySnapshot(timeSec);

    const specBanner = document.getElementById('spectator-banner');
    const kcOverlay = document.getElementById('killcam-overlay');
    if (killCam.active && killCam.index < killCam.frames.length) {
        specBanner.classList.add('hidden');
        const frame = killCam.frames[Math.floor(killCam.index)];
        const killerSnap = frame.bots[killCam.killerId];
        if (killerSnap) {
            camera.position.set(killerSnap.x, killerSnap.y + 1.55, killerSnap.z);
            camera.lookAt(frame.playerPos.x, frame.playerPos.y - 0.15, frame.playerPos.z);
        }
        killCam.index += 0.85;
        if (killCam.index >= killCam.frames.length) {
            killCam.active = false;
            kcOverlay.classList.add('hidden');
            viewmodelHolder.visible = false;
        }
    } else if (!state.alive && (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE')) {
        kcOverlay.classList.add('hidden');
        viewmodelHolder.visible = false;
        specBanner.classList.remove('hidden');
        if (specFreeCam) {
            document.getElementById('spec-target-name').innerText = 'FREE-CAM GHOST';
            const flySpeed = (keys['ShiftLeft'] ? 28 : 14) * rawDelta;
            controls.moveForward((Number(keys['KeyW'] || 0) - Number(keys['KeyS'] || 0)) * flySpeed);
            controls.moveRight((Number(keys['KeyD'] || 0) - Number(keys['KeyA'] || 0)) * flySpeed);
            camera.position.y = Math.max(0.8, camera.position.y + (Number(keys['Space'] || 0) - Number(keys['ControlLeft'] || 0)) * flySpeed);
        } else {
            const aliveAllies = bots.filter(b => b.team === state.team && b.alive);
            if (aliveAllies.length > 0) {
                const target = aliveAllies[specIndex % aliveAllies.length];
                document.getElementById('spec-target-name').innerText = target.id;
                camera.position.lerp(target.group.position.clone().add(new THREE.Vector3(0, 2.2, 3.2)), rawDelta * 8);
                camera.lookAt(target.group.position.clone().add(new THREE.Vector3(0, 1.4, -4)));
            }
        }
    } else {
        specBanner.classList.add('hidden');
        kcOverlay.classList.add('hidden');
    }
    if (state.isHost && (state.mode === 'UNRATED' || state.mode === 'COMPETITIVE') && state.phase !== 'END') {
        secondTick += delta;
        if (secondTick >= 1.0) {
            secondTick = 0;
            if (!state.spikePlanted) {
                state.timer--;
                if (state.phase === 'BUY' && state.timer <= 5 && state.timer > 0) playSpikeBeep();
                if (state.timer <= 0) {
                    if (state.phase === 'BUY') startRound('COMBAT');
                    else endRound('DEF', 'TIME EXPIRED');
                }
            } else {
                state.spikeTimer--;
                if (state.spikeTimer <= 0) {
                    if (state.alive && camera.position.distanceTo(spikeMesh.position) < 28) {
                        state.alive = false;
                        state.primaryGun = null;
                        state.shield = 0;
                    }
                    endRound('ATK', 'SPIKE DETONATED');
                }
            }
            updateHUD();
        }
    }

    if (state.spikePlanted) {
        spikeBeepTick += rawDelta;
        const interval = state.spikeTimer <= 5 ? 0.14 : state.spikeTimer <= 10 ? 0.25 : state.spikeTimer <= 20 ? 0.48 : 0.85;
        if (spikeBeepTick >= interval) {
            spikeBeepTick = 0;
            playSpikeBeep();
        }
    }

    if (state.phase === 'COMBAT' || state.mode === 'DEATHMATCH' || state.mode === 'RANGE' || state.mode === 'CUSTOM') {
        updateTacticalBots(
            bots, delta, now, camera, state, mapData, spawnTracer, takeDamage,
            (pos) => {
                state.spikePlanted = true;
                spikeMesh.visible = true;
                spikeMesh.position.set(pos.x, 0.45, pos.z);
                announceVoice('Spike planted');
                showBanner('SPIKE PLANTED BY BOT');
            },
            () => endRound('DEF', 'SPIKE DEFUSED BY BOT'),
            spikeMesh.position,
            scene
        );
        bots.forEach(b => updateThirdPersonPose(b, delta, now, true));
    }

    updateWorldAnimations(skyClouds, ultOrbs, spikeMesh, delta, now);
    const animState = {
        isReloading: state.isReloading, reloadTimer: state.reloadTimer, reloadDuration: state.reloadDuration,
        gunName: state.gun.name, skinName: state.skin, ammo: state.ammo, equippedSlot: state.equippedSlot,
        knifeSwingTimer, equipTimer, inspectTimer, abilityCastTimer, boltCycleTimer, landDip,
        mouseDeltaX, mouseDeltaY,
        strafeDir: Number(keys['KeyD'] || 0) - Number(keys['KeyA'] || 0),
        isPlantingOrDefusing: Boolean(keys['Digit4'] && state.phase === 'COMBAT' && actionHold > 0.05),
        isDefusing: state.team === 'DEF'
    };
    updateViewmodelAnimations(animState, viewmodelHolder, knifeModel, abilityHandHolder, spikeHandHolder, activeGunMesh, delta, now, speed, state.isADS, state.isCrouching);

    netTick += rawDelta;
    if (netTick > 0.05 && connections.length > 0) {
        netTick = 0;
        broadcast({
            type: 'MOVE', x: camera.position.x, y: camera.position.y, z: camera.position.z,
            ry: camera.rotation.y, team: state.team, agent: state.agent,
            credits: state.credits, gunName: state.gun.name
        });
    }

    drawMinimap(now);
    updateAllyNameplates();
    if (rtController) rtController.update(camera.position);
    if (bloomEnabled) composer.render();
    else renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
