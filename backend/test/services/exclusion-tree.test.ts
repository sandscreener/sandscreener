import { Paginated, Params, ServiceAddons } from '@feathersjs/feathers';
import assert from 'assert';
import app from '../../src/app';
import configuration from '@feathersjs/configuration';
import { ExclusionTree } from '../../src/services/exclusion-tree/exclusion-tree.class';
import services from '../../src/services';
import MerkleTree from 'fixed-merkle-tree';
import { Cache } from 'memory-cache';

describe('\'exclusion-tree\' service', () => {
  let service: ExclusionTree & ServiceAddons<any>;

  it('registered the service', () => {
    const service = app.service('exclusion-tree');

    assert.ok(service, 'Registered the service');
  });

  beforeEach(() => {
    app.configure(services);
    app.configure(configuration());
    app.set('cacheManager', new Cache());
    service = app.service('exclusion-tree');
  });

  it('throws an error if pool name is not specified', async () => {
    try {
      await service.find({
        query: { blocklistCID: 'abc123', blocklist: ['0xdef', '0x123'], chainId: '31337' },
      });
    } catch (err) {
      assert.equal(err.message, 'Pool name is not specified');
    }
  });

  it('throws an error if chain ID is not specified', async () => {
    try {
      await service.find({ query: { poolName: '1ETH', blocklistCID: 'abc123' } });
    } catch (err) {
      assert.equal(err.message, 'Chain ID is not specified');
    }
  });

  it('throws an error if blocklist CID is not specified', async () => {
    try {
      await service.find({ query: { poolName: '1ETH', chainId: '31337' } });
    } catch (err) {
      assert.equal(err.message, 'Blocklist CID is not specified');
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
        query: { poolName: '1ETH', chainId: 1, blocklistCID: 'abc123', blocklist: [] },
      });
    } catch (err) {
      assert.equal(err.message, 'Tornado contract was not initialized correctly');
    }
  });

  it('calculates the exclusion tree for the given pool and blocklist', async () => {
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

    const result = await service.find({
      query: {
        poolName: '1ETH',
        blocklistCID: 'abc123',
        blocklist: ['0xdef', '0x123'],
        chainId: '31337',
      },
    });

    const merkleTree = MerkleTree.deserialize(result);

    assert.equal(
      merkleTree.root,
      '7783610275344731442799549792277355423057470615180670955851720960945679041408'
    );
  });
});
