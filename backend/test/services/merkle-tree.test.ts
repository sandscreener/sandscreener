import { Paginated, Params, ServiceAddons } from '@feathersjs/feathers';
import assert from 'assert';
import app from '../../src/app';
import configuration from '@feathersjs/configuration';
import { MerkleTree } from '../../src/services/merkle-tree/merkle-tree.class';
import services from '../../src/services';
import { MerkleTree as mt } from 'fixed-merkle-tree';
import { Cache } from 'memory-cache';

describe('\'merkle-tree\' service', () => {
  let service: MerkleTree & ServiceAddons<any>;

  beforeEach(() => {
    app.configure(services);
    app.configure(configuration());
    app.set('cacheManager', new Cache());
    app.use('/commitments', {
      async find(params: Params) {
        const commitments: Paginated<any> = {
          total: 4,
          limit: 0,
          skip: 0,
          data: [
            { commitment: '0xabc' },
            { commitment: '0xdef' },
            { commitment: '0x123' },
            { commitment: '0x456' },
          ],
        };
        return commitments;
      },
    });
    app.use('/tornado-contract', {
      async find(params: Params) {
        return {
          contract: {
            levels: async () => 20,
            ZERO_VALUE: async () =>
              '21663839004416932945382355908790599225266501822907911457504978515578255421292',
          },
        };
      },
    });
    service = app.service('merkle-tree');
  });

  it('registered the service', () => {
    const service = app.service('merkle-tree');

    assert.ok(service, 'Registered the service');
  });

  it('throws an error if pool name is not specified', async () => {
    try {
      await service.find({ query: {} });
    } catch (err) {
      assert.equal(err.message, 'Pool name is not specified');
    }
  });

  it('throws an error if Tornado contract was not initialized correctly', async () => {
    app.use('/tornado-contract', {
      async find(params: Params) {
        return params;
      },
    });
    try {
      await service.find({
        query: { poolName: '1ETH', chainId: 1 },
      });
    } catch (err) {
      assert.equal(err.message, 'Tornado contract was not initialized correctly');
    }
  });

  it('calculates the Merkle tree for the given pool', async () => {
    const result = await service.find({
      query: { poolName: '1ETH', chainId: 1 },
    });

    const merkleTree = mt.deserialize(result);

    assert.equal(
      merkleTree.root,
      '1216763192721947132836264719171830773319520750337788855590307879444310471593'
    );
  });

  it('Returns the Merkle tree calculated while indexing the smart contract events', async () => {
    app.use('/commitments', {
      async find(params: Params) {
        const commitments: Paginated<any> = {
          total: 4,
          limit: 0,
          skip: 0,
          data: [],
        };
        return commitments;
      },
    });
    const params = { query: { poolName: '1ETH', chainId: 1 } };
    await service.create(
      {
        data: '0xabc',
      },
      params
    );
    await service.create(
      {
        data: '0xdef',
      },
      params
    );
    await service.create(
      {
        data: '0x123',
      },
      params
    );
    await service.create(
      {
        data: '0x456',
      },
      params
    );

    const result = await service.find(params);

    const merkleTree = mt.deserialize(result);

    assert.equal(
      merkleTree.root,
      '1216763192721947132836264719171830773319520750337788855590307879444310471593'
    );
  });
});
