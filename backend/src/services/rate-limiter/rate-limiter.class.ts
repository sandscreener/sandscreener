import { Service, MemoryServiceOptions } from 'feathers-memory';
import { Application } from '../../declarations';
import { RateLimiter as Limiter } from 'limiter';

export class RateLimiter extends Service {
  private readonly limiter;

  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<MemoryServiceOptions>, app: Application) {
    super(options);
    // In the case of Alchemy API, it is 330 "compute units" per second
    this.limiter = new Limiter({
      tokensPerInterval: 330,
      interval: 'second',
    });
  }

  /**
   * Issues a permission to call the Ethereum node RPC
   **/
  async find(params: any): Promise<any> {
    if (!params.computeUnits) {
      return Promise.reject(new Error('Missing compute units'));
    }
    const tokensRemoved = this.limiter.removeTokens(params.computeUnits);
    return Promise.resolve(tokensRemoved);
  }
}
