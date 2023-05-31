import { Paginated, Params, ServiceAddons } from '@feathersjs/feathers';
import assert from 'assert';
import app from '../../src/app';
import { PoolIndexer } from '../../src/services/pool-indexer/pool-indexer.class';
import services from '../../src/services';
import configuration from '@feathersjs/configuration';

let emulateTransactionReceiptErrorOnce = false;
let emulateQueryFilterErrorOnce = false;

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
    if (emulateTransactionReceiptErrorOnce) {
      emulateTransactionReceiptErrorOnce = false;
      throw new Error('Transaction receipt error');
    }
    return {
      status: this.status,
      transactionHash: this.transactionHash,
      from: this.from,
    };
  };
}

const mockEvents = [
  new MockEvent('0xabc', 1, 123, 1, '0x123', '0x123'),
  new MockEvent('0xdef', 2, 234, 1, '0x234', '0x234'),
  new MockEvent('0x123', 3, 345, 1, '0x345', '0x345'),
  new MockEvent('0x456', 4, 456, 1, '0x456', '0x456'),
];

describe('\'pool-indexer\' service', () => {
  let service: PoolIndexer & ServiceAddons<any>;
  beforeEach(async () => {
    emulateTransactionReceiptErrorOnce = false;
    emulateQueryFilterErrorOnce = false;
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
              if (emulateQueryFilterErrorOnce) {
                emulateQueryFilterErrorOnce = false;
                throw new Error('Filter query error');
              }
              //Return a deep copy of mockEvents
              return mockEvents.map((event) => {
                return { ...event };
              });
            },
            provider: {
              getBlockNumber: async () => 100,
              getTransactionReceipt: async (txHash: string) => {
                console.log('Retrieving event for txHash: ', txHash);
                const event = mockEvents.find((event) => event.transactionHash === txHash) as any;
                return {
                  from: event.from,
                };
              },
            },
          },
        };
      },
    });
    // Remove all commitments from DB
    await app.service('commitments').remove(null);
    await app.service('block-range').remove(null);
    service = app.service('pool-indexer');
  });

  afterEach(async () => {
    // Remove all commitments from DB
    await app.service('commitments').remove(null);
    await app.service('block-range').remove(null);
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
    assert.equal(result.totalSize, 4, 'Found 4 events');

    const commitments = (await app.service('commitments').find({
      query: {
        poolName: '1ETH',
        chainId: 1,
      },
    })) as Paginated<any>;

    assert.equal(commitments.total, 4, 'Processed 4 commitments');
  });

  it('Completes the scan if the commitments are partially stored already', async () => {
    mockEvents.forEach(async (event) => {
      await app.service('commitments').create({
        commitment: event.commitment,
        leafIndex: event.leafIndex,
        timestamp: event.timestamp,
        txHash: event.transactionHash,
        poolName: '1ETH',
        chainId: 1,
        status: 'pending',
      });
    });

    const result = await service.find({
      query: {
        poolName: '1ETH',
        chainId: 1,
      },
    });

    assert.equal(result.message, 'Scan complete');
    assert.equal(result.totalSize, 4, 'Found 4 events');

    const commitments = (await app.service('commitments').find({
      query: {
        poolName: '1ETH',
        chainId: 1,
      },
    })) as Paginated<any>;

    assert.equal(commitments.total, 4, 'Processed 4 commitments');
  });

  it('Completes the scan if the commitments are fully stored already', async () => {
    mockEvents.forEach(async (event) => {
      await app.service('commitments').create({
        commitment: event.commitment,
        leafIndex: event.leafIndex,
        timestamp: event.timestamp,
        txHash: event.transactionHash,
        poolName: '1ETH',
        chainId: 1,
        depositor: event.from,
        status: 'completed',
      });
    });
    const result = await service.find({
      query: {
        poolName: '1ETH',
        chainId: 1,
      },
    });

    assert.equal(result.message, 'Scan complete');
    assert.equal(result.totalSize, 4, 'Found events count');

    const commitments = (await app.service('commitments').find({
      query: {
        poolName: '1ETH',
        chainId: 1,
      },
    })) as Paginated<any>;

    assert.equal(commitments.total, 4, 'Processed commitments count');
  });

  it('Retries the failed commitments', async () => {
    emulateTransactionReceiptErrorOnce = true;

    const result = await service.find({
      query: {
        poolName: '1ETH',
        chainId: 1,
      },
    });

    assert.equal(result.message, 'Scan complete');
    assert.equal(result.totalSize, 4, 'Found 4 events');

    const commitments = (await app.service('commitments').find({
      query: {
        poolName: '1ETH',
        chainId: 1,
        status: 'completed',
      },
    })) as Paginated<any>;

    assert.equal(commitments.total, 4, 'Processed 4 commitments');
  });

  it('Retries the failed block ranges', async () => {
    emulateQueryFilterErrorOnce = true;

    const result = await service.find({
      query: {
        poolName: '1ETH',
        chainId: 1,
      },
    });

    assert.equal(result.message, 'Scan complete');
    assert.equal(result.totalSize, 4, 'Found 4 events');

    const commitments = (await app.service('commitments').find({
      query: {
        poolName: '1ETH',
        chainId: 1,
        status: 'completed',
      },
    })) as Paginated<any>;

    assert.equal(commitments.total, 4, 'Processed 4 commitments');
  });
});
