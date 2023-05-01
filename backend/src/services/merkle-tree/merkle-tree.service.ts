// Initializes the `merkle-tree` service on path `/merkle-tree`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { MerkleTree } from './merkle-tree.class';
import createModel from '../../models/merkle-tree.model';
import hooks from './merkle-tree.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'merkle-tree': MerkleTree & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  // Initialize our service with any options it requires
  app.use('/merkle-tree', new MerkleTree(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('merkle-tree');

  service.hooks(hooks);
}
