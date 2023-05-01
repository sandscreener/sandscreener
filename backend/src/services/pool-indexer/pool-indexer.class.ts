import { NullableId, Paginated } from '@feathersjs/feathers';
import { Contract, ethers } from 'ethers';
import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application } from '../../declarations';

export class PoolIndexer extends Service {
  ZERO_ELEMENT = '21663839004416932945382355908790599225266501822907911457504978515578255421292';
  sanctionedAt: number;
  app: Application;
  createdAt: number;

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
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

    const tornadoParams = { ...internalParams };
    tornadoParams.query = { poolName: poolName, ...tornadoParams.query };
    const contractResponse = await this.app.service('tornado-contract').find(tornadoParams);
    // Check that the contract was returned in the response
    if (!contractResponse.contract) {
      throw new Error('Tornado contract was not initialized correctly');
    }
    const tornadoContract: Contract = contractResponse.contract;

    this.createdAt = this.app.get('createdAt01')[chainId];
    //Min is necessary for Goerli because the latest Goerli block is still lower than the block when Tornado was sanctioned on mainnet
    this.sanctionedAt = Math.min(
      this.app.get('sanctionedAt'),
      await tornadoContract.provider.getBlockNumber()
    );
    const filter = tornadoContract.filters.Deposit();

    const commitmentsService = this.app.service('commitments');

    let currentBlock = this.createdAt;
    let totalSize = 0;
    await this.startProgress(poolName, chainId);
    //TODO prepare a table to track the progress of the scan
    // Columns: pool, blockRange, status
    // Prepare it in a dedicated loop and then query the ranges from the table in the loop below instead of calculating them on the fly. If the request is successful, update the table with the status.
    //TODO add retries
    while (currentBlock < this.sanctionedAt) {
      const queryBlock = Math.min(currentBlock + 2000, this.sanctionedAt);
      const limiterParams = { ...internalParams, computeUnits: 80 };
      const tokensRemoved = await this.app.service('rate-limiter').find(limiterParams);
      if (!tokensRemoved) {
        continue;
      }
      tornadoContract
        .queryFilter(filter, currentBlock, queryBlock)
        .then(async (events) => {
          totalSize += events.length;
          await this.incrementProgress(events, totalSize, poolName, chainId);
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
              commitmentParams.query = {
                leafIndex: event.args?.leafIndex,
                poolName: poolName,
                chainId: chainId,
              };
              const allStored = (await commitmentsService.find(commitmentParams)) as Paginated<any>;
              if (
                allStored.data.length > 0 &&
                allStored.data[0].txHash &&
                allStored.data[0].depositor
              ) {
                await this.app.service('progress-indicator').update(poolName + chainId, {});
                await this.tryStopProgress(queryBlock, events.length === 0, poolName, chainId);
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
                  if (txReceipt.status === 1) {
                    commitmentsService
                      .patch(
                        stored.id,
                        {
                          txHash: txReceipt.transactionHash,
                          depositor: txReceipt.from,
                        },
                        internalParams
                      )
                      .catch((err) => {
                        console.log(err);
                      });
                  } else {
                    commitmentsService.remove(stored.id, internalParams).catch((err) => {
                      console.log(err);
                    });
                  }
                })
                .catch((err) => {
                  console.log(err);
                })
                .finally(() => {
                  this.app.service('progress-indicator').update(poolName + chainId, {});
                  this.tryStopProgress(queryBlock, events.length === 0, poolName, chainId);
                });
            }
          }
        })
        .catch((err) => {
          console.log(err);
        });
      currentBlock = queryBlock + 1;
    }
    await this.tryStopProgress(this.sanctionedAt, true, poolName, chainId);
    return { message: 'Scan complete', totalSize };
  }
  async tryStopProgress(
    lastQueryBlock: number,
    allEventsProcessed: boolean,
    poolName: string,
    chainId: number
  ) {
    if (
      process.env.NODE_ENV !== 'test' &&
      lastQueryBlock >= this.sanctionedAt &&
      allEventsProcessed
    ) {
      await this.app
        .service('progress-indicator')
        .remove(poolName + chainId, { lastQueryBlock: lastQueryBlock, createdAt: this.createdAt });
    }
  }

  private async incrementProgress(
    events: ethers.Event[],
    totalSize: number,
    poolName: string,
    chainId: number
  ) {
    if (process.env.NODE_ENV !== 'test') {
      await this.app.service('progress-indicator').update(poolName + chainId, {
        eventsDelta: events.length,
        tx: totalSize,
        blockNumber: events[events.length - 1]?.blockNumber,
        createdAt: this.createdAt,
      });
    }
  }

  private async startProgress(poolName: string, chainId: number) {
    if (process.env.NODE_ENV !== 'test') {
      await this.app.service('progress-indicator').create({
        poolName: poolName,
        chainId: chainId,
        sanctionedAt: this.sanctionedAt,
        createdAt: this.createdAt,
      });
    }
  }
}
