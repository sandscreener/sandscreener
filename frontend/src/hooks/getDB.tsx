import { useEffect, useState } from 'react';
import { IDBPDatabase, openDB } from 'idb';
import CommitmentsDBSchema from '../components/db';

const getDb = () => {
  const [db, setDb] = useState<IDBPDatabase<CommitmentsDBSchema>>();
  const [dbError, setError] = useState(null);
  const [dbLoading, setLoading] = useState(false);

  useEffect(() => {
    const prepareDb = async () => {
      setLoading(true);
      const db = await openDB<CommitmentsDBSchema>('commitments-db', 1, {
        upgrade(db, oldVersion, newVersion, transaction) {
          if (!db.objectStoreNames.contains('commitments')) {
            const commitmentStore = db.createObjectStore('commitments', {
              keyPath: 'id',
              autoIncrement: true,
            });
          }

          if (!db.objectStoreNames.contains('blocklists')) {
            const commitmentStore = db.createObjectStore('blocklists', {
              keyPath: 'cid',
            });
          }

          const storeName = transaction.objectStore('commitments');
          if (!storeName.indexNames.contains('by-blocklist-pool-and-txId')) {
            storeName.createIndex('by-blocklist-pool-and-txId', [
              'blocklistId',
              'pool',
              'txId',
            ]);
          }

          if (
            !storeName.indexNames.contains('by-commitment-blocklist-and-pool')
          ) {
            storeName.createIndex('by-commitment-blocklist-and-pool', [
              'commitmentValue',
              'blocklistId',
              'pool',
            ]);
          }
        },
      });
      setLoading(false);
      setDb(db);
    };
    prepareDb();
  }, []);

  return { db, dbError, dbLoading };
};

export default getDb;
