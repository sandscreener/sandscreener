// See https://sequelize.org/master/manual/model-basics.html
// for more of what you can do here.
import { Sequelize, DataTypes, Model } from 'sequelize';
import { Application } from '../declarations';
import { HookReturn } from 'sequelize/types/hooks';
import { Pool } from '../types/pool';

export default function (app: Application): typeof Model {
  const sequelizeClient: Sequelize = app.get('sequelizeClient');
  const poolIndexer = sequelizeClient.define(
    'pool_indexer',
    {
      status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      poolName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      chainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      }
    },
    {
      hooks: {
        beforeCount(options: any): HookReturn {
          options.raw = true;
        },
      },
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (poolIndexer as any).associate = function (models: any): void {
    // Define associations here
    // See https://sequelize.org/master/manual/assocs.html
  };

  return poolIndexer;
}
