import { DBSchema } from 'idb';

interface Blocklist {
  cid: string;
  addresses: string[];
}

interface Commitment {
  txId: string;
  commitmentValue: string;
  pool: string;
  blocklistId: string;
}

interface CommitmentsDBSchema extends DBSchema {
  blocklists: {
    key: string;
    value: Blocklist;
  };
  commitments: {
    value: Commitment;
    key: string;
    indexes: {
      'by-blocklist-pool-and-txId': string[];
      'by-commitment-blocklist-and-pool': string[];
    };
  };
}

export default CommitmentsDBSchema;
