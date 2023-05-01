import configuration from '@feathersjs/configuration';
import { Params } from '@feathersjs/feathers';
import assert from 'assert';
import app from '../../src/app';
import services from '../../src/services';

describe('\'blocklist\' service', () => {
  beforeEach(() => {
    // Reset the app to its initial state
    app.configure(services);
    app.configure(configuration());
    // Remove all blocklist entries from DB
    app.service('blocklist').remove(null);
    app.use('/repository', {
      async find(params: Params) {
        params.contract = {
          getLatestHash: (address: string) =>
            address === '0xBcd4042DE499D14e55001CcbB24a551F3b954096'
              ? ['0xf8bf944632a6867568ccc9c0dd2d7419c7ae791ef0fada4ef81e6d5671a8dbcd', 18, 32]
              : null,
        };
        params.wallet = {};
        return params;
      },
    });
    app.use('/ipfs-client', {
      async find(params: Params) {
        params.result.rawBlocklist =
          '{\n' +
          '  "blocklist": [\n' +
          '    "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",\n' +
          '    "0xdD2FD4581271e230360230F9337D5c0430Bf44C0"\n' +
          '  ]\n' +
          '}\n';
        return params;
      },
    });
  });

  afterEach(() => {
    // Remove all blocklist entries from DB
    app.service('blocklist').remove(null);
  });

  it('registered the service', () => {
    const service = app.service('blocklist');

    assert.ok(service, 'Registered the service');
  });

  it('find method should return the encoded hash and list', async () => {
    // Set the address query parameter for the find method
    const params = {
      query: {
        address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
        chainId: 31337,
      },
    };
    // Call the find method
    const result1 = await app.service('blocklist').find(params);

    assert.equal(
      result1.result.blocklist.includes('0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'),
      true
    );
    assert.equal(
      result1.result.blocklist.includes('0xdD2FD4581271e230360230F9337D5c0430Bf44C0'),
      true
    );
    assert.equal(result1.result.blocklist.length, 2);
    //Retrieve from the DB for the second time
    //Make sure we're not retrieving from the IPFS
    app.use('/ipfs-client', {
      async find(params: Params) {
        return null;
      },
    });

    const result2 = await app.service('blocklist').find(params);
    assert.equal(
      result2.result.blocklist.includes('0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'),
      true
    );
    assert.equal(
      result2.result.blocklist.includes('0xdD2FD4581271e230360230F9337D5c0430Bf44C0'),
      true
    );
    assert.equal(result2.result.blocklist.length, 2);
  });

  it('find method should throw an error if the getLatestHash function returns invalid or incomplete data', (done) => {
    app.use('/repository', {
      async find(params: Params) {
        params.contract = {
          getLatestHash: (address: string) =>
            address === '0xBcd4042DE499D14e55001CcbB24a551F3b954096'
              ? ['0xf8bf944632a6867568ccc9c0dd2d7419c7ae791ef0fada4ef81e6d5671a8dbcd'] // Invalid data, missing hashFunction and size
              : null,
        };
        params.wallet = {};
        return params;
      },
    });
    // Set the address query parameter for the find method
    const params = {
      query: {
        address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
        chainId: 1,
      },
    };

    // Call the find method
    app
      .service('blocklist')
      .find(params)
      .catch((error) => {
        assert.equal(error.message, 'Error retrieving hash');
        done();
      });
  });

  it('find method should throw an error if any blocklist entry is invalid', (done) => {
    app.use('/ipfs-client', {
      async find(params: Params) {
        params.result.rawBlocklist =
          '{\n' +
          '  "blocklist": [\n' +
          '    "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C119",\n' +
          '    "0xdD2FD4581271e230360230F9337D5c0430Bf44C0"\n' +
          '  ]\n' +
          '}\n';
        return params;
      },
    });
    // Set the address query parameter for the find method
    const params = {
      query: {
        address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
        chainId: 1,
      },
    };

    // Call the find method
    app
      .service('blocklist')
      .find(params)
      .catch((error) => {
        assert.equal(error.message, 'Error retrieving hash');
        done();
      });
  });

  it('find method should throw an error if there is no blocklist in JSON stored in IPFS', (done) => {
    app.use('/ipfs-client', {
      async find(params: Params) {
        params.result.rawBlocklist =
          '{\n' +
          '  "wrongJson": [\n' +
          '    "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",\n' +
          '    "0xdD2FD4581271e230360230F9337D5c0430Bf44C0"\n' +
          '  ]\n' +
          '}\n';
        return params;
      },
    });
    // Set the address query parameter for the find method
    const params = {
      query: {
        address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
        chainId: 1,
      },
    };

    // Call the find method
    app
      .service('blocklist')
      .find(params)
      .catch((error) => {
        assert.equal(error.message, 'Error retrieving hash');
        done();
      });
  });

  it('find method should throw an error if the ipfs-client service fails to send the HTTP request', (done) => {
    app.use('/ipfs-client', {
      async find() {
        throw new Error('504 Gateway Time-out');
      },
    });
    // Set the address query parameter for the find method
    const params = {
      query: {
        address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
        chainId: 1,
      },
    };
    // Call the find method
    app
      .service('blocklist')
      .find(params)
      .catch((error) => {
        assert.equal(error.message, 'Error retrieving hash');
        done();
      });
  });

  it('find method should throw an error if the parsed JSON does not contain blocklist data', (done) => {
    app.use('/ipfs-client', {
      async find(params: Params) {
        params.result.rawBlocklist = ''; //Invalid JSON
        return params;
      },
    });
    // Set the address query parameter for the find method
    const params = {
      query: {
        address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
        chainId: 1,
      },
    };
    // Call the find method
    app
      .service('blocklist')
      .find(params)
      .catch((error) => {
        assert.equal(error.message, 'Error retrieving hash');
        done();
      });
  });

  it('find method should throw an error if the address parameter is missing', (done) => {
    // DO not provide the address query parameter
    const params = {
      query: { chainId: 1 },
    };
    // Call the find method
    app
      .service('blocklist')
      .find(params)
      .catch((error) => {
        assert.equal(error.message, 'Address is required');
        done();
      });
  });

  it('find method should throw an error if the repository contract was not provided', (done) => {
    app.use('/repository', {
      async find(params: Params) {
        params.contract = null;
        params.wallet = {};
        return params;
      },
    });
    // Set the address query parameter for the find method
    const params = {
      query: {
        address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
        chainId: 1,
      },
    };
    // Call the find method
    app
      .service('blocklist')
      .find(params)
      .catch((error) => {
        assert.equal(error.message, 'Error retrieving hash');
        done();
      });
  });
});
