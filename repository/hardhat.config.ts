import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import * as dotenv from "dotenv";
dotenv.config();
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
      forking: {
        url: process.env.GOERLI_URL,
      },
    },
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.GOERLI_URL,
        blockNumber: 9299399,
      },
    },
    goerli: {
      chainId: 5,
      url: process.env.GOERLI_URL,
      accounts: [process.env.GOERLI_PRIVATE_KEY],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          evmVersion: "istanbul",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "contracts",
    tests: "test",
    cache: "cache",
    artifacts: "artifacts",
    out: "build/out",
  },
};
