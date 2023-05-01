import assert from 'assert';
import app from '../../src/app';

describe('\'submit-proof\' service', () => {
  it('registered the service', () => {
    const service = app.service('submit-proof');

    assert.ok(service, 'Registered the service');
  });
});
