import React, { useEffect, useState } from "react";
import {
  useAccount,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import contractDeployments from "../contracts/deployments.json";
import contractAbis from "../contracts/contractAbi.json";
import { ethers } from "ethers";
import getCIDFromMultihash from "../hooks/getCIDFromMultihash";
import CHAIN_GRAPH_URLS from "../config/subgraph";
import { Button } from "react-bootstrap";
import { ApolloClient, NormalizedCacheObject } from "@apollo/client";
import getBlocklist from "../hooks/getBlocklist";
import getBlocklistRoot from "../hooks/getBlocklistRoot";

const Editor = (props: {
  chainId: keyof typeof CHAIN_GRAPH_URLS | undefined;
  editorRoleHashData: any;
  apolloClient: ApolloClient<NormalizedCacheObject> | undefined;
}) => {
  const { address, isConnected } = useAccount();
  const [cid, setCid] = useState("");
  const [digest, setDigest] = useState("");
  const [hashFunction, setHashFunction] = useState("");
  const [size, setSize] = useState("");
  const [isPrepareListWriteError, setIsPrepareListWriteError] = useState(false);
  const [prepareListWriteError, setPrepareListWriteError] = useState<Error>();
  const [latestBlocklistHash, setLatestBlocklistHash] = useState("");
  const contractDeployment: { address: string } | undefined = (
    contractDeployments as any
  )[props.chainId ?? "-1"];
  //TODO parse safely, may not be deployed on a specific chain yet
  const blocklistRegistryAddress = contractDeployment?.address ?? undefined;
  const contractJson: string | undefined = (contractAbis as any)[
    props.chainId ?? "-1"
  ];
  //TODO parse safely, may not be deployed on a specific chain yet
  const contractAbi = JSON.parse(contractJson ?? "{}");

  const {
    data: blocklistData,
    error: blocklistLoadingError,
    loading: isBlocklistLoading,
  } = getBlocklist(cid);

  useEffect(() => {
    if (cid) {
      convertCid();
    }
  }, [cid]);

  const {
    data: isEditor,
    isError: isEditorError,
    isLoading: isEditorLoading,
  } = useContractRead({
    address: `0x${blocklistRegistryAddress?.slice(2)}`,
    abi: contractAbi,
    functionName: "hasRole",
    args: [props.editorRoleHashData, address],
    enabled:
      !!blocklistRegistryAddress &&
      !!isConnected &&
      !!props.editorRoleHashData &&
      !!props.chainId,

    onError(err) {
      console.log("isEditorError", err);
    },
  });

  const {
    exclusionTreeRoot,
    error: blocklistRootLoadingError,
    loading: blocklistRootLoading,
  } = getBlocklistRoot(props.apolloClient, blocklistData);

  const { config: addListHashConfig } = usePrepareContractWrite({
    address: `0x${blocklistRegistryAddress?.slice(2)}`,
    abi: contractAbi,
    functionName: "addBlocklistHash",
    args: [digest, hashFunction, size, exclusionTreeRoot],
    enabled:
      !!blocklistRegistryAddress &&
      !!digest &&
      !!hashFunction &&
      !!size &&
      !!isEditor &&
      !!exclusionTreeRoot &&
      !!props.chainId,
    onSuccess() {
      setIsPrepareListWriteError(false);
      setPrepareListWriteError(undefined);
    },
    onError(err) {
      setIsPrepareListWriteError(true);
      setPrepareListWriteError(err);
    },
  });
  const {
    data: addListHashData,
    write: writeListHash,
    error: addListHashError,
    isError: isListHashError,
  } = useContractWrite(addListHashConfig);
  const { isLoading: isAddListHashLoading, isSuccess: isAddListHashSuccess } =
    useWaitForTransaction({
      hash: addListHashData?.hash,
    });

  //If the connected user is an Editor, show their latest hash added to the contract
  const {
    data,
    isError: isLatestListHashError,
    isLoading: isLatestListHashLoading,
  } = useContractRead({
    address: `0x${blocklistRegistryAddress?.slice(2)}`,
    abi: contractAbi,
    args: [address],
    functionName: "getLatestHash",
    enabled:
      !!blocklistRegistryAddress && !!isEditor && !!address && !!props.chainId,

    onError(err) {
      console.log("address:", address);
      console.log("isLatestListHashError", err);
    },
    watch: true,
  });

  useEffect(() => {
    if (data) {
      const encodedHash = getCIDFromMultihash(data);
      setLatestBlocklistHash(encodedHash);
    }
  }, [data]);

  const convertCid = async () => {
    const bs58 = require("bs58");
    const hashBytes = bs58.decode(cid);

    //Check that the CID is in IPFS v0 format:
    if (hashBytes[0] !== 18) {
      alert("CID is not in IPFS v0 format");
      return;
    }

    const digest = ethers.utils.hexValue(hashBytes.slice(2));
    const hashFunction = hashBytes[0];
    const size = hashBytes[1];

    //Output the multihash
    console.log("digest", digest);
    console.log("hashFunction", hashFunction);
    console.log("size", size);
    setDigest(digest);
    setHashFunction(hashFunction);
    setSize(size);
  };

  return (
    <div>
      {isEditor && (
        <div style={{ padding: 5, margin: 5 }}>
          You are an Editor
          <br />
          {latestBlocklistHash &&
            `Your latest submitted blocklist is ${latestBlocklistHash}`}
          <form>
            <label htmlFor="cid">CID:</label>
            <input
              style={{ padding: 5, margin: 5 }}
              type="text"
              id="cid"
              value={cid}
              onChange={function (e) {
                return setCid(e.target.value);
              }}
            />
            <br />

            {(isPrepareListWriteError || isListHashError) && (
              <div>
                Error: {(prepareListWriteError || addListHashError)?.message}
              </div>
            )}
            <br />
            <Button
              type="button"
              disabled={!writeListHash || isAddListHashLoading}
              onClick={() => writeListHash?.()}
            >
              {isAddListHashLoading
                ? "Submitting the Blocklist..."
                : "Submit Blocklist"}
            </Button>
            {isBlocklistLoading && <p>Loading blocklist...</p>}
            {blocklistLoadingError && (
              <p>Error loading blocklist: {blocklistLoadingError}</p>
            )}
            {blocklistRootLoading && (
              <progress
                value={undefined}
                title="Constructing exclusion tree..."
              />
            )}
            {isAddListHashLoading && <progress value={undefined} />}
            {isAddListHashSuccess && (
              <div>
                Successfully added the list hash!
                <div>
                  <a
                    href={`https://${
                      props.chainId === 5 ? "goerli." : ""
                    }etherscan.io/tx/${addListHashData?.hash}`}
                  >
                    Etherscan
                  </a>
                </div>
              </div>
            )}
            <hr />
          </form>
        </div>
      )}
    </div>
  );
};

export default Editor;
