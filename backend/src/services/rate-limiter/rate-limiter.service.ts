// Initializes the `rateLimiter` service on path `/rate-limiter`
import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { RateLimiter } from './rate-limiter.class';
import hooks from './rate-limiter.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'rate-limiter': RateLimiter & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/rate-limiter', new RateLimiter(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('rate-limiter');

  service.hooks(hooks);
}
