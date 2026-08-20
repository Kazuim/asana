/*
 *  対局画面の描画とプレイヤー操作
 *
 *  描画は「自分の視点の卓情報」(Majiang.Board) だけを参照するので、
 *  他家の手牌が画面に出ることはない。
 */
'use strict';

import Majiang from '@kobalab/majiang-core';
import { tileEl } from './tiles.js';
import { meldEl, rotatedTile } from './render.js';
import { handTiles, splitPai, defenRank, fengName, roundName } from './pai.js';
import { sfx } from './sound.js';

const SAY_TEXT = {
    zimo: 'ツモ', rong: 'ロン', lizhi: 'リーチ',
    peng: 'ポン', chi: 'チー', gang: 'カン',
};
const POS = ['bottom', 'right', 'top', 'left'];
const POS_LABEL = ['あなた', '下家', '対面', '上家'];

const h = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
};

export default class UI {

    /**
     * @param {HTMLElement} root      対局画面のルート要素
     * @param {HTMLElement} overlay   ダイアログ用のオーバーレイ
     * @param {object} settings       設定（参照を保持するので変更は即反映）
     */
    constructor(root, overlay, settings) {
        this.root = root;
        this.overlay = overlay;
        this.settings = settings;
        this.player = null;       // HumanPlayer から注入される
        this.jiejuChoice = null;  // 終局後の選択（'again' | 'title'）
        this._pending = null;
        this._dapaiState = null;
        this._lastDapai = null;
        this._lastHule = null;
        this._lastPingju = null;
        this._paipu = null;
        this._onLeave = null;
        this._build();
    }

    /* ============================================================ 構築 */

    _build() {
        this.root.innerHTML = `
<div class="hud">
  <span class="hud-round"></span>
  <span class="hud-rest">残り <b>0</b></span>
  <span class="hud-furiten" hidden>フリテン</span>
  <span class="hud-dora"><span class="hud-dora-label">ドラ</span></span>
  <button class="icon-btn js-menu" aria-label="メニュー">☰</button>
</div>
<div class="table-wrap"><div class="table">
  ${POS.map((p) => `
  <div class="seat seat--${p}">
    <div class="seat-inner">
      <div class="he"></div>
      <div class="seat-hand"><div class="melds"></div><div class="seat-backs"></div></div>
    </div>
  </div>`).join('')}
  <div class="center">
    ${POS.map((p) => `<div class="pscore pscore--${p}"><span class="feng"></span><span class="pts"></span></div>`).join('')}
    <div class="center-mid"><b></b><span class="jicun"></span></div>
  </div>
  <div class="say"></div>
</div></div>
<div class="myarea">
  <div class="assist"></div>
  <div class="hand-row"><div class="hand"></div><div class="my-melds"></div></div>
</div>
<div class="actions"></div>
<div class="toast"></div>`;

        const $ = (s) => this.root.querySelector(s);
        this.el = {
            table: $('.table'),
            tableWrap: $('.table-wrap'),
            round: $('.hud-round'),
            rest: $('.hud-rest b'),
            furiten: $('.hud-furiten'),
            dora: $('.hud-dora'),
            centerMid: $('.center-mid'),
            say: $('.say'),
            hand: $('.hand'),
            myMelds: $('.my-melds'),
            assist: $('.assist'),
            actions: $('.actions'),
            toast: $('.toast'),
            seats: POS.map((p) => {
                const seat = $(`.seat--${p}`);
                return {
                    he: seat.querySelector('.he'),
                    melds: seat.querySelector('.melds'),
                    backs: seat.querySelector('.seat-backs'),
                };
            }),
            scores: POS.map((p) => $(`.pscore--${p}`)),
        };
        $('.js-menu').addEventListener('click', () => this._onLeave && this._onLeave());

        // 卓は常に正方形。利用できる領域に合わせて JS でサイズを決める
        this.fit();
        if (window.ResizeObserver) {
            new ResizeObserver(() => this.fit()).observe(this.el.tableWrap);
        }
        window.addEventListener('resize', () => this.fit());
        window.addEventListener('orientationchange', () => setTimeout(() => this.fit(), 200));
    }

    set onLeave(fn) { this._onLeave = fn; }

    /** 卓のサイズを利用可能領域に合わせる */
    fit() {
        const wrap = this.el.tableWrap;
        const s = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
        if (!s || s === this._tableSize) return;
        this._tableSize = s;
        this.el.table.style.width = s + 'px';
        this.el.table.style.height = s + 'px';
        this.el.table.style.setProperty('--S', s + 'px');
    }

