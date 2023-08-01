import { useEffect, useState } from "react";
import getExclusionTree from "../utils/getExclusionTree";
import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import { ethers } from "ethers";

type Blocklist = {
  blocklist: string[];
};

/**
 * Get the blocklist file from IPFS
 * @param cid CID of the blocklist file
 * @returns parsed blocklist JS
 */
const useBlocklistRoot = (
  apolloClient: ApolloClient<NormalizedCacheObject> | undefined,
  blocklistData: Blocklist | undefined,
  currency: string,
  amount: string
) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exclusionTreeRoot, setExclusionTreeRoot] = useState<string>();
  useEffect(() => {
    const fetchExclusionTree = async (
      apolloClient: ApolloClient<NormalizedCacheObject>,
      blocklistedAddresses: string[],
      currency: string,
      amount: string
    ) => {
      setLoading(true);
      const exclusionTree = await getExclusionTree(
        apolloClient,
        blocklistedAddresses,
        currency,
        amount
      );
      setLoading(false);
      return exclusionTree.root;
    };
    if (
      !apolloClient ||
      (blocklistData?.blocklist.length ?? 0) <= 0 ||
      exclusionTreeRoot
    ) {
      return;
    }
    fetchExclusionTree(
      apolloClient,
      blocklistData!.blocklist,
      currency,
      amount
    ).then((root) => {
      setExclusionTreeRoot(ethers.utils.hexlify(BigInt(root)));
    });
  }, [exclusionTreeRoot, blocklistData, apolloClient, amount, currency]);
  return { exclusionTreeRoot, error, loading };
};

export default useBlocklistRoot;
