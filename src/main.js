/*
 *  スマホ麻雀 — エントリポイント
 *
 *  ルール・局進行・点数計算 : @kobalab/majiang-core (MIT)
 *  CPU の思考ルーチン        : @kobalab/majiang-ai   (MIT)
 *  UI とその他               : 本リポジトリ
 */
'use strict';

import './style.css';
import Majiang from '@kobalab/majiang-core';
import AI from '@kobalab/majiang-ai';
import UI from './ui.js';
import HumanPlayer from './human.js';
import { loadSettings, saveSettings, ruleParam } from './settings.js';
import { sfx, setSoundEnabled } from './sound.js';

const PLAYER_NAMES = ['あなた', 'CPU 1', 'CPU 2', 'CPU 3'];

const settings = loadSettings();
setSoundEnabled(settings.sound);

const app = document.getElementById('app');
app.innerHTML = `
<div class="screen title-screen js-title"></div>
<div class="screen js-game" hidden></div>
<div class="overlay js-overlay" hidden></div>`;

const titleEl = app.querySelector('.js-title');
const gameEl = app.querySelector('.js-game');
const overlayEl = app.querySelector('.js-overlay');

const ui = new UI(gameEl, overlayEl, settings);
let game = null;

/* ------------------------------------------------------------ 汎用 UI */

const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
};

function openDialog(build) {
    return new Promise((resolve) => {
        const dlg = h('div', 'dialog');
        const close = (v) => {
            overlayEl.hidden = true;
            overlayEl.textContent = '';
            resolve(v);
        };
        build(dlg, close);
        overlayEl.textContent = '';
        overlayEl.appendChild(dlg);
        overlayEl.hidden = false;
    });
}

function switchRow(dlg, label, note, key, onChange) {
    const row = h('div', 'setting-row');
    const left = h('div');
    left.appendChild(h('span', null, label));
    if (note) left.appendChild(h('small', null, note));
    const sw = h('button', 'switch');
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(!!settings[key]));
    sw.addEventListener('click', () => {
        settings[key] = !settings[key];
        sw.setAttribute('aria-checked', String(settings[key]));
        saveSettings(settings);
        sfx.tap();
        if (onChange) onChange(settings[key]);
    });
    row.append(left, sw);
    dlg.appendChild(row);
}

function segRow(dlg, label, key, options, onChange) {
    const row = h('div', 'setting-row');
    row.appendChild(h('span', null, label));
    const seg = h('div', 'seg');
    const buttons = options.map(([text, value]) => {
        const b = h('button', null, text);
        b.setAttribute('aria-pressed', String(settings[key] === value));
        b.addEventListener('click', () => {
            settings[key] = value;
            saveSettings(settings);
            sfx.tap();
            buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            if (onChange) onChange(value);
        });
        seg.appendChild(b);
        return b;
    });
    row.appendChild(seg);
    dlg.appendChild(row);
}

/* ------------------------------------------------------------ 画面 */

function showTitle() {
    if (game) { game.stop(); game = null; }
    gameEl.hidden = true;
    titleEl.hidden = false;
    titleEl.innerHTML = '';

    const logo = h('div', 'logo', '麻 雀');
    logo.appendChild(h('small', null, 'RIICHI MAHJONG'));
    titleEl.appendChild(logo);

    const menu = h('div', 'menu');
    const start = h('button', 'menu-btn', '対局開始');
    start.addEventListener('click', () => { sfx.unlock(); sfx.tap(); startGame(); });
    const config = h('button', 'menu-btn menu-btn--sub', '設定');
    config.addEventListener('click', () => { sfx.tap(); showSettings(); });
    const help = h('button', 'menu-btn menu-btn--sub', '遊び方・クレジット');
    help.addEventListener('click', () => { sfx.tap(); showHelp(); });
    menu.append(start, config, help);
    titleEl.appendChild(menu);

    titleEl.appendChild(h('div', 'title-note',
        'CPU 3 人と対局する四人打ちのリーチ麻雀です。'
        + '画面をタテに持ってお使いください。'));
}

