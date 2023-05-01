// Takes the CID as a command line argument and converts it to a multihash
const { argv } = require('process');
const { ethers } = require('ethers');
//Parse args and get the CID
const cid = argv[2];
const bs58 = require('bs58');
const hashBytes = bs58.decode(cid);

const digest = ethers.utils.hexValue(hashBytes.slice(2));
const hashFunction = hashBytes[0];
const size = hashBytes[1];

//Output the multihash
console.log('digest', digest);
console.log('hashFunction', hashFunction);
console.log('size', size);
