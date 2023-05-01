import { Paginated, ServiceAddons } from '@feathersjs/feathers';
import { Commitments } from '../commitments/commitments.class';
import { Service, MemoryServiceOptions } from 'feathers-memory';
import MerkleTree from 'fixed-merkle-tree';
import { Application } from '../../declarations';
import { buildMimcSponge } from 'circomlibjs';
import { Contract, ethers } from 'ethers';
import { Presets, SingleBar } from 'cli-progress';

export class ExclusionTree extends Service {
  app: Application;
  progress: SingleBar;
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<MemoryServiceOptions>, app: Application) {
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

    const contractResponse = await this.app.service('tornado-contract').find(internalParams);
    // Check that the contract was returned in the response
    if (!contractResponse.contract) {
      throw new Error('Tornado contract was not initialized correctly');
    }
    const tornadoContract: Contract = contractResponse.contract;

    const blocklistCID = internalParams?.query?.blocklistCID;
    if (!blocklistCID) {
      throw new Error('Blocklist CID is not specified');
    }
    const itemsPerPage = this.app.get('paginate').max;

    // Get the commitments for the pool
    const service: Commitments & ServiceAddons<any> = this.app.service('commitments');

    const commitmentParams = { ...internalParams };
    commitmentParams.query = {
      $limit: 0,
      depositor: {
        $in: params?.query?.blocklist,
      },
      poolName: poolName,
      chainId: chainId,
    };

    const commitmentPages = (await service.find(commitmentParams)) as Paginated<any>;

    const total = commitmentPages.total;
    const pages = Math.ceil(total / itemsPerPage);

    const mimcSponge = await buildMimcSponge();
    const zeroValue = ethers.BigNumber.from(await tornadoContract.ZERO_VALUE());
    const tree = new MerkleTree(await tornadoContract.levels(), [], {
      hashFunction: (left, right) =>
        mimcSponge.F.toString(mimcSponge.multiHash([BigInt(left), BigInt(right)])),
      zeroElement: zeroValue.toString(),
    });

    this.startProgress(total, poolName, chainId);

    for (let i = 1; i <= pages; i++) {
      commitmentParams.query = {
        $limit: itemsPerPage,
        $skip: itemsPerPage * (i - 1),
        $select: ['commitment'],
        depositor: {
          $in: params?.query?.blocklist,
        },
        $sort: {
          //1 is ascending, -1 is descending
          commitment: 1,
        },
      };

      //Constructing the special sparse Merkle tree that is convenient for a faster proof generation.
      // For example, if the blocklisted commitments are [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...]
      // then the tree will be constructed as follows:
      //   o     o    o     o     o     o     o     o     o     ...
      //  / \   / \  / \   / \   / \   / \   / \   / \   / \    ...
      // 1  2  2  3 3  4  4  5  5  6  6  7  7  8  8  9  9  10   ...
      // This way, the non-blocklisted commitment will always fall between the leaves with an even and odd index, and the proof will only require a single Merkle path.
      const commitments = (await service.find(commitmentParams)) as Paginated<any>;
      for (let j = 0; j < commitments.data.length - 1; j++) {
        //Necessary to take care of the corner case where user's commitment is less than the lower bound of the blocklisted commitments range
        if (i === 1 && j == 0) {
          tree.insert(BigInt(0).toString());
          tree.insert(commitments.data[0].commitment);
        }
        tree.insert(commitments.data[j].commitment);
        tree.insert(commitments.data[j + 1].commitment);
        this.progress?.increment();
      }
    }
    //Necessary to take care of the corner case where user's commitment is greater than the upper bound of the blocklisted commitments range
    tree.insert(tree.elements[tree.elements.length - 1]);
    tree.insert('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');

    this.progress?.stop();
    console.log(
      `Calculated the exclusion tree for ${poolName} pool on chain ${chainId} and blocklist ${blocklistCID} (${total} leaves)`
    );
    return tree.serialize();
  }

  private startProgress(total: number, poolName: string, chainId: number) {
    if (process.env.NODE_ENV !== 'test') {
      this.progress = new SingleBar(
        {
          format: `Constructing exclusion tree root for ${poolName} on chain ${chainId} deposits: {bar} {percentage}% | ETA: {eta_formatted} | {value}/{total} leaves inserted.`,
          etaBuffer: Math.round(total / 20),
          noTTYOutput: true,
        },
        Presets.shades_classic
      );
      this.progress.start(total, 0);
    }
  }
}
