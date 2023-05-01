import { Service, MemoryServiceOptions } from 'feathers-memory';
import { Application } from '../../declarations';

export class ProverParameters extends Service {
  app: Application;
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<MemoryServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }

  /*
  TODO:
  - if pool scan is not complete, prover parameters will return error
  */
  async find(params: any): Promise<any> {
    // Get the address of the user whose hash we want to retrieve
    const address = params.query.address;
    if (!address) {
      throw new Error('Address is required');
    }
    if (!params.query.poolName) {
      throw new Error('Pool name is required');
    }
    if (!params.query.chainId) {
      throw new Error('Chain ID is required');
    }
    // Create a copy of the params object without the transport to pass to the internal services
    const internalParams = { ...params };
    delete internalParams.provider;
    const blocklist = await this.app.service('blocklist').find(internalParams);
    const blocklistObject = blocklist.result.blocklist;
    const blocklistCID = blocklist.result.blocklistCID;
    internalParams.query.blocklist = blocklistObject;
    internalParams.query.blocklistCID = blocklistCID;
    const exclusionTree = await this.app.service('exclusion-tree').find(internalParams);
    const fullTree = await this.app.service('merkle-tree').find({
      query: { poolName: params.query.poolName, chainId: params.query.chainId },
    });
    console.log(
      `Got full MT and exclusion MT for ${params.query.poolName} pool and blocklist ${blocklistCID}`
    );
    return {
      fullTree,
      exclusionTree,
      blocklistCID,
    };
  }
}
