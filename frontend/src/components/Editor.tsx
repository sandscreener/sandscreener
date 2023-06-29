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

const Editor = (props: {
  chainId: keyof typeof CHAIN_GRAPH_URLS;
  editorRoleHashData: any;
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
  )[props.chainId];
  //TODO parse safely, may not be deployed on a specific chain yet
  const blocklistRegistryAddress = contractDeployment?.address ?? undefined;
  const contractJson: string | undefined = (contractAbis as any)[props.chainId];
  //TODO parse safely, may not be deployed on a specific chain yet
  const contractAbi = JSON.parse(contractJson ?? "{}");

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
      !!blocklistRegistryAddress && !!isConnected && !!props.editorRoleHashData,
    onSuccess(data) {
      console.log("Connected user is", data ? "Editor" : "not Editor");
    },
    onError(err) {
      console.log("isEditorError", err);
    },
  });

  const { config: addListHashConfig } = usePrepareContractWrite({
    address: `0x${blocklistRegistryAddress?.slice(2)}`,
    abi: contractAbi,
    functionName: "addListHash",
    args: [digest, hashFunction, size],
    enabled:
      !!blocklistRegistryAddress &&
      !!digest &&
      !!hashFunction &&
      !!size &&
      !!isEditor,
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
    enabled: !!blocklistRegistryAddress && !!isEditor && !!address,

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
        <div>
          {latestBlocklistHash &&
            `You are an Editor. Your latest submitted blocklist is ${latestBlocklistHash}`}
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

            <Button
              style={{ padding: 5, margin: 5 }}
              type="button"
              disabled={!cid}
              onClick={convertCid}
            >
              Convert CID to Multihash
            </Button>
            <br />
            <label htmlFor="digest">Digest:</label>
            <input
              style={{ padding: 5, margin: 5 }}
              type="text"
              id="digest"
              value={digest}
              onChange={(e) => setDigest(e.target.value)}
            />
            <br />

            <label htmlFor="hashFunction">Hash Function:</label>
            <input
              style={{ padding: 5, margin: 5 }}
              type="text"
              id="hashFunction"
              value={hashFunction}
              onChange={(e) => setHashFunction(e.target.value)}
            />
            <br />
            <label htmlFor="size">Size:</label>
            <input
              style={{ padding: 5, margin: 5 }}
              type="text"
              id="size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
            <br />
            {(isPrepareListWriteError || isListHashError) && (
              <div>
                Error: {(prepareListWriteError || addListHashError)?.message}
              </div>
            )}
            <br />
            <Button
              style={{ padding: 5, margin: 5 }}
              type="button"
              disabled={!writeListHash || isAddListHashLoading}
              onClick={() => writeListHash?.()}
            >
              {isAddListHashLoading
                ? "Submitting the Blocklist..."
                : "Submit Blocklist"}
            </Button>
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
