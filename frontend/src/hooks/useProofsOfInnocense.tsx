import { Provider } from "@wagmi/core";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { isAddressValid } from "../utils/addressValidation";

export default function useProofsOfInnocense(
  blocklistRegistryAddress: string,
  contractAbi: {}[] | undefined,
  provider: Provider,
  userAddress: string | undefined
) {
  const [userProofs, setUserProofs] = useState<
    {
      poolAddress: string;
      txHash: string;
      editor: string;
      blockNumber: number;
    }[]
  >([]);

  useEffect(() => {
    if (
      !blocklistRegistryAddress ||
      !contractAbi ||
      (userAddress && !isAddressValid(userAddress))
    ) {
      setUserProofs([]);
      return;
    }

    const blocklistRegistry = new ethers.Contract(
      blocklistRegistryAddress,
      contractAbi,
      provider
    );
    const filter = blocklistRegistry.filters.ProofSubmitted(userAddress);
    //TODO use Graph instead of querying events
    const fetchEvents = async () => {
      const events = await blocklistRegistry.queryFilter(filter);
      const mappedEvents = await Promise.all(
        events.map(async (proofEvent) => {
          const filter = blocklistRegistry.filters.ExclusionRootStored(
            proofEvent.args?.exclusionTreeRoot
          );
          const events = await blocklistRegistry.queryFilter(filter);
          const foundRootEvent = events.find((submittedRootEvent) => {
            return (
              submittedRootEvent.args?.blocklistHash ===
              proofEvent.args?.blocklistHash
            );
          });
          return {
            poolAddress: proofEvent.args?.poolAddress.toString() ?? "",
            txHash: proofEvent?.transactionHash.toString() ?? "",
            editor: foundRootEvent?.args?.editorAddress.toString() ?? "",
            blockNumber: foundRootEvent?.blockNumber ?? 0,
          };
        })
      );
      setUserProofs(mappedEvents);
    };
    fetchEvents();
  }, [blocklistRegistryAddress, contractAbi, provider, userAddress]);

  return userProofs;
}
