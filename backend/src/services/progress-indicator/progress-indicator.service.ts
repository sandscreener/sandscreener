// Initializes the `progress-indicator` service on path `/progress-indicator`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { ProgressIndicator } from './progress-indicator.class';
import hooks from './progress-indicator.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'progress-indicator': ProgressIndicator & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/progress-indicator', new ProgressIndicator(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('progress-indicator');

  service.hooks(hooks);
}
