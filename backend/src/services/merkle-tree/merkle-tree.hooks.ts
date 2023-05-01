import { disallow } from 'feathers-hooks-common';
import * as authentication from '@feathersjs/authentication';
import cacheBy from '../../hooks/simple-cache';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt'), disallow('external')],
    find: [
      cacheBy({
        queryParams: ['poolName'],
      }),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      cacheBy({
        queryParams: ['poolName'],
      }),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
