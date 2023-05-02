import { useAccount, useContractRead, useProvider } from "wagmi";

import { Account, Connect, NetworkSwitcher } from "../components";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import contractDeployments from "../contracts/deployments.json";
import contractAbis from "../contracts/contractAbi.json";
import getBlocklist from "../hooks/getBlocklist";
import Collapsible from "react-collapsible";
import tornadoPoolABI from "../contracts/tornado/TornadoCash_Eth_01.json";
import feathers, { rest } from "@feathersjs/client";
import axios from "axios";
import { parseNote } from "../utils/crypto.js";
import Auditor from "../components/Auditor";
import Editor from "../components/Editor";
import getCIDFromMultihash from "../hooks/getCIDFromMultihash";
import { isAddressValid } from "../utils/address_validation";
import MerkleTree from "fixed-merkle-tree";
const groth16 = require("snarkjs").groth16;

const CIRCUIT_WASM_PATH = "./zk/withdraw.wasm";
const CIRCUIT_ZKEY_PATH = "./zk/withdraw.zkey";

type Deployment = {
  address: string;
};

export type Deployments = {
  [network: string]: Deployment;
};

export type ABIs = {
  [network: string]: string;
};

function Page() {
  const PRODUCTION = process.env.NODE_ENV === "production";
  console.log(
    "process.env.NEXT_PUBLIC_BACKEND_ADDRESS",
    process.env.NEXT_PUBLIC_BACKEND_ADDRESS
  );

  const [feathersClient, setFeathersClient] = useState<any>();
  const { address, isConnected, connector } = useAccount();
  const [chainId, setChainId] = useState<"1" | "5" | "31337">("5");
  const [blocklistRegistryAddress, setContractAddress] = useState(
    contractDeployments[5].address
  );

  const [proofStatus, setProofStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [note, setNote] = useState("");
  //TODO toggle
  const [noteInputType, setNoteInputType] = useState<"text" | "password">(
    "password"
  );
  const [poolAddress, setPoolAddress] = useState<string>();
  const [poolName, setPoolName] = useState("");
  const [commitmentHex, setCommitmentHex] = useState("");
  const [nullifierHash, setNullifierHash] = useState("");
  const [nullifier, setNullifier] = useState("");
  const [secret, setSecret] = useState("");
  const [isCommitmentValid, setCommitmentValid] = useState(false);
  const [contractAbi, setContractAbi] = useState(JSON.parse(contractAbis[5]));

  const provider = useProvider({
    chainId: Number.parseInt(chainId),
  });

  useEffect(() => {
    connector?.getChainId().then((chainId) => {
      console.log("chainId", chainId);
      setChainId(chainId.toString() as "5" | "31337");
      setContractAddress((contractDeployments as Deployments)[chainId].address);
      setContractAbi(JSON.parse((contractAbis as ABIs)[chainId]));
    });
  }, [connector]);

  useEffect(() => {
    const feathersClient = feathers();
    const restClient = rest(
      PRODUCTION
        ? process.env.NEXT_PUBLIC_BACKEND_ADDRESS
        : "http://localhost:3030"
    );
    feathersClient.configure(restClient.axios(axios));
    setFeathersClient(feathersClient);
  }, []);

  /* Add List Hash */
  const [listAuthorAddress, _setListAuthorAddress] = useState("");
  //TODO display error
  const [listAuthorAddressError, setListAuthorAddressError] = useState(false);
  const setListAuthorAddress = (address: string) => {
    setListAuthorAddressError(!isAddressValid(address));
    _setListAuthorAddress(address);
    setProofStatus("idle");
  };
  const [latestBlocklistHashForAddress, setLatestBlocklistHashForAddress] =
    useState("");

  const {
    data: blocklistHashData,
    isError,
    isLoading,
  } = useContractRead({
    address: `0x${blocklistRegistryAddress.slice(2)}`,
    abi: contractAbi,
    args: [address],
    functionName: "getLatestHash",
    enabled: !!listAuthorAddress,
    onError(err) {
      console.log("address:", listAuthorAddress);
      console.log("isLatestListHashError", err);
    },
  });

  useEffect(() => {
    if (blocklistHashData) {
      const encodedHash = getCIDFromMultihash(blocklistHashData);
      setLatestBlocklistHashForAddress(encodedHash);
    }
  }, [blocklistHashData]);

  const checkAndSetNote = async (note: string) => {
    if (!note) {
      setNote("");
      setCommitmentHex("");
      setNullifierHash("");
      setNullifier("");
      setSecret("");
      setCommitmentValid(false);
      setProofStatus("idle");
      return;
    }
    try {
      const parsedNote = parseNote(note);
      if (parsedNote.currency !== "eth") {
        alert("Only ETH notes are supported");
        return;
      }
      if (parsedNote.netId !== chainId) {
        alert(
          "Please switch to the same network as the deposit was made on. The deposit was made on the " +
            parsedNote.netId +
            " network."
        );
        return;
      }
      setCommitmentValid(false);
      setProofStatus("idle");
      switch (parsedNote.amount) {
        case "0.1":
          switch (chainId) {
            case "5":
              setPoolAddress("0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7");
              setPoolName("01ETH");
              break;
            case "1":
            case "31337":
              setPoolAddress("0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc");
              setPoolName("01ETH");
              break;
          }
          break;
        case "1":
          switch (chainId) {
            case "5":
              setPoolAddress("0x3aac1cC67c2ec5Db4eA850957b967Ba153aD6279");
              setPoolName("1ETH");
              break;
            case "1":
            case "31337":
              setPoolAddress("0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936");
              setPoolName("1ETH");
              break;
          }
          break;
        case "10":
          switch (chainId) {
            case "5":
              setPoolAddress("0x723B78e67497E85279CB204544566F4dC5d2acA0");
              setPoolName("10ETH");
              break;
            case "1":
            case "31337":
              setPoolAddress("0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF");
              setPoolName("10ETH");
              break;
          }
          break;
        case "100":
          switch (chainId) {
            case "5":
              setPoolAddress("0x0E3A09dDA6B20aFbB34aC7cD4A6881493f3E7bf7");
              setPoolName("100ETH");
              break;
            case "1":
            case "31337":
              setPoolAddress("0xA160cdAB225685dA1d56aa342Ad8841c3b53f291");
              setPoolName("100ETH");
              break;
          }
          break;
      }
      setNote(note);
      setCommitmentHex(parsedNote.commitmentHex);
      setNullifierHash(BigInt(parsedNote.nullifierHash).toString());
      setNullifier(BigInt(parsedNote.nullifier).toString());
      setSecret(BigInt(parsedNote.secret).toString());
    } catch (e) {
      console.log("e", e);
    }
  };

  useEffect(() => {
    if (!commitmentHex || isCommitmentValid || !poolAddress) return;
    console.log("poolAddress", poolAddress);
    const tornadoPoolContract: ethers.Contract = new ethers.Contract(
      poolAddress,
      tornadoPoolABI,
      provider
    );
    const filter = tornadoPoolContract.filters.Deposit(commitmentHex);
    const fetchEvents = async () => {
      const events = await tornadoPoolContract.queryFilter(filter);
      setCommitmentValid(events.length > 0);
      if (events.length <= 0) {
        alert("Commitment not found");
        setNote(note);
        setCommitmentHex("");
        setNullifierHash("");
        setNullifier("");
        setSecret("");
      } else {
        console.log(`Commitment found in ${poolName} pool`);
      }
    };
    console.log("tornadoPoolContract.address", tornadoPoolContract.address);
    fetchEvents();
  }, [poolAddress, commitmentHex, provider, chainId]);

  const {
    data: blocklistData,
    error: blocklistLoadingError,
    loading: isBlocklistLoading,
  } = getBlocklist(latestBlocklistHashForAddress);

  async function generateProof() {
    setProofStatus("pending");
    try {
      const { fullTree, exclusionTree } = await feathersClient
        .service("prover-parameters")
        .find({
          query: {
            address: listAuthorAddress,
            poolName: poolName,
            chainId: chainId,
          },
        });
      const parsedFullTree = MerkleTree.deserialize(fullTree);
      const parsedExclusionTree = MerkleTree.deserialize(exclusionTree);
      //Find first element of the parsed exclusion tree that is greater than the commitment hex:
      const greaterIndex = parsedExclusionTree.elements.findIndex((leaf) => {
        return leaf >= commitmentHex;
      });

      if (parsedExclusionTree.elements[greaterIndex] === commitmentHex) {
        alert("Commitment is blocklisted");
        setProofStatus("idle");
        setCommitmentHex("");
        setNullifierHash("");
        setNullifier("");
        setSecret("");
        return;
      }

      const greaterElement = parsedExclusionTree.elements[greaterIndex];
      const lesserIndex = greaterIndex - 1;

      const lesserElement = parsedExclusionTree.elements[lesserIndex];
      console.log(
        `Your commitment is not blocklisted and falls between ${lesserElement} (#${lesserIndex}) and ${greaterElement} (#${greaterIndex})`
      );
      const lesserPath = parsedExclusionTree.path(lesserIndex);

      const fullTreePath = parsedFullTree.path(
        parsedFullTree.indexOf(commitmentHex)
      );

      const args = {
        depositsRoot: parsedFullTree.root,
        nullifierHash: nullifierHash,
        nullifier: nullifier,
        secret: secret,
        depositPathElements: fullTreePath.pathElements,
        depositPathIndices: fullTreePath.pathIndices,
        exclusionPathElements: lesserPath.pathElements.slice(1),
        exclusionPathIndices: lesserPath.pathIndices.slice(1),
        exclusionRoot: parsedExclusionTree.root,
        lesserCommitment: lesserElement,
        greaterCommitment: greaterElement,
      };
      let start;
      if (!PRODUCTION) {
        start = performance.now();
      }
      console.log("Generating ZK-proof...");
      const proof = await groth16.fullProve(
        args,
        CIRCUIT_WASM_PATH,
        CIRCUIT_ZKEY_PATH
      );
      if (!PRODUCTION) {
        console.log(
          `Proof took ${(performance.now() - (start ?? 0)).toFixed(3)}ms`
        );
      }
      console.log("ZK-proof generated");
      console.log(proof);

      const { valid } = await feathersClient
        .service("submit-proof")
        .create(proof, { query: { poolName: poolName, chainId: chainId } });
      if (valid) {
        setProofStatus("success");
        alert("Proof submitted successfully");
      } else {
        setProofStatus("error");
        alert("Proof submission failed - proof is invalid");
      }
    } catch (err) {
      console.log("err", err);
      setProofStatus("error");
    }
  }

  //Read Editor role hash
  const {
    data: editorRoleHashData,
    isError: editorRoleHashError,
    isLoading: editorRoleHashLoading,
  } = useContractRead({
    address: `0x${blocklistRegistryAddress.slice(2)}`,
    abi: contractAbi,
    functionName: "EDITOR_ROLE",
    enabled: !!isConnected,
    onSuccess(data) {
      console.log("editorRoleHash", data);
    },
  });

  /* UI */
  return (
    <>
      <h1 style={{ textAlign: "center", padding: 10 }}>
        Sandscreener Frontend
      </h1>

      <Connect />

      {isConnected && (
        <>
          <Account />
          <NetworkSwitcher />
          <hr />
          <div>
            <form>
              <label htmlFor="listAuthor">List Author Address:</label>
              <input
                style={{ padding: 5, margin: 5 }}
                type="text"
                id="listAuthor"
                value={listAuthorAddress}
                onChange={(e) => {
                  const addr = `0x${e.target.value.slice(2)}`;
                  setListAuthorAddress(addr);
                }}
              />
              <br />
            </form>
            {latestBlocklistHashForAddress && (
              <p>Latest hash: {latestBlocklistHashForAddress}</p>
            )}
            {isBlocklistLoading && <p>Loading blocklist...</p>}
            {blocklistLoadingError && (
              <p>Error loading blocklist: {blocklistLoadingError}</p>
            )}
            {blocklistData && (
              <div>
                <Collapsible
                  lazyRender
                  trigger="Blocklist:"
                  overflowWhenOpen="visible"
                >
                  <ul>
                    {blocklistData.blocklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Collapsible>
              </div>
            )}
          </div>
          <hr />
          <div>
            <form>
              <label htmlFor="note">Note:</label>
              <input
                style={{ padding: 5, margin: 5 }}
                type={noteInputType}
                id="note"
                value={note}
                onChange={function (e) {
                  return checkAndSetNote(e.target.value);
                }}
              />
              <br />
              <button
                style={{ padding: 5, margin: 5 }}
                type="button"
                disabled={
                  proofStatus === "pending" ||
                  !listAuthorAddress ||
                  listAuthorAddressError ||
                  !commitmentHex ||
                  !isCommitmentValid ||
                  !feathersClient ||
                  !poolName ||
                  !chainId
                }
                onClick={generateProof}
              >
                {proofStatus === "pending"
                  ? "Generating proof..."
                  : "Generate proof"}
              </button>
              <br />
              {proofStatus === "success" && "Proof generated!"}
              {proofStatus === "pending" && <progress value={undefined} />}
            </form>
          </div>
          <hr />
          <div>
            <Editor chainId={chainId} editorRoleHashData={editorRoleHashData} />
            <Auditor
              chainId={chainId}
              editorRoleHashData={editorRoleHashData}
            />
          </div>
        </>
      )}
    </>
  );
}

export default Page;
