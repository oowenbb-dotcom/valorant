const AudioCtx = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioCtx();
function createSpatialOutput(sourcePos, listenerPos, listenerYaw) {
    const panner = ctx.createStereoPanner();
    const gain = ctx.createGain();
    if (!sourcePos || !listenerPos) {
        panner.pan.value = 0;
        gain.gain.value = 1;
        panner.connect(gain);
        gain.connect(ctx.destination);
        return { input: panner, gainMult: 1 };
    }

    const dx = sourcePos.x - listenerPos.x;
    const dz = sourcePos.z - listenerPos.z;
    const dist = Math.hypot(dx, dz);
    const angleToSource = Math.atan2(dx, dz);
    const relAngle = angleToSource - listenerYaw;

    panner.pan.value = Math.max(-1, Math.min(1, -Math.sin(relAngle)));
    const attenuation = Math.max(0.08, 1 - dist / 65);
    panner.connect(gain);
    gain.connect(ctx.destination);
    return { input: panner, gainMult: attenuation };
}
export function playGunshot(pitch = 160, suppressed = false) {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = suppressed ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.11);

    gain.gain.setValueAtTime(suppressed ? 0.16 : 0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
}
export function playSpatialGunshot(pitch = 160, suppressed = false, sourcePos = null, listenerPos = null, listenerYaw = 0) {
    if (ctx.state === 'suspended') ctx.resume();
    const { input, gainMult } = createSpatialOutput(sourcePos, listenerPos, listenerYaw);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = suppressed ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.11);

    const vol = (suppressed ? 0.16 : 0.28) * gainMult;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.11);

    osc.connect(gain);
    gain.connect(input);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
}
export function playBulletWhiz(sourcePos, listenerPos, listenerYaw) {
    if (ctx.state === 'suspended') ctx.resume();
    const { input, gainMult } = createSpatialOutput(sourcePos, listenerPos, listenerYaw);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1850, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18 * gainMult, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.085);
    osc.connect(gain);
    gain.connect(input);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
}
export function playSurfaceImpact(material = 'STONE') {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (material === 'METAL') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1450 + Math.random() * 400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.09);
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.09);
    } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.06);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
}
export function playHeadshot() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, ctx.currentTime);
    osc.frequency.setValueAtTime(1480, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.32, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
}
export function playArmorBreak() {
    if (ctx.state === 'suspended') ctx.resume();
    [1320, 1760, 2140].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.03);
        osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + i * 0.03 + 0.12);
        gain.gain.setValueAtTime(0.16, ctx.currentTime + i * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + i * 0.03 + 0.13);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.03);
        osc.stop(ctx.currentTime + i * 0.03 + 0.14);
    });
}
export function playHeartbeat() {
    if (ctx.state === 'suspended') ctx.resume();
    [0, 0.18].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 68 : 54, ctx.currentTime + offset);
        osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + offset + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + offset + 0.13);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.14);
    });
}
export function playFootstep() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95 + Math.random() * 20, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
}

export function playSpatialFootstep(surface = 'STONE', sourcePos = null, listenerPos = null, listenerYaw = 0) {
    if (ctx.state === 'suspended') ctx.resume();
    const { input, gainMult } = createSpatialOutput(sourcePos, listenerPos, listenerYaw);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = surface === 'METAL' ? 'triangle' : 'sine';
    const basePitch = surface === 'METAL' ? 240 : (surface === 'WOOD' ? 145 : 95);
    osc.frequency.setValueAtTime(basePitch + Math.random() * 20, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.11 * gainMult, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(input);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
}
export function playSpikeBeep() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
}

export function playDefuseHalfway() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    osc.frequency.setValueAtTime(1110, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
}
export function playKillBanner(streak = 1) {
    if (ctx.state === 'suspended') ctx.resume();
    const baseFreqs = [330, 392, 440, 523.25, 659.25];
    const freq = baseFreqs[Math.min(streak - 1, 4)];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.31);
}
export function playUltimateReady() {
    if (ctx.state === 'suspended') ctx.resume();
    [440, 554.37, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + i * 0.06 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + i * 0.06 + 0.36);
    });
}
export function playPingSound() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
}

export function playBarrierDrop() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.46);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.47);
}
export function playOmenPhase(entering = true) {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(entering ? 240 : 120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(entering ? 95 : 320, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.24, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.33);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
}

export function playTeleportSound() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(920, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.33);
}
export function playFallDamage() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.32, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.21);
}
export function playEquipSound(type = 'GUN') {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (type === 'KNIFE') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2800, ctx.currentTime + 0.14);
    } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);
    }
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
}
export function playReloadStage(stage = 'OUT') {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    if (stage === 'OUT') {
        osc.frequency.setValueAtTime(280, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.08);
    } else if (stage === 'IN') {
        osc.frequency.setValueAtTime(190, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.08);
    } else {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.09);
    }
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
}
export function playAbilityWhoosh(type = 'SMOKE') {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(type === 'FLASH' ? 600 : 180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(type === 'FLASH' ? 1900 : 540, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
}
export function playMatchFound() {
    if (ctx.state === 'suspended') ctx.resume();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0.22, ctx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + i * 0.07 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.07);
        osc.stop(ctx.currentTime + i * 0.07 + 0.36);
    });
}
export function playFinisherChord(skinName = 'PRIME') {
    if (ctx.state === 'suspended') ctx.resume();
    if (skinName === 'PRIME') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.85);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.92);
    } else if (skinName === 'REAVER') {
        [146.83, 174.61, 220].forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.22, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 1.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 1.12);
        });
    } else if (skinName === 'GLITCHPOP') {
        [523, 659, 784, 1046, 1318, 1568].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);
            gain.gain.setValueAtTime(0.14, ctx.currentTime + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + i * 0.05 + 0.14);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.05);
            osc.stop(ctx.currentTime + i * 0.05 + 0.15);
        });
    }
}
export function announceVoice(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.12;
    utter.pitch = 0.85;
    utter.volume = 0.7;
    window.speechSynthesis.speak(utter);
}
export function unlockAudioContext() {
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
}
