# Sandscreener

Sandscreener is a set of tools that enables a Tornado Cash user (User) to anonymously prove to an interested party (Auditor) that User’s deposit address is not in a blocklist specified by a verified third party (Editor).

## Project Description

### Repository Contract

Sandscreener Repository Contract maintains the references to blocklists submitted by Editors, and also maintains the proofs of non-inclusion into blocklists submitted by Users. The Editors are approved by the Auditor who is granted the `DEFAULT_ADMIN_ROLE` upon the smart contract deployment. The `DEFAULT_ADMIN_ROLE` can be transferred to another address by the current `DEFAULT_ADMIN_ROLE` holder. To approve an Editor, the Auditor grants the `EDITOR_ROLE` to the Editor's Ethereum address.

The blocklists are stored in the contract in the form of an IPFS multihash.

The Users will be able to submit proofs in a permissonless manner after the proofs are verified inside the smart contract.

### Backend

Sandscreener Auditor Backend will provide the REST API services for the User frontend to submit the generated zero-knowledge proof (ZKP) of non-inclusion in the blocklist.

## Building and Running

1. Please follow the `Installation & Setup` steps in the README files of the [backend](backend/README.md#installation--setup), [repository](repository/README.md#installation--setup) and [frontend](frontend/README.md#installation--setup) folders.

2. Copy and rename the `.env.example` file to `.env` and fill in the private key for the Auditor Ethereum account (`AUDITOR_PRIVATE_KEY`) and the RPC URL that you intend to use with the application (`GOERLI_URL`).

3. Deploy the Repository Contract to Goerli testnet. Make sure that you have provided the private key and the RPC URL in the `repository/.env` file. Run:

   ```sh
   cd repository
   npx hardhat run scripts/deploy.ts --network goerli
   ```

4. Make sure Docker is installed and running. If not, follow the instructions [here](https://docs.docker.com/get-docker/). To check the installation, run:

   ```sh
   docker --version
   docker compose version
   ```

   You will need to have Docker Compose version 20.10.17 or higher and Docker Compose version 2.7.0 or higher.

5. Build and run the containers. The `docker-compose.yml` file contains the configuration for the containers. The DB container is configured to remap the default port to `2345`. This is to avoid conflicts with a local PostgreSQL installation. If the port `2345` is occupied on your machine, you need to change it in the `docker-compose.yml` file as well as in the `postgres` connection string in `backend/config/default.json` file:

   ```sh
   docker-compose up --build --remove-orphans
   ```

## Testing

To test the application, follow the instructions in the README files of the [backend](backend/README.md#testing) and [repository](repository/README.md#testing) folders. Backend test suite includes a local integration test.

## Using the Application

1. Make sure you have the application running and the contract deployed as described in the [Building and Running](#building-and-running) section.

2. To test the retrieval of the blocklist from IPFS in the backend, it is necessary to first pin a blocklist in IPFS. The blocklist should be a JSON file containing an object with the `blocklist` array field holding the array of Ethereum addresses:

   ```json
   {
     "blocklist": [
       "0xdeadbeef0123456789abcdef0123456789abcdef",
       "0xabcd1234abcd1234abcd1234abcd1234abcd1234"
     ]
   }
   ```

   Refer to `repository/blocklist.json` for an example. To pin the blocklist in IPFS, feel free to use any of the available pinning services, such as [Pinata](https://pinata.cloud/). After pinning the blocklist, you will get the CID of the blocklist (e.g., `QmTQu3Lk3rmJkWXAKZ3h3vYY1UPSp9GFAZLmY3b17fZGKm`).

3. The metadata about an IPFS CID (Content Identifier) is stored in the contract in the from of a Multihash. The Multihash is a structure that contains the following fields:

   - digest: represents the IPFS CID
   - hashFunction: specifies the hash function used to create the CID
   - size: specifies the size of the CID in bytes

   To convert your blocklist CID into the Multihash, you can use the `cid-to-multihash` script in the `repository/scripts` folder:

   ```sh
   cd repository
   node scripts/cid-to-multihash.js QmTQu3Lk3rmJkWXAKZ3h3vYY1UPSp9GFAZLmY3b17fZGKm
   ```

   It will output the digest, hashFunction and size values that you need to use as the arguments for the `addListHash` function in the Repository Contract.

4. You can use the frontend to interact with the Repository Contract. To run the frontend, execute:

   ```sh
   cd frontend
   npm run dev
   ```

   The frontend will be available at http://localhost:3001/ (port 3000 is reserved for the backend).

5. Use the wallet of your choice to connect the Auditor account to the frontend. The default Auditor account is the one that you used to deploy the contract. You will see the message `You are the Admin of this contract` in the UI if you connected the correct account. To appoint an Editor, input the Editor's Ethereum address and press `Grant Editor Role`, then confirm the transaction. After the Editor is successfully appointed, they can run the frontend and connect their Ethereum account to it. If the user is an Editor, they will see the message `You are an Editor` in the UI. The Auditor can revoke the Editor role in a similar manner.

6. The Editor can now submit the blocklist to the Repository Contract. To do that, they need to provide the necessary arguments to the addListHash function. The arguments are the digest, hashFunction and size values. There is a convenience function in the frontend that converts an IPFS CID into the Multihash format. Paste the blocklist IPFS CID into the `CID` field, press `Convert CID to Multihash`, and the digest, hashFunction and size values will be populated automatically. Then, press `Submit Blocklist` to submit the blocklist to the Repository Contract and wait for the transaction to be mined.

7. Test the blocklist retrieval in the backend service. First, create a new user for the backend API:

   ```sh
   curl --location --request POST 'http://localhost:3000/users' \
   --header 'Content-Type: application/json' \
   --header 'Accept: application/json' \
   --data-raw '{
   	"email": "hello@feathersjs.com",
   	"password": "supersecret"
   }'
   ```

   Then, get an authentication token for the user:

   ```sh
   curl --location --request POST 'http://localhost:3000/authentication' \
   --header 'Content-Type: application/json' \
   --header 'Accept: application/json' \
   --data-raw '{
   	"strategy": "local",
   	"email": "hello@feathersjs.com",
   	"password": "supersecret"
   }'
   ```

   Save the token from the response and use it to make the blocklist request. The request accepts the Ethereum address of an Editor as a query parameter. Here's an example of a request (replace the address and the token values with your own):

   ```sh
   curl --location --request GET 'http://localhost:3000/blocklist?address=0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199' \
   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6ImFjY2VzcyJ9.eyJpYXQiOjE2NzI3Mzg5ODQsImV4cCI6MTY3MjgyNTM4NCwiYXVkIjoiaHR0cHM6Ly95b3VyZG9tYWluLmNvbSIsImlzcyI6ImZlYXRoZXJzIiwic3ViIjoiMSIsImp0aSI6IjExNGY5NGFiLTY0ZWItNDM2NC1iYWEyLWNhYjZlMDIyNTZmZiJ9.yX412VSyRTn6LfDX8TOGR2pXxvfOme2vgMFyYmykmic'
   ```

   The response will contain the blocklist in the following format:

   ```json
   {
      ...
     "result": {
       "encodedHash": "Qmf5fFadtidqhR6gsP2F46Hpow6h7oxEZsJdqcKLihciXN",
       "blocklist": [
         "0xdeadbeef0123456789abcdef0123456789abcdef",
         "0xabcd123234234625625625362456345645345734"
         ...
       ]
     }
   }
   ```
