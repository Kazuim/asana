/*
 *  設定の保存 / 読み込み
 */
'use strict';

const KEY = 'mahjong-mobile.settings.v1';

export const DEFAULTS = {
    kind: 'tonpu',       // 'ikkyoku' | 'tonpu' | 'hanchan'
    aka: true,           // 赤ドラ
    kuitan: true,        // クイタンあり
    speed: 3,            // 1(速い) 3(普通) 5(ゆっくり)
    confirmDapai: true,  // 打牌を 2 タップで確定
    tileLabel: true,     // 牌に数字ラベルを表示
    assist: true,        // シャンテン数 / 待ちを表示
    sound: true,         // 効果音
};

export function loadSettings() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    } catch { /* 破損時は既定値 */ }
    return { ...DEFAULTS, ...saved };
}

export function saveSettings(s) {
    try {
        localStorage.setItem(KEY, JSON.stringify(s));
    } catch { /* プライベートモード等では保存しない */ }
}

/** 設定から Majiang のルールオブジェクト用パラメータを作る */
export function ruleParam(s) {
    return {
        '場数': s.kind === 'ikkyoku' ? 0 : s.kind === 'tonpu' ? 1 : 2,
        '赤牌': s.aka ? { m: 1, p: 1, s: 1 } : { m: 0, p: 0, s: 0 },
        'クイタンあり': s.kuitan,
    };
}
