import { MemoryServiceOptions, Service } from 'feathers-memory';
import { Application } from '../../declarations';
import { Contract, ContractInterface, providers, Wallet } from 'ethers';
import contractAbis from '../../contracts/contractAbi.json';
import deployments from '../../contracts/deployments.json';
import { Params } from '@feathersjs/feathers';

type Deployment = {
  address: string;
};

export type Deployments = {
  [network: string]: Deployment;
};

export type ABIs = {
  [network: string]: string;
};

export class Repository extends Service {
  app: Application;
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<MemoryServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }

  async find(params?: Params): Promise<any> {
    let wallet: Wallet;

    const chainId = params?.query?.chainId;
    if (!this?.app.get('auditorPrivateKey')) {
      throw new Error('Private key cannot be empty');
    } else if (!chainId) {
      throw new Error('chainId cannot be empty');
    } else {
      const rpcUrl = this.app.get('rpcUrl')[chainId];
      console.log('rpcUrl', rpcUrl);
      wallet = new Wallet(
        this.app.get('auditorPrivateKey'),
        new providers.JsonRpcProvider(rpcUrl)
      );
    }
    const abi = JSON.parse((contractAbis as ABIs)[chainId]);
    const repositoryContract = new Contract(
      (deployments as Deployments)[chainId].address,
      abi as ContractInterface,
      wallet
    );
    params = { contract: repositoryContract, ...params };
    params.wallet = wallet;
    return params;
  }
}
