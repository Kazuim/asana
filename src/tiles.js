/*
 *  牌の描画
 *
 *  牌面はすべて SVG で生成する（画像アセット不要 / 解像度非依存）。
 *  牌の表記は @kobalab/majiang-core に準拠する:
 *      m1..m9 萬子 / p1..p9 筒子 / s1..s9 索子 / z1..z7 字牌
 *      m0,p0,s0 は赤5 / '_' は伏せ牌
 */
'use strict';

// 牌面の設計サイズ。実表示は CSS の width/height に追従する。
const W = 60;
const H = 84;

const INK = '#1b1b1b';
const RED = '#c8102e';
const BLUE = '#1f5fa8';
const GREEN = '#0f7a4a';

const MANZU = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const HONORS = ['', '東', '南', '西', '北', '', '發', '中']; // z5(白) は枠のみ

const svg = (body) =>
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="tile-face">${body}</svg>`;

/* ------------------------------------------------------------------ 筒子 */

function dot(cx, cy, r, color) {
    const inner = color === RED ? '#f4b9c2' : color === GREEN ? '#b6e0cb' : '#bcd6f0';
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${inner}" stroke="${color}" stroke-width="${r * 0.42}"/>`;
}

// n に応じた円の配置（[x, y, 色] の並び）。座標は 0..1 の相対値。
const PIN_LAYOUT = {
    1: [[0.5, 0.5]],
    2: [[0.5, 0.28], [0.5, 0.72]],
    3: [[0.26, 0.24], [0.5, 0.5], [0.74, 0.76]],
    4: [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]],
    5: [[0.26, 0.24], [0.74, 0.24], [0.5, 0.5], [0.26, 0.76], [0.74, 0.76]],
    6: [[0.29, 0.22], [0.71, 0.22], [0.29, 0.5], [0.71, 0.5], [0.29, 0.78], [0.71, 0.78]],
    7: [[0.24, 0.18], [0.5, 0.27], [0.76, 0.36], [0.29, 0.62], [0.71, 0.62], [0.29, 0.85], [0.71, 0.85]],
    8: [[0.29, 0.16], [0.71, 0.16], [0.29, 0.39], [0.71, 0.39], [0.29, 0.62], [0.71, 0.62], [0.29, 0.85], [0.71, 0.85]],
    9: [[0.22, 0.22], [0.5, 0.22], [0.78, 0.22], [0.22, 0.5], [0.5, 0.5], [0.78, 0.5], [0.22, 0.78], [0.5, 0.78], [0.78, 0.78]],
};

// 実際の牌に近づけるための色付け（厳密な牌譜再現ではなく視認性優先）
const PIN_COLOR = {
    1: [RED],
    2: [GREEN, BLUE],
    3: [BLUE, GREEN, GREEN],
    4: [BLUE, GREEN, GREEN, BLUE],
    5: [BLUE, GREEN, RED, GREEN, BLUE],
    6: [GREEN, GREEN, RED, RED, RED, RED],
    7: [GREEN, GREEN, GREEN, RED, RED, RED, RED],
    8: [BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE, BLUE],
    9: [RED, RED, RED, GREEN, GREEN, GREEN, BLUE, BLUE, BLUE],
};

function pinzu(n, red) {
    const pts = PIN_LAYOUT[n];
    const colors = red ? [RED] : PIN_COLOR[n];
    const r = n === 1 ? 15 : n <= 3 ? 10 : n <= 6 ? 8.4 : 7.2;
    const padX = r + 4, padY = r + 5;
    return pts
        .map(([x, y], i) =>
            dot(padX + x * (W - padX * 2), padY + y * (H - padY * 2), r, colors[i % colors.length]))
        .join('');
}

/* ------------------------------------------------------------------ 索子 */

function bamboo(cx, cy, h, color) {
    const w = h * 0.42;
    const light = color === GREEN ? '#8fd3b0' : '#f3aab5';
    return `<g>
        <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${w * 0.45}"
              fill="${light}" stroke="${color}" stroke-width="${w * 0.3}"/>
        <line x1="${cx - w / 2}" y1="${cy}" x2="${cx + w / 2}" y2="${cy}"
              stroke="${color}" stroke-width="${w * 0.3}"/>
    </g>`;
}

// 一索は伝統的に孔雀。簡略化した鳥のシルエットで表現する。
function bird() {
    return `<g>
        <ellipse cx="30" cy="46" rx="12" ry="15" fill="#d8f0e2" stroke="${GREEN}" stroke-width="3"/>
        <circle cx="30" cy="27" r="8.5" fill="#f6e7c8" stroke="${GREEN}" stroke-width="3"/>
        <path d="M30 18.5 L34 23 L26 23 Z" fill="${RED}"/>
        <path d="M22 44 Q14 56 22 68 Q30 60 30 52 Z" fill="#bfe6d1" stroke="${GREEN}" stroke-width="2.4"/>
        <path d="M38 44 Q46 56 38 68 Q30 60 30 52 Z" fill="#bfe6d1" stroke="${GREEN}" stroke-width="2.4"/>
        <path d="M30 60 L30 74" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="27" cy="26" r="1.8" fill="${INK}"/>
    </g>`;
}

