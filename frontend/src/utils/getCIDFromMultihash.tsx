import bs58 from 'bs58';

/**
 * Converts a multihash to a CID
 * @param data Multihash data
 * @returns CID
 */
const getCIDFromMultihash = (data: any) => {
  // Check that the hash data is valid
  if (!data[0] || !data[1] || !data[2]) {
    throw new Error(
      'Invalid or incomplete hash data returned by getLatestHash function'
    );
  }
  // Restore the IPFS hash from the digest, hashFunction, and size
  const digestTrimmed = (data[0] as string).slice(2);
  // Convert the digest string to a hex number
  const digestBytes: number[] = [];
  for (let n = 0; n < digestTrimmed.length; n += 2) {
    digestBytes.push(parseInt(digestTrimmed.slice(n, n + 2), 16));
  }

  const byteArray = [data[1], data[2], ...digestBytes];
  // Restore the base58 encoded hash
  const encodedHash = bs58.encode(byteArray as number[]);
  return encodedHash;
};

export default getCIDFromMultihash;
