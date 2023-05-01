import configuration from '@feathersjs/configuration';
import assert from 'assert';
import app from '../../src/app';
import services from '../../src/services';

describe('\'repository\' service', () => {
  beforeEach(() => {
    // Reset the app to its initial state
    app.configure(services);
    app.configure(configuration());
  });
  it('registered the service', () => {
    const service = app.service('repository');

    assert.ok(service, 'Registered the service');
  });

  it('throws an error if the private key is not present', (done) => {
    app.set('auditorPrivateKey', null);
    app
      .service('repository')
      .find({query: {chainId: 31337}})
      .catch((error) => {
        assert.equal(error.message, 'Private key cannot be empty');
        done();
      });
  });

  it('throws an error if the chain ID is not present', (done) => {
    app
      .service('repository')
      .find({query: {}})
      .catch((error) => {
        assert.equal(error.message, 'chainId cannot be empty');
        done();
      });
  });
});
