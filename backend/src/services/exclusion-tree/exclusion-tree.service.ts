// Initializes the `exclusion-tree` service on path `/exclusion-tree`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { ExclusionTree } from './exclusion-tree.class';
import hooks from './exclusion-tree.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'exclusion-tree': ExclusionTree & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    paginate: app.get('paginate'),
  };

  // Initialize our service with any options it requires
  app.use('/exclusion-tree', new ExclusionTree(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('exclusion-tree');

  service.hooks(hooks);
}
