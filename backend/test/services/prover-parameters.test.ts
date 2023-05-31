import assert from 'assert';
import app from '../../src/app';
import configuration from '@feathersjs/configuration';
import { Params } from '@feathersjs/feathers';
import services from '../../src/services';
import MerkleTree from 'fixed-merkle-tree';
import { buildMimcSponge } from 'circomlibjs';

describe('\'prover parameters\' service', () => {
  beforeEach(() => {
    // Reset the app to its initial state
    app.configure(services);
    app.configure(configuration());

    app.use('/blocklist', {
      async find(params: Params) {
        params.result = {
          blocklist: [
            '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
            '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
          ],
          blocklistCID: 'Qmf5fFadtidqhR6gsP2F46Hpow6h7oxEZsJdqcKLihciXN',
        };
        return params;
      },
    });
    app.use('/exclusion-tree', {
      async find(params: Params) {
        const mimcSponge = await buildMimcSponge();
        const tree = new MerkleTree(20, [], {
          hashFunction: (left, right) =>
            mimcSponge.F.toString(mimcSponge.multiHash([BigInt(left), BigInt(right)])),
          zeroElement:
            '21663839004416932945382355908790599225266501822907911457504978515578255421292',
        });
        tree.insert(0);
        tree.insert(1);

        return tree.serialize();
      },
    });
    app.use('/merkle-tree', {
      async find(params: Params) {
        const mimcSponge = await buildMimcSponge();
        const tree = new MerkleTree(20, [], {
          hashFunction: (left, right) =>
            mimcSponge.F.toString(mimcSponge.multiHash([BigInt(left), BigInt(right)])),
          zeroElement:
            '21663839004416932945382355908790599225266501822907911457504978515578255421292',
        });
        tree.insert(2);
        tree.insert(3);

        return tree.serialize();
      },
    });
  });

  it('registered the service', () => {
    const service = app.service('prover-parameters');

    assert.ok(service, 'Registered the service');
  });

  it('returns the prover parameters for the given pool', async () => {
    const service = app.service('prover-parameters');
    const result = await service.find({
      query: {
        poolName: '1ETH',
        address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
        chainId: '31337',
      },
    });

    assert.equal(result.blocklistCID, 'Qmf5fFadtidqhR6gsP2F46Hpow6h7oxEZsJdqcKLihciXN');

    const fullTree = MerkleTree.deserialize(result.fullTree);
    const exclusionTree = MerkleTree.deserialize(result.exclusionTree);

    assert.equal(
      fullTree.root,
      '3325885182002084165234895042785697811770240292444769646005989029956176486497'
    );
    assert.equal(
      exclusionTree.root,
      '16194330998248377853009374583222017524625823122061978859685308084887545285726'
    );
  });

  it('fails if pool name is not specified', async () => {
    const service = app.service('prover-parameters');
    try {
      await service.find({
        query: { address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096', chainId: '31337' },
      });
    } catch (err) {
      assert.equal(err.message, 'Pool name is required');
    }
  });

  it('fails if address is not specified', async () => {
    const service = app.service('prover-parameters');
    try {
      await service.find({
        query: { poolName: '1ETH', chainId: '31337' },
      });
    } catch (err) {
      assert.equal(err.message, 'Address is required');
    }
  });

  it('fails if chainId is not specified', async () => {
    const service = app.service('prover-parameters');
    try {
      await service.find({
        query: { poolName: '1ETH', address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096' },
      });
    } catch (err) {
      assert.equal(err.message, 'Chain ID is required');
    }
  });
});
