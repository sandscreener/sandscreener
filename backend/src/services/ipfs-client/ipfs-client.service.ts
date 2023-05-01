// Initializes the `ipfs-client` service on path `/ipfs-client`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { IpfsClient } from './ipfs-client.class';
import hooks from './ipfs-client.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'ipfs-client': IpfsClient & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/ipfs-client', new IpfsClient(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('ipfs-client');

  service.hooks(hooks);
}