function showSettings() {
    return openDialog((dlg, close) => {
        dlg.appendChild(h('h2', null, '設定'));
        segRow(dlg, '対局', 'kind', [['東1局', 'ikkyoku'], ['東風戦', 'tonpu'], ['半荘戦', 'hanchan']]);
        switchRow(dlg, '赤ドラ', '各色の五萬・五筒・五索を 1 枚ずつ赤に', 'aka');
        switchRow(dlg, 'クイタンあり', '鳴いた断幺九を認める', 'kuitan');
        segRow(dlg, '進行速度', 'speed', [['速い', 1], ['普通', 3], ['ゆっくり', 5]],
            (v) => { if (game) game.speed = v; });
        switchRow(dlg, '打牌の確認', '1 回目のタップで選択、2 回目で捨てる', 'confirmDapai');
        switchRow(dlg, '牌に数字を表示', '「3p」のような補助ラベル', 'tileLabel',
            () => ui.redraw());
        switchRow(dlg, 'アシスト表示', 'シャンテン数と待ちを表示', 'assist',
            () => ui.redraw());
        switchRow(dlg, '効果音', null, 'sound', (v) => setSoundEnabled(v));

        const actions = h('div', 'dialog-actions');
        const ok = h('button', 'dialog-btn', '閉じる');
        ok.addEventListener('click', () => close());
        actions.appendChild(ok);
        dlg.appendChild(actions);
    });
}

function showHelp() {
    return openDialog((dlg, close) => {
        dlg.appendChild(h('h2', null, '遊び方'));
        const body = h('div');
        body.style.fontSize = '13px';
        body.style.lineHeight = '1.8';
        body.innerHTML = `
<p>自分の番になったら手牌をタップして捨て牌を選びます（設定により 1 回目のタップで選択、2 回目で確定）。</p>
<p>鳴きや和了ができるときは画面右下にボタンが出ます。<b>ロン</b>・<b>ツモ</b>・<b>リーチ</b>・<b>ポン</b>・<b>チー</b>・<b>カン</b>・<b>パス</b>から選んでください。</p>
<p>リーチは、ボタンを押してから捨てる牌を選びます。もう一度ボタンを押すと取り消せます。</p>
<p>ドラ表示牌は画面上部、点数と局は卓の中央に表示されます。「フリテン」表示が出ているときはロンできません。</p>
<h2 style="margin-top:14px">クレジット</h2>
<p>ルール処理・点数計算・局進行に
<a href="https://github.com/kobalab/majiang-core" target="_blank" rel="noopener">@kobalab/majiang-core</a>、
CPU の思考ルーチンに
<a href="https://github.com/kobalab/majiang-ai" target="_blank" rel="noopener">@kobalab/majiang-ai</a>
（いずれも MIT License / 作者: Satoshi Kobayashi）を使用しています。</p>`;
        dlg.appendChild(body);
        const actions = h('div', 'dialog-actions');
        const ok = h('button', 'dialog-btn', '閉じる');
        ok.addEventListener('click', () => close());
        actions.appendChild(ok);
        dlg.appendChild(actions);
    });
}

/** 対局中のメニュー */
async function showGameMenu() {
    const choice = await openDialog((dlg, close) => {
        dlg.appendChild(h('h2', null, 'メニュー'));
        const actions = h('div', 'dialog-actions');
        actions.style.flexDirection = 'column';
        [['設定', 'settings'], ['遊び方・クレジット', 'help'],
         ['対局を中断してタイトルへ', 'title'], ['対局に戻る', 'back']]
            .forEach(([label, value], i) => {
                const b = h('button', 'dialog-btn' + (i >= 2 ? ' dialog-btn--sub' : ''), label);
                b.addEventListener('click', () => close(value));
                actions.appendChild(b);
            });
        dlg.appendChild(actions);
    });
    if (choice === 'settings') { await showSettings(); return showGameMenu(); }
    if (choice === 'help') { await showHelp(); return showGameMenu(); }
    if (choice === 'title') showTitle();
}

/* ------------------------------------------------------------ 対局 */

function startGame() {
    titleEl.hidden = true;
    gameEl.hidden = false;

    const rule = Majiang.rule(ruleParam(settings));
    const human = new HumanPlayer(ui);
    const players = [human, new AI(), new AI(), new AI()];

    game = new Majiang.Game(players, onJieju, rule, 'スマホ麻雀');
    game.model.player = PLAYER_NAMES.concat();
    game.speed = settings.speed;
    game.wait = 0;

    // 発声だけは局進行側から通知されるので、卓のビューにも UI をつなぐ
    game.view = {
        kaiju() {}, redraw() {}, update() {}, summary() {},
        say: (name, l) => ui.say(name, l),
    };
    human.view = ui;
    ui.onLeave = showGameMenu;

    ui.jiejuChoice = null;
    game.kaiju();
    game.start();
}

function onJieju() {
    game = null;
    if (ui.jiejuChoice === 'again') startGame();
    else showTitle();
}

/* ------------------------------------------------------------ 起動 */

showTitle();

// 縦向き固定を試みる（対応端末のみ）
if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('portrait').catch(() => {});
}
