/*
 *  牌・面子の DOM 生成
 */
'use strict';

import { tileEl } from './tiles.js';
import { parseMeld } from './pai.js';

/** 横向きの牌（鳴き牌・リーチ宣言牌）。stack があれば加槓として上に重ねる */
export function rotatedTile(p, opts = {}, stack = null) {
    const wrap = document.createElement('div');
    wrap.className = 'tile-rot';
    const cell = (pai) => {
        const c = document.createElement('div');
        c.className = 'rot-cell';
        c.appendChild(tileEl(pai, opts));
        return c;
    };
    if (stack) wrap.appendChild(cell(stack));
    wrap.appendChild(cell(p));
    return wrap;
}

/** 面子文字列から DOM 要素（.meld）を作る */
export function meldEl(m, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'meld';
    for (const t of parseMeld(m).tiles) {
        if (t.rotate) wrap.appendChild(rotatedTile(t.p, opts, t.stack));
        else wrap.appendChild(tileEl(t.back ? '_' : t.p, opts));
    }
    return wrap;
}
