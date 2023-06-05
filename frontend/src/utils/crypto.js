import { BN } from "web3-utils";
import { utils } from "ffjavascript";
import { buildBabyjub, buildPedersenHash } from "circomlibjs";

const CUT_LENGTH = 31;

export async function parseNote(note) {
  const [, currency, amount, netId, hexNote] = note.split("-");

  return {
    ...(await parseHexNote(hexNote)),
    netId,
    amount,
    currency,
  };
}

export async function parseHexNote(hexNote) {
  const buffNote = Buffer.from(hexNote.slice(2), "hex");

  const babyjub = await buildBabyjub();
  const pedersen = await buildPedersenHash();

  const nullifier = utils.leBuff2int(buffNote.slice(0, CUT_LENGTH));
  const secret = utils.leBuff2int(buffNote.slice(CUT_LENGTH, CUT_LENGTH * 2));

  const preimage = Buffer.concat([
    Buffer.from(utils.leInt2Buff(nullifier, CUT_LENGTH)),
    Buffer.from(utils.leInt2Buff(secret, CUT_LENGTH)),
  ]);
  const commitment = buffPedersenHash(babyjub, pedersen, preimage);
  const nullifierHash = buffPedersenHash(
    babyjub,
    pedersen,
    utils.leInt2Buff(nullifier, CUT_LENGTH)
  );

  return {
    secret,
    nullifier,
    commitment,
    nullifierHash,
    commitmentHex: toFixedHex(commitment),
    nullifierHex: toFixedHex(nullifierHash),
  };
}

export function leInt2Buff(value) {
  return new BN(value, 16, "le");
}

export function buffPedersenHash(babyjub, pedersen, data) {
  return babyjub.F.toObject(
    babyjub.unpackPoint(Buffer.from(pedersen.hash(data)))[0]
  );
}

export function toFixedHex(value, length = 32) {
  return "0x" + value.toString(16).padStart(length * 2, "0");
}
