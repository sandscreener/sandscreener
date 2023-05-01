import { Params } from '@feathersjs/feathers';
import { Contract, ContractInterface, providers, Wallet } from 'ethers';
import { Service, MemoryServiceOptions } from 'feathers-memory';
import { Application } from '../../declarations';
import tornadoAbi from '../../contracts/tornado/TornadoCash_Eth_01.json';

export class TornadoContract extends Service {
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
      wallet = new Wallet(
        this.app.get('auditorPrivateKey'),
        new providers.JsonRpcProvider(this.app.get('rpcUrl')[chainId])
      );
    }
    let address: string;
    //https://development.tornadocash.community/tornadocash/classic-ui/src/branch/master/networkConfig.js
    switch (params?.query?.poolName) {
    case '01ETH':
      switch (chainId) {
      case '1':
      case '31337':
        address = '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc';
        break;
      case '5':
        address = '0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7';
        break;
      }
      break;
    case '1ETH':
      switch (chainId) {
      case '1':
      case '31337':
        address = '0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936';
        break;
      case '5':
        address = '0x3aac1cC67c2ec5Db4eA850957b967Ba153aD6279';
        break;
      }
      break;
    case '10ETH':
      switch (chainId) {
      case '1':
      case '31337':
        address = '0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF';
        break;
      case '5':
        address = '0x723B78e67497E85279CB204544566F4dC5d2acA0';
        break;
      }
      break;
    case '100ETH':
      switch (chainId) {
      case '1':
      case '31337':
        address = '0xA160cdAB225685dA1d56aa342Ad8841c3b53f291';
        break;
      case '5':
        address = '0x0E3A09dDA6B20aFbB34aC7cD4A6881493f3E7bf7';
        break;
      }  
      break;
    default:
      throw new Error('Pool name is not valid');
    }

    const tornadoContract = new Contract(address, tornadoAbi as ContractInterface, wallet);
    params = { contract: tornadoContract, ...params };
    return params;
  }
}