    /* ================================================ View インタフェース */

    kaiju() { /* 配牌時の redraw に任せる */ }

    redraw() {
        const model = this.player && this.player.model;
        if (!model || !model.shoupai || !model.shoupai.length) return;
        this._drawHud(model);
        this._drawSeats(model);
        this._drawCenter(model);
        this._drawHand(model);
        if (this._dapaiState) this._applyDapaiHandlers();
    }

    update(paipu = {}) {
        if (paipu.dapai) {
            const l = paipu.dapai.l;
            this._lastDapai = { l, i: this.player.model.he[l]._pai.length - 1 };
            sfx.dapai();
        } else if (paipu.zimo || paipu.gangzimo) {
            sfx.zimo();
        } else if (paipu.fulou || paipu.gang) {
            this._lastDapai = null;
            sfx.fulou();
        } else if (paipu.hule) {
            this._lastHule = paipu.hule;
            sfx.hule();
        } else if (paipu.pingju) {
            this._lastPingju = paipu.pingju;
            sfx.pingju();
        }
        this.redraw();
    }

    say(name, l) {
        const text = SAY_TEXT[name];
        if (!text) return;
        if (name === 'lizhi') sfx.lizhi();
        const el = this.el.say;
        el.textContent = text;
        el.className = `say say--${name}`;
        const off = { bottom: [0, 40], right: [46, 0], top: [0, -40], left: [-46, 0] }[POS[this._pos(l)]];
        el.style.marginLeft = off[0] + 'px';
        el.style.marginTop = off[1] + 'px';
        void el.offsetWidth;
        el.classList.add('show');
    }

    summary(paipu) { this._paipu = paipu; }

    /* ==================================================== 描画 */

    /** 座席番号 → 画面位置（0:自分 1:下家 2:対面 3:上家） */
    _pos(l) { return (l - this.player._menfeng + 4) % 4; }

    /** 画面位置 → 座席番号 */
    _seat(pos) { return (pos + this.player._menfeng) % 4; }

    _drawHud(model) {
        this.el.round.textContent = roundName(model.zhuangfeng, model.jushu, model.changbang);
        this.el.rest.textContent = model.shan.paishu;

        this.el.dora.querySelectorAll('.tile').forEach((e) => e.remove());
        for (const p of model.shan.baopai) this.el.dora.appendChild(tileEl(p));
        for (let i = model.shan.baopai.length; i < 5; i++) this.el.dora.appendChild(tileEl('_'));

        const sp = this.player.shoupai;
        const furiten = !!sp && Majiang.Util.xiangting(sp) === 0
                        && this.player._neng_rong === false;
        this.el.furiten.hidden = !furiten;
    }

    _drawSeats(model) {
        const opts = { label: this.settings.tileLabel };
        for (let l = 0; l < 4; l++) {
            const pos = this._pos(l);
            const seat = this.el.seats[pos];
            const shoupai = model.shoupai[l];

            // 河
            seat.he.textContent = '';
            model.he[l]._pai.forEach((p, i) => {
                const called = /[+=\-]$/.test(p);
                const lizhi = p.includes('*');
                const pai = p.replace(/[*+=\-]/g, '');
                const el = lizhi ? rotatedTile(pai, opts) : tileEl(pai, opts);
                if (called) el.style.opacity = '.3';
                if (this._lastDapai && this._lastDapai.l === l && this._lastDapai.i === i) {
                    (el.querySelector('.tile') || el).classList.add('tile--last');
                }
                seat.he.appendChild(el);
            });

            // 副露（自分の分は手牌の隣に描画する）
            seat.melds.textContent = '';
            if (pos !== 0) {
                for (const m of shoupai._fulou) seat.melds.appendChild(meldEl(m, opts));
            }

            seat.backs.textContent = '';
            if (pos === 0) continue;
            const { tiles, drawn } = handTiles(shoupai);
            for (const p of tiles) seat.backs.appendChild(tileEl(p === '_' ? '_' : p));
            if (drawn) {
                const el = tileEl(drawn === '_' ? '_' : drawn);
                el.style.marginLeft = '3px';
                seat.backs.appendChild(el);
            }
        }
    }

