import { Hook, HookContext } from '@feathersjs/feathers';
import { Cache } from 'memory-cache';

type CacheHookOptions = {
  queryParams: string[];
};

export default (
  options: CacheHookOptions = {
    queryParams: [],
  }
): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    //Create cache key from query param values specified in queryParams
    const key = options.queryParams.map((param) => context.params.query[param]).join('');
    if (context.type === 'after') {
      console.log('Caching result for key: ' + key);
      const cache: Cache = context.app.get('cacheManager');
      cache.put(key, context.result);
      return context;
    } else if (context.type === 'before') {
      console.log('Checking cache for key: ' + key);
      const cache: Cache = context.app.get('cacheManager');
      const cachedResult = cache.get(key);
      if (cachedResult) {
        console.log('Cache hit for key: ' + key);
        context.result = cachedResult;
        context.params.cacheUsed = true;
      } else {
        console.log('Cache miss for key: ' + key);
      }
    }
    return context;
  };
};