const SOU_LAYOUT = {
    2: [[0.5, 0.25], [0.5, 0.75]],
    3: [[0.5, 0.2], [0.28, 0.72], [0.72, 0.72]],
    4: [[0.28, 0.26], [0.72, 0.26], [0.28, 0.74], [0.72, 0.74]],
    5: [[0.25, 0.2], [0.75, 0.2], [0.5, 0.5], [0.25, 0.8], [0.75, 0.8]],
    6: [[0.26, 0.2], [0.5, 0.2], [0.74, 0.2], [0.26, 0.76], [0.5, 0.76], [0.74, 0.76]],
    7: [[0.5, 0.14], [0.26, 0.55], [0.5, 0.55], [0.74, 0.55], [0.26, 0.87], [0.5, 0.87], [0.74, 0.87]],
    8: [[0.32, 0.16], [0.68, 0.16], [0.26, 0.45], [0.74, 0.45], [0.26, 0.72], [0.74, 0.72], [0.34, 0.93], [0.66, 0.93]],
    9: [[0.26, 0.18], [0.5, 0.18], [0.74, 0.18], [0.26, 0.5], [0.5, 0.5], [0.74, 0.5], [0.26, 0.82], [0.5, 0.82], [0.74, 0.82]],
};

const SOU_COLOR = {
    2: [GREEN, GREEN],
    3: [RED, GREEN, GREEN],
    4: [GREEN, GREEN, GREEN, GREEN],
    5: [GREEN, GREEN, RED, GREEN, GREEN],
    6: [GREEN, GREEN, GREEN, GREEN, GREEN, GREEN],
    7: [RED, GREEN, GREEN, GREEN, GREEN, GREEN, GREEN],
    8: [GREEN, GREEN, GREEN, GREEN, GREEN, GREEN, GREEN, GREEN],
    9: [GREEN, GREEN, GREEN, RED, RED, RED, GREEN, GREEN, GREEN],
};

function souzu(n, red) {
    if (n === 1) return bird();
    const pts = SOU_LAYOUT[n];
    const colors = red ? [RED] : SOU_COLOR[n];
    const h = n <= 3 ? 26 : n <= 6 ? 21 : 17;
    const padX = 13, padY = h / 2 + 4;
    return pts
        .map(([x, y], i) =>
            bamboo(padX + x * (W - padX * 2), padY + y * (H - padY * 2), h, colors[i % colors.length]))
        .join('');
}

/* ------------------------------------------------------------------ 萬子 */

function manzu(n, red) {
    return `<text x="30" y="36" text-anchor="middle" font-size="30"
                  font-family="'Hiragino Mincho ProN','Yu Mincho',serif" font-weight="600"
                  fill="${red ? RED : INK}">${MANZU[n]}</text>
            <text x="30" y="72" text-anchor="middle" font-size="27"
                  font-family="'Hiragino Mincho ProN','Yu Mincho',serif" font-weight="600"
                  fill="${RED}">萬</text>`;
}

/* ---------------------------------------------------------------- 字牌 */

function honor(n) {
    if (n === 5) {
        // 白は枠のみ
        return `<rect x="11" y="14" width="38" height="56" rx="3" fill="none"
                      stroke="${BLUE}" stroke-width="3.2"/>`;
    }
    const color = n === 6 ? GREEN : n === 7 ? RED : INK;
    return `<text x="30" y="57" text-anchor="middle" font-size="40"
                  font-family="'Hiragino Mincho ProN','Yu Mincho',serif" font-weight="700"
                  fill="${color}">${HONORS[n]}</text>`;
}

/* ------------------------------------------------------------------ API */

const faceCache = new Map();

/** 牌面 SVG（表面の絵柄のみ）を返す */
export function tileFace(p) {
    if (faceCache.has(p)) return faceCache.get(p);

    const s = p[0];
    const raw = +p[1];
    const red = raw === 0; // 赤ドラ
    const n = raw === 0 ? 5 : raw;

    let body;
    if (s === 'm') body = manzu(n, red);
    else if (s === 'p') body = pinzu(n, red);
    else if (s === 's') body = souzu(n, red);
    else body = honor(n);

    const out = svg(body);
    faceCache.set(p, out);
    return out;
}

/** 牌 1 枚の DOM 要素を作る */
export function tileEl(p, opts = {}) {
    const el = document.createElement('div');
    const hidden = !p || p === '_' || p[0] === '_';
    el.className = 'tile' + (hidden ? ' tile--back' : '');
    if (opts.className) el.className += ' ' + opts.className;
    if (!hidden) {
        const raw = +p[1];
        if (raw === 0) el.classList.add('tile--red');
        el.innerHTML = tileFace(p);
        if (opts.label) {
            const lab = document.createElement('span');
            lab.className = 'tile-label';
            lab.textContent = shortLabel(p);
            el.appendChild(lab);
        }
        el.dataset.pai = p;
    }
    return el;
}

const SUIT_LABEL = { m: 'm', p: 'p', s: 's', z: 'z' };

/** 「3p」「東」のような短いラベル（初心者向け表示） */
export function shortLabel(p) {
    const s = p[0];
    const n = +p[1];
    if (s === 'z') return HONORS[n] || '白';
    return (n === 0 ? 5 : n) + SUIT_LABEL[s];
}
