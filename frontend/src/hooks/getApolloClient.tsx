import { useEffect, useState } from "react";
import {
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";
import CHAIN_GRAPH_URLS from "../config/subgraph";

/**
 * Get the Apollo client for the given chain ID
 * @param chainId Chain ID
 * @returns Apollo client
 */
const getApolloClient = (chainId: number | undefined) => {
  const [apolloClient, setApolloClient] =
    useState<ApolloClient<NormalizedCacheObject>>();

  useEffect(() => {
    if (chainId as keyof typeof CHAIN_GRAPH_URLS) {
      const id = chainId as keyof typeof CHAIN_GRAPH_URLS;
      setApolloClient(
        new ApolloClient({
          uri: CHAIN_GRAPH_URLS[id],
          cache: new InMemoryCache(),
        })
      );
    }
  }, [chainId]);
  return { apolloClient: apolloClient };
};

export default getApolloClient;
