import { BN } from 'web3-utils';

import { pedersen } from './pedersen';

const CUT_LENGTH = 31;

export function parseNote(note) {
  const [, currency, amount, netId, hexNote] = note.split('-');

  return {
    ...parseHexNote(hexNote),
    netId,
    amount,
    currency,
  };
}

export function parseHexNote(hexNote) {
  const buffNote = Buffer.from(hexNote.slice(2), 'hex');

  const commitment = buffPedersenHash(buffNote);

  const nullifierBuff = buffNote.slice(0, CUT_LENGTH);
  const nullifierHash = BigInt(buffPedersenHash(nullifierBuff));
  const nullifier = BigInt(leInt2Buff(buffNote.slice(0, CUT_LENGTH)));

  const secret = BigInt(leInt2Buff(buffNote.slice(CUT_LENGTH, CUT_LENGTH * 2)));

  return {
    secret,
    nullifier,
    commitment,
    nullifierBuff,
    nullifierHash,
    commitmentHex: toFixedHex(commitment),
    nullifierHex: toFixedHex(nullifierHash),
  };
}

export function leInt2Buff(value) {
  return new BN(value, 16, 'le');
}

export function buffPedersenHash(buffer) {
  const [hash] = pedersen.unpackPoint(buffer);
  return pedersen.toStringBuffer(hash);
}

export function toFixedHex(value, length = 32) {
  const isBuffer = value instanceof Buffer;

  const str = isBuffer ? value.toString('hex') : BigInt(value).toString(16);
  return '0x' + str.padStart(length * 2, '0');
}
