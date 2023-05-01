import { Application } from '../declarations';
import users from './users/users.service';
import blocklist from './blocklist/blocklist.service';
import ipfsClient from './ipfs-client/ipfs-client.service';
import repository from './repository/repository.service';
import tornadoContract from './tornado-contract/tornado-contract.service';
import commitments from './commitments/commitments.service';
import rateLimiter from './rate-limiter/rate-limiter.service';

import exclusionTree from './exclusion-tree/exclusion-tree.service';

import proverParameters from './prover-parameters/prover-parameters.service';

import progressIndicator from './progress-indicator/progress-indicator.service';

import poolIndexer from './pool-indexer/pool-indexer.service';

import merkleTree from './merkle-tree/merkle-tree.service';

import submitProof from './submit-proof/submit-proof.service';

export default function (app: Application): void {
  app.configure(users);
  app.configure(blocklist);
  app.configure(ipfsClient);
  app.configure(repository);
  app.configure(tornadoContract);
  app.configure(commitments);
  app.configure(poolIndexer);
  app.configure(rateLimiter);
  app.configure(exclusionTree);
  app.configure(proverParameters);
  app.configure(progressIndicator);
  app.configure(merkleTree);
  app.configure(submitProof);
}
