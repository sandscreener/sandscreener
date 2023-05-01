import { Params } from '@feathersjs/feathers';
import { Service, MemoryServiceOptions } from 'feathers-memory';
import { Application } from '../../declarations';
import axios from 'axios';

export class IpfsClient extends Service {
  app: Application;
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<MemoryServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }

  async find(params?: Params): Promise<any> {
    // Use the encoded hash to retrieve the file from IPFS
    const ipfsGateway = this.app.get('ipfsGateway');
    const url = `${ipfsGateway}${params?.result.blocklistCID}`;
    // Retrieve the file from IPFS
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          Accept: 'text/plain',
          'Accept-Encoding': 'gzip,deflate,compress',
        },
      });
      const rawBlocklist = Buffer.from(response.data, 'binary').toString('utf8');
      params = { ...params, result: { rawBlocklist, ...params?.result } };
      return params;
    } catch (error: any) {
      console.log(error);
      console.log(`URL: ${url}`);
      throw new Error('IPFS data retrieval failed');
    }
  }
}
