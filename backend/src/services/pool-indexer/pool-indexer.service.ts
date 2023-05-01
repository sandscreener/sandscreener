// Initializes the `pool-indexer` service on path `/pool-indexer`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { PoolIndexer } from './pool-indexer.class';
import createModel from '../../models/pool-indexer.model';
import hooks from './pool-indexer.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'pool-indexer': PoolIndexer & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  // Initialize our service with any options it requires
  app.use('/pool-indexer', new PoolIndexer(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('pool-indexer');

  service.hooks(hooks);
}