    _drawCenter(model) {
        for (let l = 0; l < 4; l++) {
            const box = this.el.scores[this._pos(l)];
            box.querySelector('.feng').textContent = fengName(l);
            box.querySelector('.pts').textContent = model.defen[model.player_id[l]];
            box.classList.toggle('pscore--zhuang', l === 0);
            box.classList.toggle('is-turn', model.lunban === l);
            box.classList.toggle('is-lizhi', !!model.shoupai[l].lizhi);
        }
        this.el.centerMid.querySelector('b').textContent =
            roundName(model.zhuangfeng, model.jushu, 0);
        const jicun = [];
        if (model.changbang) jicun.push(`${model.changbang}本場`);
        if (model.lizhibang) jicun.push(`供託${model.lizhibang}`);
        this.el.centerMid.querySelector('.jicun').textContent = jicun.join(' ');
    }

    _drawHand(model) {
        const hand = this.el.hand;
        hand.textContent = '';
        const shoupai = this.player.shoupai;
        this._handTiles = [];
        if (!shoupai) return;

        const { tiles, drawn } = handTiles(shoupai);
        const opts = { label: this.settings.tileLabel };

        this.el.myMelds.textContent = '';
        for (const m of shoupai._fulou) this.el.myMelds.appendChild(meldEl(m));

        tiles.forEach((p) => {
            const el = tileEl(p, opts);
            hand.appendChild(el);
            this._handTiles.push({ el, p, drawn: false });
        });
        if (drawn) {
            hand.appendChild(h('div', 'zimo-gap'));
            const el = tileEl(drawn, opts);
            hand.appendChild(el);
            this._handTiles.push({ el, p: drawn, drawn: true });
        }
        this._drawAssist(shoupai);
    }

    _drawAssist(shoupai) {
        const box = this.el.assist;
        if (!this.settings.assist) { box.textContent = ''; return; }
        const n = Majiang.Util.xiangting(shoupai);
        if (n < 0) { box.textContent = '和了形'; return; }
        if (n === 0) {
            const wait = Majiang.Util.tingpai(shoupai);
            box.textContent = wait.length
                ? `テンパイ　待ち ${wait.map(paiShort).join(' ')}`
                : 'テンパイ（待ちなし）';
            return;
        }
        box.textContent = `${n}シャンテン`;
    }

    /* ==================================================== 入力 */

    decide(options) {
        return new Promise((resolve) => {
            this._pending = { options, resolve };
            if (options.type === 'zimo') this._promptZimo(options, resolve);
            else if (options.type === 'fulou') this._promptFulou(options, resolve);
            else resolve({});
        });
    }

    _finish(resolve, reply) {
        this._pending = null;
        this._dapaiState = null;
        this._clearActions();
        this._clearHandHandlers();
        resolve(reply);
    }

    _clearActions() {
        this.el.actions.textContent = '';
        const picker = this.root.querySelector('.picker');
        if (picker) picker.remove();
    }

    _clearHandHandlers() {
        this._selected = null;
        for (const t of this._handTiles || []) {
            t.el.classList.remove('is-selected', 'is-disabled');
            t.el.onclick = null;
        }
    }

