import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import * as local from '@feathersjs/authentication-local';
const { protect } = local.hooks;
import { disallow } from 'feathers-hooks-common';

const { authenticate } = authentication.hooks;

export default (): Partial<HooksObject> => {
  return {
    before: {
      all: [authenticate('jwt')],
      find: [],
      get: [disallow('external')],
      create: [disallow('external')],
      update: [disallow('external')],
      patch: [disallow('external')],
      remove: [disallow('external')],
    },

    after: {
      all: [protect('user'), protect('authenticated'), protect('authentication')],
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
};
