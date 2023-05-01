import configuration from '@feathersjs/configuration';
import assert from 'assert';
import app from '../../src/app';
import contractAbis from '../../src/contracts/contractAbi.json';
import deployments from '../../src/contracts/deployments.json';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import services from '../../src/services';
import { ABIs, Deployments } from '../../src/services/repository/repository.class';

describe('\'blocklist\' service integration test', () => {
  before(async () => {
    app.configure(services);
    app.configure(configuration());
    // Delete all blocklists stored in the DB
    await app.service('blocklist').remove(null);
  });

  after(async () => {
    // Delete all blocklists stored in the DB
    await app.service('blocklist').remove(null);
  });

  it('find method should return the encoded hash and list', async () => {
    const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');
    const owner = new ethers.Wallet(
      // Private key of the first Hardhat test account, never use on mainnet
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      provider
    );
    const editor = new ethers.Wallet(
      // Private key of the second Hardhat test account, never use on mainnet
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
      provider
    );
    // Contracts are deployed using the first signer/account by default
    const repositoryContract = new ethers.Contract(
      (deployments as Deployments)[31337].address,
      JSON.parse((contractAbis as ABIs)[31337]),
      provider
    );
    const role = await repositoryContract.EDITOR_ROLE();
    await repositoryContract
      .connect(owner)
      .grantRole(role, editor.address);
        
    const hash = 'Qmf5fFadtidqhR6gsP2F46Hppw6h7oxEZsJdqcKLihviXN';
    const hashBytes = bs58.decode(hash);
    await repositoryContract
      .connect(editor)
      .addListHash(hashBytes.slice(2), hashBytes[0], hashBytes[1]);
    // Set the address query parameter for the find method
    const params = {
      query: {
        address: editor.address,
        chainId: 31337,
      },
    };
    // Call the find method
    const result = await app
      .service('blocklist')
      .find(params);
    assert.equal(result.result.blocklist.includes('0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'), true);
    assert.equal(result.result.blocklist.includes('0xdD2FD4581271e230360230F9337D5c0430Bf44C0'), true);
    assert.equal(result.result.blocklist.length, 2);
    //The blocklist should now be stored in the DB.
    //If we call the find method again, the blocklist should be retrieved from the DB.
    //To ensure that blocklist is returned from the DB, we use an IPFS service mock that always returns an empty object:
    app.use('/ipfs-client', {
      async find() {
        return {};
      },
    });
    const result2 = await app
      .service('blocklist')
      .find(params);
    assert.equal(result2.result.blocklist.includes('0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'), true);
    assert.equal(result2.result.blocklist.includes('0xdD2FD4581271e230360230F9337D5c0430Bf44C0'), true);
    assert.equal(result2.result.blocklist.length, 2);
    
  });
});