    _button(label, cls, onClick) {
        const b = h('button', `act ${cls || ''}`, label);
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            sfx.tap();
            onClick(b);
        });
        this.el.actions.appendChild(b);
        return b;
    }

    /* --------------------------------------------------- 自分の手番 */

    _promptZimo(options, resolve) {
        this._clearActions();
        this._dapaiState = { list: options.dapai, lizhi: false, resolve };

        if (options.hule) {
            this._button('ツモ', 'act--hule', () => this._finish(resolve, { hule: '-' }));
        }
        if (options.lizhi && options.lizhi.length) {
            this._button('リーチ', 'act--lizhi', (b) => {
                const on = !this._dapaiState.lizhi;
                this._dapaiState.lizhi = on;
                this._dapaiState.list = on ? options.lizhi : options.dapai;
                this._selected = null;
                b.style.filter = on ? 'brightness(1.4)' : '';
                this.toast(on ? '捨てる牌を選んでください' : 'リーチを取り消しました');
                this._applyDapaiHandlers();
            });
        }
        if (options.gang && options.gang.length) {
            this._button('カン', '', () => {
                this._pickMianzi('カンする面子', options.gang,
                    (m) => { if (m) this._finish(resolve, { gang: m }); });
            });
        }
        if (options.pingju) {
            this._button('九種九牌', 'act--skip', () => this._finish(resolve, { daopai: '-' }));
        }
        this._applyDapaiHandlers();
    }

    _applyDapaiHandlers() {
        const st = this._dapaiState;
        if (!st) return;
        this._clearHandHandlers();
        for (const t of this._handTiles) {
            const key = findDapai(st.list, t.p, t.drawn);
            if (!key) { t.el.classList.add('is-disabled'); continue; }
            t.el.onclick = () => this._tapDapai(t, key);
        }
    }

    _tapDapai(tile, key) {
        const st = this._dapaiState;
        if (!st) return;
        if (this.settings.confirmDapai && this._selected !== tile) {
            if (this._selected) this._selected.el.classList.remove('is-selected');
            this._selected = tile;
            tile.el.classList.add('is-selected');
            sfx.tap();
            return;
        }
        this._finish(st.resolve, { dapai: key + (st.lizhi ? '*' : '') });
    }

    /* ------------------------------------------------- 他家の打牌 */

    _promptFulou(options, resolve) {
        this._clearActions();
        this._clearHandHandlers();

        if (options.hule) {
            this._button('ロン', 'act--hule', () => this._finish(resolve, { hule: '-' }));
        }
        const pick = (label, list) => {
            if (!list || !list.length) return;
            this._button(label, '', () => {
                this._pickMianzi(`${label}する面子`, list,
                    (m) => { if (m) this._finish(resolve, { fulou: m }); });
            });
        };
        pick('カン', options.gang);
        pick('ポン', options.peng);
        pick('チー', options.chi);
        this._button('パス', 'act--skip', () => this._finish(resolve, {}));
    }

    _pickMianzi(title, list, cb) {
        if (list.length === 1) return cb(list[0]);

        const picker = h('div', 'picker');
        picker.appendChild(h('div', 'picker-title', title));
        const row = h('div', 'picker-row');
        for (const m of list) {
            const opt = h('button', 'picker-opt');
            opt.appendChild(meldEl(m, { label: this.settings.tileLabel }));
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                sfx.tap();
                picker.remove();
                cb(m);
            });
            row.appendChild(opt);
        }
        picker.appendChild(row);
        const cancel = h('button', 'act act--skip', 'やめる');
        cancel.addEventListener('click', () => { picker.remove(); cb(null); });
        picker.appendChild(cancel);
        this.root.appendChild(picker);
    }

    /* ==================================================== 結果表示 */

    acknowledge(kind) {
        this._clearActions();
        this._clearHandHandlers();
        this._dapaiState = null;
        if (kind === 'hule') return this._showHule();
        if (kind === 'pingju') return this._showPingju();
        return this._showJieju();
    }

    _dialog(build) {
        return new Promise((resolve) => {
            const dlg = h('div', 'dialog');
            build(dlg, (v) => {
                this.overlay.hidden = true;
                this.overlay.textContent = '';
                resolve(v);
            });
            this.overlay.textContent = '';
            this.overlay.appendChild(dlg);
            this.overlay.hidden = false;
        });
    }

    _showHule() {
        const hule = this._lastHule;
        const model = this.player.model;
        if (!hule) return Promise.resolve();

        return this._dialog((dlg, close) => {
            const winner = POS_LABEL[this._pos(hule.l)];
            const kind = hule.baojia == null ? 'ツモ' : 'ロン';
            const head = h('h2', null, `${kind}　${winner}`);
            if (hule.baojia != null) {
                head.appendChild(h('span', 'sub', `放銃 ${POS_LABEL[this._pos(hule.baojia)]}`));
            }
            dlg.appendChild(head);

            // 和了形（最後の 1 枚が和了牌）
            const handRow = h('div', 'result-hand');
            const parts = hule.shoupai.split(',');
            const tiles = splitPai(parts[0]);
            tiles.forEach((p, i) => {
                const last = i === tiles.length - 1;
                if (last) handRow.appendChild(h('div', 'divider'));
                const el = tileEl(p);
                if (last) el.classList.add('tile--last');
                handRow.appendChild(el);
            });
            for (const m of parts.slice(1)) {
                if (!m) continue;
                handRow.appendChild(h('div', 'divider'));
                handRow.appendChild(meldEl(m));
            }
            dlg.appendChild(handRow);

            // ドラ表示牌
            const doraRow = h('div', 'result-hand result-dora');
            doraRow.appendChild(h('span', null, 'ドラ'));
            for (const p of model.shan.baopai) doraRow.appendChild(tileEl(p));
            if (hule.fubaopai && hule.fubaopai.length) {
                doraRow.appendChild(h('span', null, '裏'));
                for (const p of hule.fubaopai) doraRow.appendChild(tileEl(p));
            }
            dlg.appendChild(doraRow);

            // 役
            const ul = h('ul', 'hupai-list');
            for (const v of hule.hupai || []) {
                const li = h('li');
                li.appendChild(h('span', null, v.name));
                li.appendChild(h('span', null, typeof v.fanshu === 'number'
                    ? `${v.fanshu}翻` : v.fanshu === '**' ? 'ダブル役満' : '役満'));
                ul.appendChild(li);
            }
            dlg.appendChild(ul);

            const rank = defenRank(hule);
            const detail = hule.damanguan ? rank
                : `${hule.fu}符 ${hule.fanshu}翻${rank ? ' ' + rank : ''}`;
            const total = h('div', 'result-total', `${hule.defen}点 `);
            total.appendChild(h('small', null, detail));
            dlg.appendChild(total);

            dlg.appendChild(this._fenpeiTable(hule.fenpei, model));
            this._dialogButton(dlg, '次へ', close);
        });
    }

    _showPingju() {
        const pingju = this._lastPingju;
        const model = this.player.model;
        if (!pingju) return Promise.resolve();

        return this._dialog((dlg, close) => {
            dlg.appendChild(h('h2', null, pingju.name || '流局'));
            const list = h('div');
            for (let pos = 0; pos < 4; pos++) {
                const l = this._seat(pos);
                const row = h('div', 'setting-row');
                row.appendChild(h('span', null, POS_LABEL[pos]));
                row.appendChild(h('span', null, pingju.shoupai[l] ? 'テンパイ' : 'ノーテン'));
                list.appendChild(row);
            }
            dlg.appendChild(list);
            dlg.appendChild(this._fenpeiTable(pingju.fenpei, model));
            this._dialogButton(dlg, '次へ', close);
        });
    }

    _fenpeiTable(fenpei, model) {
        const box = h('div', 'fenpei');
        for (let pos = 0; pos < 4; pos++) {
            const l = this._seat(pos);
            const v = fenpei[l];
            box.appendChild(h('span', 'name', POS_LABEL[pos]));
            box.appendChild(h('span', 'num', String(model.defen[model.player_id[l]])));
            box.appendChild(h('span', `num ${v > 0 ? 'plus' : v < 0 ? 'minus' : ''}`,
                v > 0 ? `+${v}` : v < 0 ? `${v}` : '±0'));
        }
        return box;
    }

    _showJieju() {
        const paipu = this._paipu;
        const model = this.player.model;
        this.jiejuChoice = null;
        if (!paipu) return Promise.resolve();

        return this._dialog((dlg, close) => {
            dlg.appendChild(h('h2', null, '終局'));
            const table = h('table', 'rank-table');
            table.innerHTML = '<tr><th>順位</th><th>プレイヤー</th><th class="num">点数</th><th class="num">スコア</th></tr>';
            const order = [0, 1, 2, 3].sort((a, b) => paipu.rank[a] - paipu.rank[b]);
            for (const id of order) {
                const tr = h('tr');
                if (id === this.player._id) tr.className = 'me';
                tr.appendChild(h('td', null, `${paipu.rank[id]}位`));
                tr.appendChild(h('td', null, model.player[id]));
                tr.appendChild(h('td', 'num', String(paipu.defen[id])));
                tr.appendChild(h('td', 'num', String(paipu.point[id])));
                table.appendChild(tr);
            }
            dlg.appendChild(table);

            const actions = h('div', 'dialog-actions');
            const again = h('button', 'dialog-btn', 'もう一局');
            again.addEventListener('click', () => { this.jiejuChoice = 'again'; close(); });
            const title = h('button', 'dialog-btn dialog-btn--sub', 'タイトルへ');
            title.addEventListener('click', () => { this.jiejuChoice = 'title'; close(); });
            actions.append(again, title);
            dlg.appendChild(actions);
        });
    }

    _dialogButton(dlg, label, close) {
        const actions = h('div', 'dialog-actions');
        const b = h('button', 'dialog-btn', label);
        b.addEventListener('click', () => { sfx.tap(); close(); });
        actions.appendChild(b);
        dlg.appendChild(actions);
    }

    toast(msg, ms = 1500) {
        const el = this.el.toast;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(this._toastId);
        this._toastId = setTimeout(() => el.classList.remove('show'), ms);
    }
}

/* ------------------------------------------------------------ helpers */

function paiShort(p) {
    const s = p[0], n = +p[1];
    if (s === 'z') return ['', '東', '南', '西', '北', '白', '發', '中'][n];
    return (n === 0 ? 5 : n) + s;
}

/** 打牌候補リストから、タップされた牌に対応する文字列を探す */
function findDapai(list, p, drawn) {
    if (!list) return null;
    if (drawn) return list.find((x) => x === p + '_') || list.find((x) => x === p) || null;
    return list.find((x) => x === p) || null;
}
