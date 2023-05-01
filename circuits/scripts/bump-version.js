const fs = require('fs');

const solidityRegex = /pragma solidity \^\d+\.\d+\.\d+/;

let verifier = fs.readFileSync('./../repository/contracts/withdraw.sol', {
  encoding: 'utf-8',
});
verifier = verifier.replace(solidityRegex, 'pragma solidity ^0.8.16');
fs.writeFileSync('./../repository/contracts/withdraw.sol', verifier);
