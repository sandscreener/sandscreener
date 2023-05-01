import assert from 'assert';
import app from '../../src/app';

describe('\'progress-indicator\' service', () => {
  it('registered the service', () => {
    const service = app.service('progress-indicator');

    assert.ok(service, 'Registered the service');
  });
});
