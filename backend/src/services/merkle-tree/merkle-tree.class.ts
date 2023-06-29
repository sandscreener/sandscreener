import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application } from '../../declarations';
import { MerkleTree as mt } from 'fixed-merkle-tree';
import { Contract, ethers } from 'ethers';
import { buildMimcSponge } from 'circomlibjs';
import { Commitments } from '../commitments/commitments.class';
import { ServiceAddons, Paginated } from '@feathersjs/feathers';
import { Presets, SingleBar } from 'cli-progress';

export class MerkleTree extends Service {
  app: Application;
  initialized = false;
  //TODO by pool
  tree: mt;
  progress: SingleBar;
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }

  async find(params: any): Promise<any> {
    try {
      const internalParams = { ...params };
      delete internalParams.provider;
      //Now, we can get all the commitments for the given pool from the DB, construct the full Merkle tree out of them, and put the entire Merkle tree into a file, then ZIP it up and return in response.
      //First, get all the commitments for the given pool from the DB:
      const poolName = internalParams?.query?.poolName;
      if (!poolName) {
        throw new Error('Pool name is not specified');
      }
      const chainId = internalParams?.query?.chainId;
      if (!chainId) {
        throw new Error('Chain ID is not specified');
      }
      const commitmentsService: Commitments & ServiceAddons<any> = this.app.service('commitments');
      const commitmentParams = { ...internalParams };
      commitmentParams.query = {
        $limit: 0,
        poolName: poolName,
        chainId: chainId,
      };
      const commitmentPages = (await commitmentsService.find(commitmentParams)) as Paginated<any>;
      const total = commitmentPages.total;

      if (!this.initialized) {
        await this.initTree(internalParams);
      }

      if (total === this.tree.elements.length) {
        // The tree is already up to date
        return this.tree.serialize();
      }

      let page = 0;
      const pageSize = this.app.get('paginate').max;
      this.startProgress(total, poolName);
      do {
        commitmentParams.query = {
          $limit: pageSize,
          $skip: page * pageSize,
          $sort: {
            //1 is ascending, -1 is descending
            leafIndex: 1,
          },
          poolName: poolName,
          chainId: chainId,
        };
        const commitmentsPage = (await commitmentsService.find(commitmentParams)) as Paginated<any>;
        this.tree.bulkInsert(commitmentsPage.data.map((entry) => entry.commitment));
        this.progress?.increment(commitmentsPage.data.length);
        page++;
      } while (page * pageSize < total);
      this.progress?.stop();
      return this.tree.serialize();
    } catch (e) {
      console.log(e);
    }
  }

  async create(data: any, params: any): Promise<any> {
    try {
      const internalParams = { ...params };
      delete internalParams.provider;

      if (!this.initialized) {
        await this.initTree(internalParams);
      }

      if (data.data instanceof Array) {
        this.tree.bulkInsert(data.data);
      } else {
        this.tree.insert(data.data);
      }

      return this.tree.elements.length;
    } catch (e) {
      console.log(e);
    }
  }

  async initTree(internalParams: any) {
    const poolName = internalParams?.query?.poolName;
    if (!poolName) {
      throw new Error('Pool name is not specified');
    }
    const contractResponse = await this.app.service('tornado-contract').find(internalParams);
    // Check that the contract was returned in the response
    if (!contractResponse.contract) {
      throw new Error('Repository contract was not initialized correctly');
    }
    const tornadoContract: Contract = contractResponse.contract;
    const zeroValue = ethers.BigNumber.from(await tornadoContract.ZERO_VALUE());
    const mimcSponge = await buildMimcSponge();
    this.tree = new mt(await tornadoContract.levels(), [], {
      hashFunction: (left, right) =>
        mimcSponge.F.toString(mimcSponge.multiHash([BigInt(left), BigInt(right)])),
      zeroElement: zeroValue.toString(),
    });
    this.initialized = true;
  }

  private startProgress(total: number, poolName: string) {
    if (process.env.NODE_ENV !== 'test') {
      this.progress = new SingleBar(
        {
          format: `Constructing Merkle tree for ${poolName} deposits: {bar} {percentage}% | ETA: {eta_formatted} | {value}/{total} leaves inserted.`,
          etaBuffer: 200,
          noTTYOutput: true,
        },
        Presets.shades_classic
      );
      this.progress.start(total, 0);
    }
  }
}
