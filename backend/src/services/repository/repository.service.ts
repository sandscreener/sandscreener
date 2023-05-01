// Initializes the `repository` service on path `/repository`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { Repository } from './repository.class';
import hooks from './repository.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    repository: Repository & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    paginate: app.get('paginate'),
  };

  // Initialize our service with any options it requires
  app.use('/repository', new Repository(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('repository');

  service.hooks(hooks);
}
