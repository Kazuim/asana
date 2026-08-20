/*
 *  効果音（アセット不要 / WebAudio で合成）
 */
'use strict';

let ctx = null;
let enabled = true;

function ac() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

export function setSoundEnabled(v) { enabled = !!v; }

/** 短いトーン */
function tone({ freq = 440, dur = 0.08, type = 'triangle', gain = 0.08, slide = 0 }) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

/** 牌を打つ音（ノイズバースト） */
function clack(gain = 0.16) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const len = Math.floor(c.sampleRate * 0.045);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 1.1;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(c.destination);
    src.start();
}

export const sfx = {
    unlock() { ac(); },
    dapai()  { clack(0.13); },
    zimo()   { clack(0.07); },
    fulou()  { clack(0.2); tone({ freq: 300, dur: 0.09, gain: 0.05 }); },
    lizhi()  { tone({ freq: 660, dur: 0.1, gain: 0.07 }); setTimeout(() => tone({ freq: 990, dur: 0.16, gain: 0.07 }), 90); },
    hule()   {
        [0, 110, 220, 380].forEach((d, i) =>
            setTimeout(() => tone({ freq: [523, 659, 784, 1047][i], dur: 0.22, gain: 0.07 }), d));
    },
    pingju() { tone({ freq: 320, dur: 0.3, gain: 0.05, slide: -120 }); },
    tap()    { tone({ freq: 880, dur: 0.03, gain: 0.04, type: 'sine' }); },
};
