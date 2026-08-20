/*
 *  人間（プレイヤー）用の対局者クラス
 *
 *  @kobalab/majiang-core の Majiang.Player を継承し、
 *  思考ルーチンの代わりに UI からの入力を待って応答する。
 */
'use strict';

import Majiang from '@kobalab/majiang-core';

/** 自分から見た相対方向記号（打牌者 → 自分） */
function fromDir(model, menfeng) {
    return ['', '+', '=', '-'][(4 + model.lunban - menfeng) % 4];
}

export default class HumanPlayer extends Majiang.Player {

    /** @param {object} ui  非同期に選択を返す UI アダプタ */
    constructor(ui) {
        super();
        this._ui = ui;
        ui.player = this;
    }

    action_kaiju() { this._callback(); }
    action_qipai() { this._callback(); }

    /* ------------------------------------------------ 自分のツモ番 */
    action_zimo(zimo, gangzimo) {
        if (zimo.l !== this._menfeng) return this._callback();

        const options = {
            type: 'zimo',
            hule: this.allow_hule(this.shoupai, null, gangzimo),
            pingju: this.allow_pingju(this.shoupai),           // 九種九牌
            gang: this.get_gang_mianzi(this.shoupai) || [],    // 暗槓/加槓
            lizhi: this.allow_lizhi(this.shoupai) || false,    // 立直可能な打牌の配列
            dapai: this.get_dapai(this.shoupai) || [],
        };
        this._respond(this._ui.decide(options));
    }

    /* ------------------------------------------- 他家の打牌に対する反応 */
    action_dapai(dapai) {
        if (dapai.l === this._menfeng) {
            // ノーテン宣言ルール使用時のみ選択肢がある
            if (this.allow_no_daopai(this.shoupai)) {
                return this._respond(
                    this._ui.decide({ type: 'daopai', shoupai: this.shoupai.toString() }));
            }
            return this._callback();
        }

        const p = dapai.p.slice(0, 2) + fromDir(this._model, this._menfeng);
        const options = {
            type: 'fulou',
            pai: p,
            hule: this.allow_hule(this.shoupai, p),                    // ロン
            gang: this.get_gang_mianzi(this.shoupai, p) || [],         // 大明槓
            peng: this.get_peng_mianzi(this.shoupai, p) || [],         // ポン
            chi: this.get_chi_mianzi(this.shoupai, p) || [],           // チー
        };
        if (!options.hule && !options.gang.length
            && !options.peng.length && !options.chi.length) {
            return this._callback();
        }
        this._respond(this._ui.decide(options));
    }

    /* ------------------------------------------------ 副露後の打牌 */
    action_fulou(fulou) {
        if (fulou.l !== this._menfeng) return this._callback();
        if (fulou.m.match(/^[mpsz]\d{4}/)) return this._callback(); // 大明槓 → 嶺上ツモへ

        this._respond(this._ui.decide({
            type: 'zimo',
            hule: false, pingju: false, gang: [], lizhi: false,
            dapai: this.get_dapai(this.shoupai) || [],
        }));
    }

    /* ------------------------------------------------ 槍槓 */
    action_gang(gang) {
        if (gang.l === this._menfeng) return this._callback();
        if (gang.m.match(/^[mpsz]\d{4}$/)) return this._callback(); // 暗槓は槍槓不可

        const p = gang.m[0] + gang.m.slice(-1) + fromDir(this._model, this._menfeng);
        if (!this.allow_hule(this.shoupai, p, true)) return this._callback();

        this._respond(this._ui.decide({
            type: 'fulou', pai: p, hule: true, gang: [], peng: [], chi: [], qianggang: true,
        }));
    }

    /* ------------------------------------------------ 局の結果 */
    action_hule()   { this._respond(this._ui.acknowledge('hule')); }
    action_pingju() { this._respond(this._ui.acknowledge('pingju')); }
    action_jieju()  { this._respond(this._ui.acknowledge('jieju')); }

    _respond(promise) {
        const cb = this._callback;
        Promise.resolve(promise).then((reply) => cb(reply || {}));
    }
}
