import { Application } from '../../declarations';
import bs58 from 'bs58';
import { SequelizeServiceOptions, Service } from 'feathers-sequelize';
import { Paginated } from '@feathersjs/feathers';
import { BlocklistModel } from '../../models/blocklist.model';
import { ethers } from 'ethers';

export class Blocklist extends Service<BlocklistModel> {
  app: Application;
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }

  async find(params: any): Promise<any> {
    // Get the address of the user whose hash we want to retrieve
    const address = params.query.address;
    if (!address) {
      throw new Error('Address is required');
    }
    // Create a copy of the params object without the transport to pass to the internal services
    const internalParams = { ...params };
    delete internalParams.provider;

    try {
      // Call the RepositoryService to get the repository contract
      const contractResponse = await this.app.service('repository').find(internalParams);
      // Check that the contract was returned in the response
      if (!contractResponse.contract) {
        throw new Error('Repository contract was not initialized correctly');
      }
      // Call the getLatestHash function on the contract
      const [digest, hashFunction, size] = await contractResponse.contract.getLatestHash(address);

      // Check that the hash data is valid
      if (!digest || !hashFunction || !size) {
        throw new Error('Invalid or incomplete hash data returned by getLatestHash function');
      }
      // Restore the IPFS hash from the digest, hashFunction, and size
      const digestTrimmed = digest.slice(2);
      // Convert the digest string to a hex number
      const digestBytes: number[] = [];
      for (let n = 0; n < digestTrimmed.length; n += 2) {
        digestBytes.push(parseInt(digestTrimmed.slice(n, n + 2), 16));
      }

      const byteArray = [hashFunction, size, ...digestBytes];
      // Restore the base58 encoded hash
      const blocklistCID = bs58.encode(byteArray);

      // Return the encoded hash in the result
      internalParams.result = {
        blocklistCID: blocklistCID,
      };
      const previouslyStoredBlocklists = (await super.find({
        query: { ipfsHash: blocklistCID, $limit: 0 },
      })) as Paginated<BlocklistModel>;
      if (previouslyStoredBlocklists.total > 0) {
        console.log(
          `Blocklist with CID ${blocklistCID} already stored in the DB (${previouslyStoredBlocklists.total} addresses)`
        );
        params.result = { blocklistCID: blocklistCID };
        //Getting the blocklist entries from the DB, page by page
        let page = 0;
        const pageSize = this.app.get('paginate').max;
        let total = 0;
        let blocklist: string[] = [];
        do {
          const blocklistPage = (await super.find({
            query: { ipfsHash: blocklistCID, $limit: pageSize, $skip: page * pageSize },
          })) as Paginated<BlocklistModel>;
          total = blocklistPage.total;
          blocklist = blocklist.concat(blocklistPage.data.map((entry) => entry.address));
          page++;
        } while (page * pageSize < total);
        params.result.blocklist = blocklist;

        return params;
      } else {
        console.log(`Blocklist with CID ${blocklistCID} not found in the DB`);
        const ipfsResponse = await this.app.service('ipfs-client').find(internalParams);
        // Parse the file contents
        const parsedJSON = JSON.parse(ipfsResponse.result.rawBlocklist);
        if (!parsedJSON.blocklist) {
          throw new Error('Blocklist data not found in parsed JSON');
        }
        for (const entry of parsedJSON.blocklist) {
          if (ethers.utils.isAddress(entry) === false) {
            throw new Error('Invalid blocklist entry');
          }
          super
            .create(
              {
                ipfsHash: blocklistCID,
                address: entry as string,
              },
              internalParams
            )
            .catch((error: any) => {
              console.log('Error storing blocklist in the DB');
              console.log(error?.message);
            });
        }

        params.result = internalParams.result;
        // Return the blocklist in the result
        params.result.blocklist = parsedJSON.blocklist;

        return params;
      }
    } catch (error: any) {
      console.log(error?.message);
      throw new Error('Error retrieving hash');
    }
  }
}
