import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { groth16 } from 'snarkjs';
import { utils } from 'ffjavascript';
import { Application } from '../../declarations';

interface Proof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

interface ProofWithInputs {
  proof: Proof;
  publicSignals: string[];
}

export class SubmitProof extends Service {
  app: Application;
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }

  async create(data: ProofWithInputs, params: any) {
    // Create a copy of the params object without the transport to pass to the internal services
    const internalParams = { ...params };
    delete internalParams.provider;
    const contractResponse = await this.app.service('repository').find(internalParams);
    // Check that the contract was returned in the response
    if (!contractResponse.contract) {
      throw new Error('Repository contract was not initialized correctly');
    }
    const calldata = await groth16.exportSolidityCallData(
      utils.unstringifyBigInts(data.proof),
      utils.unstringifyBigInts(data.publicSignals)
    );
    const argv = calldata
      .replace(/["[\]\s]/g, '')
      .split(',')
      .map((x: any) => BigInt(x).toString());
    const a = [argv[0], argv[1]];
    const b = [
      [argv[2], argv[3]],
      [argv[4], argv[5]],
    ];
    const c = [argv[6], argv[7]];
    const inputs = argv.slice(8);

    const valid = await contractResponse.contract.verifyProof(a, b, c, inputs);
    if (!valid) {
      throw new Error('The proof is not valid');
    }
    //TODO check nullifier
    //TODO store in DB?
    return {
      valid: valid,
    };
  }
}
