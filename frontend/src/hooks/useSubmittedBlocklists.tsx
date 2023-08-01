import { Provider } from "@wagmi/core";
import { ethers } from "ethers";
import { useEffect, useState } from "react";

export default function useSubmittedBlocklists(
  blocklistRegistryAddress: string,
  contractAbi: {}[] | undefined,
  provider: Provider
) {
  const [submittedBlocklists, setSubmittedBlocklists] = useState<
    {
      exclusionTreeRoot: string;
      editorAddress: string;
      blocklistHash: string;
      txHash: string;
      blockNumber: number;
    }[]
  >([]);

  useEffect(() => {
    if (!blocklistRegistryAddress || !contractAbi) {
      setSubmittedBlocklists([]);
      return;
    }

    const blocklistRegistry = new ethers.Contract(
      blocklistRegistryAddress,
      contractAbi,
      provider
    );
    const filter = blocklistRegistry.filters.ExclusionRootStored();
    //TODO use Graph instead of querying events
    const fetchEvents = async () => {
      const events = await blocklistRegistry.queryFilter(filter);
      const mappedEvents = events.map((proofEvent) => {
        return {
          exclusionTreeRoot:
            proofEvent.args?.exclusionTreeRoot.toString() ?? "",
          editorAddress: proofEvent.args?.editorAddress.toString() ?? "",
          blocklistHash: proofEvent.args?.blocklistHash.toString() ?? "",
          txHash: proofEvent?.transactionHash.toString() ?? "",
          blockNumber: proofEvent?.blockNumber ?? 0,
        };
      });

      setSubmittedBlocklists(mappedEvents);
    };
    fetchEvents();
  }, [blocklistRegistryAddress, contractAbi, provider]);

  return submittedBlocklists;
}
