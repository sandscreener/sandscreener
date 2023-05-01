# Sandscreener Repository Contract

Sandscreener Repository Contract maintains the references to blocklists submitted by Editors, and also maintains the proofs of non-inclusion into blocklists submitted by Users.

## Installation & Setup

1. Run the following command to install the dependencies:

```shell
npm install
```

2. Copy and rename the `.env.example` file to `.env` and fill in the private key for your Ethereum account (`GOERLI_PRIVATE_KEY`) and the RPC URL that you intend to use with the application (`GOERLI_URL`).

3. [Compile the ZKP circuit and generate the verifier contract](../circuits/README.md)

## Testing

Run the Hardhat test suite with coverage using:

```shell
npx hardhat coverage
```

The coverage report will be available in the `coverage` folder.

## Deployment

To deploy the contract to a local Hardhat node, run:

```shell
npx hardhat run scripts/deploy.ts --network localhost
```

To deploy to Goerli testnet, make sure that you have provided the private key and the RPC URL in the `.env` file. Run:

```shell
npx hardhat run scripts/deploy.ts --network goerli
```
