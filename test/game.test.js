/*
 *  局進行のスモークテスト
 *
 *  CPU 4 人で対局を最後まで進め、例外なく終局して
 *  点数の合計が保たれることを確認する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Majiang from '@kobalab/majiang-core';
import AI from '@kobalab/majiang-ai';
import { ruleParam, DEFAULTS } from '../src/settings.js';

function playOne(kind) {
    const rule = Majiang.rule(ruleParam({ ...DEFAULTS, kind }));
    let paipu = null;
    const game = new Majiang.Game(
        [new AI(), new AI(), new AI(), new AI()],
        (p) => { paipu = p; },
        rule,
        'test',
    );
    game.do_sync();
    return { paipu, rule };
}

for (const kind of ['ikkyoku', 'tonpu', 'hanchan']) {
    test(`${kind}: 終局まで進行する`, () => {
        const { paipu, rule } = playOne(kind);
        assert.ok(paipu, '牌譜が返る');
        assert.equal(paipu.defen.length, 4);
        const total = paipu.defen.reduce((a, b) => a + b, 0);
        assert.equal(total, rule['配給原点'] * 4, '点棒の合計は変わらない');
        assert.deepEqual([...paipu.rank].sort(), [1, 2, 3, 4]);
        assert.ok(paipu.log.length > 0);
    });
}

test('ruleParam: 設定がルールに反映される', () => {
    assert.equal(ruleParam({ ...DEFAULTS, kind: 'ikkyoku' })['場数'], 0);
    assert.equal(ruleParam({ ...DEFAULTS, kind: 'tonpu' })['場数'], 1);
    assert.equal(ruleParam({ ...DEFAULTS, kind: 'hanchan' })['場数'], 2);
    assert.deepEqual(ruleParam({ ...DEFAULTS, aka: false })['赤牌'], { m: 0, p: 0, s: 0 });
    assert.equal(ruleParam({ ...DEFAULTS, kuitan: false })['クイタンあり'], false);
});
