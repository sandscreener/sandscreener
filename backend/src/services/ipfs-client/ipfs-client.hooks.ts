import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt'), disallow('external')],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
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
