// Initializes the `blocklist` service on path `/blocklist`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { Blocklist } from './blocklist.class';
import createModel from '../../models/blocklist.model';
import hooks from './blocklist.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    blocklist: Blocklist & ServiceAddons<any>;
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
  app.use('/blocklist', new Blocklist(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('blocklist');

  service.hooks(hooks());
}
