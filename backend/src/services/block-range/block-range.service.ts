// Initializes the `block-range` service on path `/block-range`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { BlockRange } from './block-range.class';
import createModel from '../../models/block-range.model';
import hooks from './block-range.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'block-range': BlockRange & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    // Allows to remove all entries at once
    multi: ['remove'],
  };

  // Initialize our service with any options it requires
  app.use('/block-range', new BlockRange(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('block-range');

  service.hooks(hooks);
}
