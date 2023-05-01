import assert from 'assert';
import app from '../../src/app';

describe('\'tornado-contract\' service', () => {
  it('registered the service', () => {
    const service = app.service('tornado-contract');

    assert.ok(service, 'Registered the service');
  });
});
