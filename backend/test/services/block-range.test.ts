import assert from 'assert';
import app from '../../src/app';

describe('\'block-range\' service', () => {
  it('registered the service', () => {
    const service = app.service('block-range');

    assert.ok(service, 'Registered the service');
  });
});
