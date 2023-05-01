import { Params, ServiceAddons } from '@feathersjs/feathers';
import assert from 'assert';
import app from '../../src/app';
import { PoolIndexer } from '../../src/services/pool-indexer/pool-indexer.class';
import services from '../../src/services';
import configuration from '@feathersjs/configuration';

class MockEvent {
  constructor(
    public commitment: string,
    public leafIndex: number,
    public timestamp: number,
    public status: number,
    public transactionHash: string,
    public from: string
  ) {
    this.args = {
      commitment: commitment,
      leafIndex: leafIndex,
      timestamp: timestamp,
    };
  }

  args: {
    commitment: string;
    leafIndex: number;
    timestamp: number;
  };
  getTransactionReceipt = async () => {
    return {
      status: this.status,
      transactionHash: this.transactionHash,
      from: this.from,
    };
  };
}

describe('\'pool-indexer\' service', () => {
  let service: PoolIndexer & ServiceAddons<any>;
  beforeEach(() => {
    app.configure(services);
    app.configure(configuration());
    app.set('createdAt01', {
      '1': 0,
      '31337': 0,
    });
    app.set('sanctionedAt', 1);
    app.use('/progress-indicator', {
      async update(data: any, params: Params) {
        return {};
      },
      async create(data: any, params: Params) {
        return {};
      },
      async remove(id: any, params: Params) {
        return {};
      },
    });
    app.use('/rate-limiter', {
      async find(params: Params) {
        return true;
      },
    });
    app.use('/tornado-contract', {
      async find(params: Params) {
        return {
          contract: {
            levels: async () => 20,
            ZERO_VALUE: async () =>
              '21663839004416932945382355908790599225266501822907911457504978515578255421292',
            filters: {
              Deposit: () => {
                return {};
              },
            },
            queryFilter: async () => {
              return [
                new MockEvent('0xabc', 1, 123, 1, '0x123', '0x123'),
                new MockEvent('0xdef', 2, 234, 1, '0x234', '0x234'),
                new MockEvent('0x123', 3, 345, 1, '0x345', '0x345'),
                new MockEvent('0x456', 4, 456, 1, '0x456', '0x456'),
              ];
            },
            provider: {
              getBlockNumber: async () => 100,
            },
          },
        };
      },
    });
    // Remove all commitments from DB
    app.service('commitments').remove(null);
    service = app.service('pool-indexer');
  });

  afterEach(() => {
    // Remove all commitments from DB
    app.service('commitments').remove(null);
  });

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('throws an error if Tornado contract was not initialized correctly', async () => {
    app.use('/tornado-contract', {
      async find(params: Params) {
        return {};
      },
    });
    try {
      await service.find({
        query: {
          poolName: '1ETH',
          chainId: 1,
        },
      });
    } catch (err) {
      assert.equal(err.message, 'Tornado contract was not initialized correctly');
    }
  });

  it('Successfully completes the scan', async () => {
    const result = await service.find({
      query: {
        poolName: '1ETH',
        chainId: 1,
      },
    });
    assert.equal(result.message, 'Scan complete');
    assert.equal(result.totalSize, 4);
  });
});
