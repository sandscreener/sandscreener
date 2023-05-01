import assert from 'assert';
import simpleCache from '../../src/hooks/simple-cache';

describe('\'simple-cache\' hook', () => {
  let cache;
  beforeEach(() => {
    cache = {
      put: (key: string, value: any) => {
        cache[key] = value;
      },
      get: (key: string) => {
        return cache[key];
      },
    };
  });
  it('caches and retrieves result from cache', async () => {
    // Set up
    const hook = simpleCache({ queryParams: ['id'] });
    const context = {
      app: {
        get: () => cache,
      },
      type: 'before',
      params: {
        query: {
          id: '1',
        },
      },
      result: undefined as any,
    };

    // Call the hook before to check if the result wash cached
    const updatedContext = (await hook(context as any)) as any;

    // The updated context should not have the cached result
    assert.equal(updatedContext.result, undefined);
    assert.equal(updatedContext.params.cacheUsed, undefined);

    // Call the hook after to cache the result
    context.type = 'after';
    context.result = 'testResult';
    const retrievedContext = (await hook(context as any)) as any;

    // The retrieved context should have the cached result
    assert.equal(retrievedContext.result, 'testResult');
    assert.equal(retrievedContext.params.cacheUsed, undefined);
    assert.equal(cache['1'], 'testResult');

    //Call the hook before to check if the result was cached
    context.type = 'before';
    context.result = undefined;
    const cachedContext = (await hook(context as any)) as any;
    assert.equal(cachedContext.result, 'testResult');
    assert.equal(cachedContext.params.cacheUsed, true);
  });

  it('does not cache when there are no query params', async () => {
    // Set up

    const hook = simpleCache();
    const context = {
      app: {
        get: () => cache,
      },
      type: 'after',
      params: {
        query: {
          id: '1',
        },
      },
    };

    // Initial request should not have cached result
    assert.equal(cache['1'], undefined);

    // Call the hook to cache the result, but it should not be cached since there are no query params
    const updatedContext = (await hook(context as any)) as any;

    // The updated context should not have the cached result
    assert.equal(updatedContext.result, undefined);
    assert.equal(updatedContext.params.cacheUsed, undefined);

    // Check that the result was not cached
    assert.equal(cache['1'], undefined);
  });
});
