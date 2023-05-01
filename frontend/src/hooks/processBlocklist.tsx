import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import getDb from './getDB';
import Limiter from '../components/limiter';

type Status = 'idle' | 'loading' | 'succeeded' | 'failed';

const processBlocklist = (
  routerContract: ethers.Contract | undefined,
  poolContract: ethers.Contract | undefined,
  blocklistedAddresses: string[] | undefined,
  blocklistCid: string,
  fromBlock: number,
  toBlock: number
) => {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState(null);
  const statusPerAddress = new Array(blocklistedAddresses?.length ?? 0).fill(
    'idle'
  );

  const commitmentStatusByTxId = new Map<string, Status>();

  const { db, dbError, dbLoading } = getDb();

  const fetchData = async () => {
    if (
      blocklistedAddresses &&
      (blocklistedAddresses?.length ?? 0 > 0) &&
      routerContract &&
      db &&
      !dbError &&
      !dbLoading &&
      poolContract
    ) {
      setStatus('loading');
      setProgress(0);
      while (
        statusPerAddress.includes('idle') ||
        statusPerAddress.includes('loading') ||
        statusPerAddress.includes('failed')
      ) {
        for (let i = 0; i < blocklistedAddresses.length; i++) {
          await tryFetchCommitmentsForAddress(i);
        }
      }

      const commitmentFetchStatuses = Array.from(
        commitmentStatusByTxId.values()
      );
      while (
        commitmentFetchStatuses.includes('loading') ||
        commitmentFetchStatuses.includes('failed')
      ) {
        for (const txId of commitmentStatusByTxId.keys()) {
          tryFetchCommitment(txId);
        }
      }

      db.getAllFromIndex(
        'commitments',
        'by-commitment-blocklist-and-pool',
        IDBKeyRange.bound(
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            blocklistCid,
            poolContract.address,
          ],
          [
            '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
            blocklistCid,
            poolContract.address,
          ],
          false,
          false
        )
      ).then((commitments) => {
        console.log('commitments', commitments?.length ?? 0);
        //Logging the first ten commitments:
        console.log('commitments', commitments?.slice(0, 10));
      });

      setStatus('succeeded');
    }

    async function tryFetchCommitmentsForAddress(i: number) {
      const tokensRemoved = await Limiter.limiter.removeTokens(80);
      if (!tokensRemoved) {
        return;
      }
      if (!routerContract || !db || !blocklistedAddresses) {
        return;
      }
      if (
        statusPerAddress[i] !== 'loading' &&
        statusPerAddress[i] !== 'succeeded'
      ) {
        statusPerAddress[i] = 'loading';
        //The EncryptedNote event of the Router contract is the only one that has the sender address index,
        //so using it to quickly find only the transactions from the blocklisted addresses, and later get
        //the TX receipt to get the commitment from the 2nd event log (Deposit on a specific Tornado pool instance).
        const filter = routerContract.filters.EncryptedNote(
          blocklistedAddresses[i]
        );

        routerContract
          .queryFilter(filter, fromBlock, toBlock)
          .then((events) => {
            statusPerAddress[i] = 'succeeded';
            setProgress(
              (prevProgress) => prevProgress + 1 / blocklistedAddresses.length
            );
            for (const e of events) {
              if (!e.removed) tryFetchCommitment(e.transactionHash);
            }
          })
          .catch((e: any) => {
            console.error(e);
            statusPerAddress[i] = 'failed';
          });
      }
    }

    function tryFetchCommitment(txHash: string) {
      Limiter.limiter.removeTokens(20).then((tokensRemoved) => {
        if (!tokensRemoved) {
          return;
        }
        if (!db || !poolContract) {
          return;
        }
        if (
          !commitmentStatusByTxId.has(txHash) ||
          commitmentStatusByTxId.get(txHash) !== 'succeeded'
        ) {
          commitmentStatusByTxId.set(txHash, 'loading');

          db.getFromIndex('commitments', 'by-blocklist-pool-and-txId', [
            blocklistCid,
            poolContract.address,
            txHash,
          ])
            .then((commitment) => {
              if (commitment) {
                commitmentStatusByTxId.set(txHash, 'succeeded');
              } else {
                poolContract.provider
                  .getTransactionReceipt(txHash)
                  .then((txReceipt) => {
                    if (
                      txReceipt.status &&
                      txReceipt?.logs[0].address === poolContract?.address
                    ) {
                      const commitmentValue = poolContract.interface.parseLog(
                        txReceipt.logs[0]
                      ).args[0];
                      db.add('commitments', {
                        txId: txHash,
                        commitmentValue: commitmentValue,
                        pool: poolContract.address,
                        blocklistId: blocklistCid,
                      })
                        .then(() => {
                          commitmentStatusByTxId.set(txHash, 'succeeded');
                        })
                        .catch((e: any) => {
                          markCommitmentFetchFailed(txHash, e);
                        });
                    } else {
                      commitmentStatusByTxId.set(txHash, 'succeeded');
                    }
                  })
                  .catch((e: any) => {
                    markCommitmentFetchFailed(txHash, e);
                    return;
                  });
              }
            })
            .catch((e: any) => {
              markCommitmentFetchFailed(txHash, e);
            });
        }
      });
      function markCommitmentFetchFailed(txHash: string, e: any) {
        console.error(e);
        commitmentStatusByTxId.set(txHash, 'failed');
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [blocklistedAddresses, db, dbLoading, blocklistCid]);

  return { status, error, progress };
};

export default processBlocklist;
