# Backend

Auditor backend will provide the REST API services for the User frontend to submit the generated zero-knowledge proof (ZKP) of non-inclusion in the blocklist.

## Installation & Setup

1. Make sure you have [NodeJS](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
2. Install your dependencies

   ```
   cd path/to/backend
   npm install
   ```

3. Install PostgreSQL (e.g., from `https://www.postgresql.org/download/`) and create a database called `backend` with the user `postgres` and password `postgres`. The development app flavor expects it to run on the default port 5432 (otherwise see `backend/config/default.json` for the configuration).
4. Deploy the [repository contract](../repository/README.md)

## Local Development and Debugging

Start the app by running

```
npm run start-dev
```

The default app config is in `config/default.json`. Please see [Feathers Configuration](https://feathersjs.com/api/configuration.html) and [Node Config](https://github.com/node-config/node-config) documentation for more details. TLDR: the individual json files in the `config` directory correspond to the `NODE_ENV` environment variable. E.g., `docker.json` is used when the app is built from the parent directory using `docker compose`. As you can see in [docker-compose.yml](../docker-compose.yml), the environment variables for the `backend` service set the `NODE_ENV` to `docker` and `NODE_CONFIG` to a JSON string replacing some of the default secrets.

## Testing

1. Make sure that the PostgreSQL database is set up as described in the previous section and is running.
2. Make sure that the local chain is running. To run a local Hardhat node, run `npx hardhat node` in the `repository` folder.

```shell
cd ../repository
npx hardhat node
```

3. Deploy the Repository contract to the local chain. To do so, run `npx hardhat run scripts/deploy.ts --network localhost` in the `repository` folder.

```shell
cd ../repository
npx hardhat run scripts/deploy.ts
```

4. Create a database named `test` in your local Postgres server. The expected default username and password are `postgres`, but can be changed in the [test config](./config/test.json).
5. Run `npm test`. See `backend/config/test.json` for the DB port and local chain configuration. The coverage report will be available in the `coverage` folder.
