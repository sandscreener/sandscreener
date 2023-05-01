// Initializes the `tornado-contract` service on path `/tornado-contract`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { TornadoContract } from './tornado-contract.class';
import hooks from './tornado-contract.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'tornado-contract': TornadoContract & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/tornado-contract', new TornadoContract(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('tornado-contract');

  service.hooks(hooks);
}
