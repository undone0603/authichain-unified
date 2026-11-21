import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextOnchainScanFrom } from './onchain-cursor.mjs';

test('partial 10-chunk catch-up resumes at next block, never the head', () => {
  assert.equal(nextOnchainScanFrom('10000', '5249'), '5250');
});
test('realistic 13k-block backlog does not skip unscanned ranges', () => {
  assert.equal(nextOnchainScanFrom('53506326', '53495701'), '53495702');
});
test('completed scan overlaps recent blocks for late or reorganized logs', () => {
  assert.equal(nextOnchainScanFrom('10000', '10000'), '9750');
});
test('short chain overlaps back to genesis safely', () => {
  assert.equal(nextOnchainScanFrom('40', '40'), '0');
});
test('no confirmed scanned block means keep previous cursor', () => {
  for (const through of [null, undefined, '', '-1', 'not-a-block']) {
    assert.equal(nextOnchainScanFrom('10000', through), null);
  }
});
test('future or invalid latest block fails closed', () => {
  assert.equal(nextOnchainScanFrom('100', '101'), null);
  assert.equal(nextOnchainScanFrom('oops', '99'), null);
  assert.equal(nextOnchainScanFrom(null, '99'), null);
});
test('invalid overlap fails closed', () => {
  assert.equal(nextOnchainScanFrom('100', '100', -1n), null);
  assert.equal(nextOnchainScanFrom('100', '100', 'not-an-integer'), null);
});
test('explicit zero overlap and exact head are supported', () => {
  assert.equal(nextOnchainScanFrom('100', '100', 0n), '100');
});
test('very large chain heights retain integer precision', () => {
  assert.equal(nextOnchainScanFrom('90071992547409930', '90071992547409929'), '90071992547409930');
});
