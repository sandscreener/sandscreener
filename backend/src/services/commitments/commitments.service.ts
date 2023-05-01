// Initializes the `commitments` service on path `/commitments`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { Commitments } from './commitments.class';
import createModel from '../../models/commitments.model';
import hooks from './commitments.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'commitments': Commitments & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    // Allows to remove all entries from the blocklist at once
    multi: ['remove'],
  };

  // Initialize our service with any options it requires
  app.use('/commitments', new Commitments(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('commitments');

  service.hooks(hooks);
}
