/*
 *  牌姿・面子の解析ヘルパ
 *
 *  牌姿の表記は @kobalab/majiang-core に準拠する。
 */
'use strict';

/**
 * 牌姿文字列（'m123p456,s789-' の bingpai 部）を牌の配列に分解する
 * @param {string} str
 * @returns {string[]}  例: ['m1','m2','m3','p4', ...]（'_' は伏せ牌）
 */
export function splitPai(str) {
    const out = [];
    let s = '';
    for (const ch of str) {
        if (ch === 'm' || ch === 'p' || ch === 's' || ch === 'z') { s = ch; continue; }
        if (ch === '_') { out.push('_'); continue; }
        if (ch >= '0' && ch <= '9') out.push(s + ch);
    }
    return out;
}

/**
 * 手牌を「手の内」と「ツモ牌」に分ける
 * @param {object} shoupai Majiang.Shoupai
 */
export function handTiles(shoupai) {
    const str = shoupai.toString().split(',')[0].replace(/\*$/, '');
    const tiles = splitPai(str);
    const drawn = shoupai._zimo && shoupai._zimo.length <= 2 ? tiles.pop() : null;
    return { tiles, drawn };
}

/**
 * 面子文字列を表示用の並びに変換する
 *
 * @param {string} m 例) 'm123-', 'm111=', 'm1111', 'm111+1'
 * @returns {{tiles: {p: string, rotate: boolean, back: boolean, stack: string|null}[]}}
 */
export function parseMeld(m) {
    const s = m[0];
    const tokens = m.slice(1).match(/\d[+=\-]?/g) || [];

    const isGang = tokens.length === 4;
    const dirIdx = tokens.findIndex((t) => t.length === 2);
    const dir = dirIdx >= 0 ? tokens[dirIdx][1] : null;

    // 暗槓: 両端を伏せる
    if (isGang && dir === null) {
        return {
            tiles: [
                { p: '_', back: true, rotate: false, stack: null },
                { p: s + tokens[1][0], back: false, rotate: false, stack: null },
                { p: s + tokens[2][0], back: false, rotate: false, stack: null },
                { p: '_', back: true, rotate: false, stack: null },
            ],
        };
    }

    // 加槓: 3枚の副露 + 追加牌（鳴いた牌の上に重ねる）
    let addPai = null;
    let list = tokens;
    if (isGang && dirIdx === 2) {
        addPai = s + tokens[3][0];
        list = tokens.slice(0, 3);
    }

    const called = s + list[dirIdx][0];
    const rest = list.filter((_, i) => i !== dirIdx).map((t) => s + t[0]);

    // 鳴いた相手の位置に応じて横向き牌の位置を決める
    const pos = dir === '-' ? 0 : dir === '=' ? 1 : rest.length;
    const tiles = [];
    for (let i = 0, r = 0; i <= rest.length; i++) {
        if (i === pos) tiles.push({ p: called, rotate: true, back: false, stack: addPai });
        else tiles.push({ p: rest[r++], rotate: false, back: false, stack: null });
    }
    return { tiles };
}

/** 和了点の格（満貫・跳満…）の名前 */
export function defenRank(hule) {
    if (hule.damanguan) {
        return hule.damanguan > 1 ? `${hule.damanguan}倍役満` : '役満';
    }
    const f = hule.fanshu || 0;
    if (f >= 13) return '数え役満';
    if (f >= 11) return '三倍満';
    if (f >= 8) return '倍満';
    if (f >= 6) return '跳満';
    if (f >= 5) return '満貫';
    // 4翻30符以上 / 3翻60符以上は満貫扱い（切り上げ含む）
    if (f === 4 && hule.fu >= 30) return '満貫';
    if (f === 3 && hule.fu >= 60) return '満貫';
    return '';
}

const FENG = ['東', '南', '西', '北'];
export const fengName = (l) => FENG[l];

/** 局名（例: 東1局 2本場） */
export function roundName(zhuangfeng, jushu, changbang) {
    let s = `${FENG[zhuangfeng]}${jushu + 1}局`;
    if (changbang) s += ` ${changbang}本場`;
    return s;
}
