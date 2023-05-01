// See https://sequelize.org/master/manual/model-basics.html
// for more of what you can do here.
import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';
import { Pool } from '../types/pool';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const commitmentsSchema = sequelizeClient.define(
    'commitments',
    {
      //The following properties are coming from the event
      commitment: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      leafIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      timestamp: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      //The following properties are coming from the TX receipt
      // tx Hash is NOT unique because it is possible to have multiple commitments in the same TX (e.g., see https://etherscan.io/tx/0xa94813af66edab7a4b8f4bef274d2bbaaf68e6b2717619e66294df4c06bc6c29#eventlog)
      txHash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      depositor: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      poolName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      chainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      hooks: {
        beforeCount(options: any): HookReturn {
          options.raw = true;
        },
      },
    }
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (commitmentsSchema as any).associate = function (models: any): void {
    // Define associations here
    // See https://sequelize.org/master/manual/assocs.html
  };

  return commitmentsSchema;
}
