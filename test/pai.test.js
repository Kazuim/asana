/*
 *  牌姿・面子の解析のテスト
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Majiang from '@kobalab/majiang-core';
import { splitPai, handTiles, parseMeld, defenRank, roundName } from '../src/pai.js';

test('splitPai: 牌姿を牌の配列に分解する', () => {
    assert.deepEqual(splitPai('m123p0z17'), ['m1', 'm2', 'm3', 'p0', 'z1', 'z7']);
    assert.deepEqual(splitPai('___'), ['_', '_', '_']);
    assert.deepEqual(splitPai(''), []);
});

test('handTiles: ツモ牌を分離する', () => {
    const sp = Majiang.Shoupai.fromString('m1234p456s789z1122');
    const { tiles, drawn } = handTiles(sp);
    assert.equal(tiles.length, 13);
    assert.equal(drawn, 'z2');
});

test('handTiles: 副露があるときも枚数が合う', () => {
    const sp = Majiang.Shoupai.fromString('m123p456s78z11,m789-');
    const { tiles, drawn } = handTiles(sp);
    assert.equal(tiles.length, 10);
    assert.equal(drawn, null);
});

test('handTiles: 他家の伏せ牌', () => {
    const sp = Majiang.Shoupai.fromString('_'.repeat(14));
    const { tiles, drawn } = handTiles(sp);
    assert.equal(tiles.length, 13);
    assert.equal(drawn, '_');
});

test('parseMeld: チーは鳴いた牌を左端に横向きで置く', () => {
    const { tiles } = parseMeld('m12-3');
    assert.equal(tiles.length, 3);
    assert.deepEqual(tiles[0], { p: 'm2', rotate: true, back: false, stack: null });
    assert.deepEqual(tiles.slice(1).map((t) => t.p), ['m1', 'm3']);
});

test('parseMeld: ポンは相手の方向で横向きの位置が変わる', () => {
    assert.equal(parseMeld('m111-').tiles.findIndex((t) => t.rotate), 0);
    assert.equal(parseMeld('m111=').tiles.findIndex((t) => t.rotate), 1);
    assert.equal(parseMeld('m111+').tiles.findIndex((t) => t.rotate), 2);
});

test('parseMeld: 暗槓は両端が伏せ牌', () => {
    const { tiles } = parseMeld('m1111');
    assert.equal(tiles.length, 4);
    assert.equal(tiles[0].back, true);
    assert.equal(tiles[3].back, true);
    assert.equal(tiles[1].back, false);
});

test('parseMeld: 加槓は横向き牌の上に重ねる', () => {
    const { tiles } = parseMeld('p505+0');
    assert.equal(tiles.length, 3);
    const rot = tiles.find((t) => t.rotate);
    assert.equal(rot.stack, 'p0');
});

test('parseMeld: 大明槓は 4 枚 + 横向き 1 枚', () => {
    const { tiles } = parseMeld('s1111-');
    assert.equal(tiles.length, 4);
    assert.equal(tiles.filter((t) => t.rotate).length, 1);
    assert.equal(tiles.filter((t) => t.back).length, 0);
});

test('parseMeld: 赤牌を含むチー', () => {
    const { tiles } = parseMeld('s067-');
    assert.deepEqual(tiles.map((t) => t.p), ['s7', 's0', 's6']);
});

test('defenRank: 点数の格', () => {
    assert.equal(defenRank({ fanshu: 5 }), '満貫');
    assert.equal(defenRank({ fanshu: 6 }), '跳満');
    assert.equal(defenRank({ fanshu: 8 }), '倍満');
    assert.equal(defenRank({ fanshu: 11 }), '三倍満');
    assert.equal(defenRank({ fanshu: 13 }), '数え役満');
    assert.equal(defenRank({ damanguan: 1 }), '役満');
    assert.equal(defenRank({ damanguan: 2 }), '2倍役満');
    assert.equal(defenRank({ fanshu: 4, fu: 30 }), '満貫');
    assert.equal(defenRank({ fanshu: 2, fu: 30 }), '');
});

test('roundName: 局名', () => {
    assert.equal(roundName(0, 0, 0), '東1局');
    assert.equal(roundName(1, 3, 2), '南4局 2本場');
});
