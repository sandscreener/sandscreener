import configuration from '@feathersjs/configuration';
import services from '../../src/services';
import assert from 'assert';
import app from '../../src/app';

describe('\'rateLimiter\' service', () => {
  before(async () => {
    app.configure(services);
    app.configure(configuration());
  });
  it('registered the service', () => {
    const service = app.service('rate-limiter');

    assert.ok(service, 'Registered the service');
  });

  it('find method should throw if no compute units supplied', (done) => {
    // Call the find method
    app
      .service('rate-limiter')
      .find({})
      .catch((error) => {
        assert.equal(error.message, 'Missing compute units');
        done();
      });
  });

  it('find method should return the rate limit', async () => {
    // Call the find method
    const result = await app.service('rate-limiter').find({ computeUnits: 100 });
    assert.equal(result, 230);
  });
});
