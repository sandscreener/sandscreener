// Initializes the `proverParameters` service on path `/prover-parameters`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { ProverParameters } from './prover-parameters.class';
import hooks from './prover-parameters.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'prover-parameters': ProverParameters & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    paginate: app.get('paginate'),
  };

  // Initialize our service with any options it requires
  app.use('/prover-parameters', new ProverParameters(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('prover-parameters');

  service.hooks(hooks);
}
