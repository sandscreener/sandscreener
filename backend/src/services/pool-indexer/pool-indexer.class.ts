import { NullableId, Paginated, Params, ServiceAddons } from '@feathersjs/feathers';
import { Contract, ethers } from 'ethers';
import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application } from '../../declarations';
import { Commitments } from '../commitments/commitments.class';

export class PoolIndexer extends Service {
  ZERO_ELEMENT = '21663839004416932945382355908790599225266501822907911457504978515578255421292';
  app: Application;
  createdAt: Map<string, number>;
  sanctionedAt: Map<string, number>;
  totalSize: Map<string, number>;

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
    this.totalSize = new Map<string, number>();
    this.createdAt = new Map<string, number>();
    this.sanctionedAt = new Map<string, number>();
  }

  async find(params: any): Promise<any> {
    // Create a copy of the params object without the transport to pass to the internal services
    const internalParams = { ...params };
    delete internalParams.provider;
    const poolName = internalParams?.query?.poolName;
    if (!poolName) {
      throw new Error('Pool name is not specified');
    }
    const chainId = internalParams?.query?.chainId;
    if (!chainId) {
      throw new Error('Chain ID is not specified');
    }

    this.totalSize.set(poolName + chainId, 0);
    const tornadoParams = { ...internalParams };
    tornadoParams.query = { poolName: poolName, ...tornadoParams.query };
    const contractResponse = await this.app.service('tornado-contract').find(tornadoParams);
    // Check that the contract was returned in the response
    if (!contractResponse.contract) {
      throw new Error('Tornado contract was not initialized correctly');
    }
    const tornadoContract: Contract = contractResponse.contract;

    //TODO get the corresponding createdAt by pool name
    this.createdAt.set(poolName + chainId, this.app.get('createdAt01')[chainId]);
    //Min is necessary for Goerli because the latest Goerli block is still lower than the block when Tornado was sanctioned on mainnet
    this.sanctionedAt.set(
      poolName + chainId,
      //TODO separate sanctionedAt for different networks
      Math.min(this.app.get('sanctionedAt'), await tornadoContract.provider.getBlockNumber())
    );

    await this.prepareBlockRanges(poolName, chainId, this.createdAt.get(poolName + chainId));

    await this.startProgress(poolName, chainId);

    let nextBlockRange = await this.getNextBlockRange(poolName, chainId);
    while (nextBlockRange) {
      await this.processBlockRange(nextBlockRange, internalParams, tornadoContract);
      // Get the next block range
      nextBlockRange = await this.getNextBlockRange(poolName, chainId);
    }
    await this.waitForBlockRangeProcessing(poolName, chainId);
    await this.waitForCommitmentsIndexing(poolName, chainId);
    await this.retryFailedBlockRanges(poolName, chainId, tornadoContract, internalParams);
    await this.waitForBlockRangeProcessing(poolName, chainId);
    await this.retryIncompleteCommitments(poolName, chainId, tornadoContract, internalParams);
    if (process.env.NODE_ENV !== 'test') {
      await this.app.service('progress-indicator').remove(poolName + chainId, {
        lastQueryBlock: this.sanctionedAt,
        createdAt: this.createdAt.get(poolName + chainId),
      });
    }
    return { message: 'Scan complete', totalSize: this.totalSize.get(poolName + chainId) };
  }

  async prepareBlockRanges(poolName: string, chainId: number, createdAt: number) {
    // Create block range records if they don't exist
    let startBlock = createdAt;
    while (startBlock < this.sanctionedAt.get(poolName + chainId)) {
      const endBlock = Math.min(startBlock + 2000, this.sanctionedAt.get(poolName + chainId));
      const existingBlockRange = (await this.app.service('block-range').find({
        query: { poolName, chainId, startBlock, endBlock },
      })) as Paginated<any>;

      if (existingBlockRange.total === 0) {
        await this.app.service('block-range').create({
          poolName,
          chainId,
          startBlock,
          endBlock,
          status: 'pending',
        });
      }

      startBlock = endBlock + 1;
    }
  }

  async getNextBlockRange(poolName: string, chainId: number, status = 'pending') {
    const pendingBlockRanges = (await this.app.service('block-range').find({
      query: {
        poolName,
        chainId,
        status: status,
        $sort: {
          startBlock: 1, // Ascending order
        },
        $limit: 1, // Get only one record
      },
    })) as Paginated<any>;

    if (pendingBlockRanges.total > 0) {
      return pendingBlockRanges.data[0];
    } else {
      console.log('No pending block ranges found');
      return null;
    }
  }

  async processBlockRange(
    nextBlockRange: { startBlock: any; endBlock: any },
    internalParams: Params,
    tornadoContract: Contract
  ) {
    const poolName = internalParams?.query?.poolName;
    const chainId = internalParams?.query?.chainId;

    await this.updateBlockRange(
      poolName,
      chainId,
      nextBlockRange.startBlock,
      nextBlockRange.endBlock,
      'in-progress'
    );

    const commitmentsService = this.app.service('commitments');
    const { startBlock, endBlock } = nextBlockRange;
    const limiterParams = { ...internalParams, computeUnits: 80 };
    const tokensRemoved = await this.app.service('rate-limiter').find(limiterParams);
    if (!tokensRemoved) {
      return;
    }
    const filter = tornadoContract.filters.Deposit();

    tornadoContract
      .queryFilter(filter, startBlock, endBlock)
      .then(async (events: any[]) => {
        events.length;
        await this.incrementProgress(events, events.length, poolName, chainId);
        while (events.length) {
          const limiterParams = { ...internalParams, computeUnits: 20 };
          const tokensRemoved = await this.app.service('rate-limiter').find(limiterParams);
          if (!tokensRemoved) {
            continue;
          }
          const event = events.pop();
          if (!event.removed) {
            let stored: { id: NullableId };

            const commitmentParams = { ...internalParams };
            delete commitmentParams.query;
            //Query for a stored commitment
            commitmentParams.query = {
              leafIndex: event.args?.leafIndex,
              poolName: poolName,
              chainId: chainId,
              txHash: event.transactionHash,
            };
            const allStored = (await commitmentsService.find(commitmentParams)) as Paginated<any>;

            if (allStored.data.length > 0 && allStored.data[0].depositor) {
              await this.app.service('progress-indicator').update(poolName + chainId, {});
              continue;
            } else if (allStored.data.length > 0) {
              stored = allStored.data[0];
            } else {
              stored = await commitmentsService
                .create(
                  {
                    commitment: event.args?.commitment,
                    leafIndex: event.args?.leafIndex,
                    timestamp: ethers.BigNumber.from(event.args?.timestamp).toString(),
                    poolName: poolName,
                    chainId: chainId,
                    txHash: event.transactionHash,
                    status: 'pending',
                  },
                  internalParams
                )
                .catch((err) => {
                  console.log(err);
                });
            }
            event
              .getTransactionReceipt()
              .then((txReceipt) => {
                this.fillInDepositor(txReceipt.from, commitmentsService, stored.id, internalParams);
              })
              .catch((err) => {
                console.log(err);
                commitmentsService
                  .patch(
                    stored.id,
                    {
                      status: 'failed',
                    },
                    internalParams
                  )
                  .then((res) => {
                    console.log(res);
                  })
                  .catch((err) => {
                    console.log(err);
                  });
              })
              .finally(() => {
                this.app.service('progress-indicator').update(poolName + chainId, {});
              });
          }
        }
        // Update the block range status
        await this.updateBlockRange(poolName, chainId, startBlock, endBlock, 'completed');
      })
      .catch(async (err: any) => {
        console.log(err);
        await this.updateBlockRange(poolName, chainId, startBlock, endBlock, 'failed');
      });
  }

  async updateBlockRange(
    poolName: string,
    chainId: number,
    startBlock: number,
    endBlock: number,
    newStatus: string
  ) {
    const existingBlockRange = (await this.app.service('block-range').find({
      query: { poolName, chainId, startBlock, endBlock },
    })) as Paginated<any>;

    if (existingBlockRange.total > 0) {
      const blockRangeId = existingBlockRange.data[0].id;
      await this.app
        .service('block-range')
        .patch(blockRangeId, {
          status: newStatus,
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      console.log(`Block range not found: ${startBlock}-${endBlock}`);
    }
  }

  async retryFailedBlockRanges(
    poolName: string,
    chainId: number,
    tornadoContract: Contract,
    internalParams: any
  ) {
    let nextBlockRange = await this.getNextBlockRange(poolName, chainId, 'failed');
    while (nextBlockRange) {
      console.log('Retrying failed blockranges...');
      await this.processBlockRange(
        { startBlock: nextBlockRange.startBlock, endBlock: nextBlockRange.endBlock },
        internalParams,
        tornadoContract
      );
      nextBlockRange = await this.getNextBlockRange(poolName, chainId, 'failed');
    }
  }

  async retryIncompleteCommitments(
    poolName: string,
    chainId: number,
    tornadoContract: Contract,
    internalParams: any
  ) {
    const commitmentsService = this.app.service('commitments');
    const incompleteCommitments = (await commitmentsService.find({
      query: {
        poolName,
        chainId,
        status: 'failed',
      },
    })) as Paginated<any>;
    console.log('Incomplete commitments', incompleteCommitments);
    const commitments = [...incompleteCommitments.data];
    while (commitments.length > 0) {
      console.log('Retrying incomplete commitments...');
      const limiterParams = { ...internalParams, computeUnits: 20 };
      const tokensRemoved = await this.app.service('rate-limiter').find(limiterParams);
      if (!tokensRemoved) {
        continue;
      }
      const commitment = commitments.pop();
      await tornadoContract.provider
        .getTransactionReceipt(commitment.txHash)
        .then(async (txReceipt) => {
          await this.fillInDepositor(
            txReceipt.from,
            commitmentsService,
            commitment.id,
            internalParams
          );
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }

  private async fillInDepositor(
    depositor: string,
    commitmentsService: Commitments & ServiceAddons<any>,
    commitmentId: any,
    internalParams: any
  ) {
    await commitmentsService
      .patch(
        commitmentId,
        {
          depositor: depositor,
          status: 'completed',
        },
        internalParams
      )
      .catch((err) => {
        console.log(err);
      });
  }

  async waitForBlockRangeProcessing(poolName: string, chainId: number) {
    let scanComplete = false;
    while (!scanComplete) {
      const pendingBlockRanges = (await this.app.service('block-range').find({
        query: {
          poolName,
          chainId,
          $limit: 0,
          status: {
            $in: ['pending', 'in-progress'],
          },
        },
      })) as Paginated<any>;
      console.log('Pending block ranges', pendingBlockRanges);
      scanComplete = pendingBlockRanges.total === 0;
    }
  }

  async waitForCommitmentsIndexing(poolName: string, chainId: number) {
    let scanComplete = false;
    while (!scanComplete) {
      const pendingCommitments = (await this.app.service('commitments').find({
        query: {
          poolName,
          chainId,
          $limit: 0,
          status: 'pending',
        },
      })) as Paginated<any>;

      scanComplete = pendingCommitments.total === 0;
    }
  }

  private async incrementProgress(
    events: ethers.Event[],
    eventCount: number,
    poolName: string,
    chainId: number
  ) {
    this.totalSize.set(poolName + chainId, this.totalSize.get(poolName + chainId) + eventCount);
    if (process.env.NODE_ENV !== 'test') {
      await this.app.service('progress-indicator').update(poolName + chainId, {
        eventsDelta: events.length,
        tx: this.totalSize.get(poolName + chainId),
        blockNumber: events[events.length - 1]?.blockNumber,
        createdAt: this.createdAt.get(poolName + chainId),
      });
    }
  }

  private async startProgress(poolName: string, chainId: number) {
    if (process.env.NODE_ENV !== 'test') {
      await this.app.service('progress-indicator').create({
        poolName: poolName,
        chainId: chainId,
        sanctionedAt: this.sanctionedAt.get(poolName + chainId),
        createdAt: this.createdAt.get(poolName + chainId),
      });
    }
  }
}
