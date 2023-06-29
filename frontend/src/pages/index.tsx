import "bootstrap/dist/css/bootstrap.min.css";
import { utils } from "ffjavascript";
import { useAccount, useContractRead, useProvider } from "wagmi";
import { buildMimcSponge } from "circomlibjs";
import { Account, Connect, NetworkSwitcher } from "../components";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import contractDeployments from "../contracts/deployments.json";
import contractAbis from "../contracts/contractAbi.json";
import getBlocklist from "../hooks/getBlocklist";
import Collapsible from "react-collapsible";
import tornadoPoolABI from "../contracts/tornado/TornadoCash_Eth_01.json";
import { parseNote } from "../utils/crypto.js";
import Auditor from "../components/Auditor";
import Editor from "../components/Editor";
import getCIDFromMultihash from "../hooks/getCIDFromMultihash";
import { isAddressValid } from "../utils/address_validation";
import MerkleTree from "fixed-merkle-tree";
import { ApolloQueryResult, gql } from "@apollo/client";
import CHAIN_GRAPH_URLS from "../config/subgraph";
import getApolloClient from "../hooks/getApolloClient";
import Button from "react-bootstrap/Button";
import { Form } from "react-bootstrap";
import getFeathersClient from "../hooks/getFeathersClient";
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

  const [proofInput, setProofInput] = useState<any | undefined>();
  const [isUsingGraph, setIsUsingGraph] = useState(true);
  const { address, isConnected, connector } = useAccount();
  const [chainId, setChainId] = useState<keyof typeof CHAIN_GRAPH_URLS>(5);
  const [blocklistRegistryAddress, setContractAddress] = useState(
    contractDeployments[5].address
  );

  const [proofStatus, setProofStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");
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
    chainId: chainId,
  });

  const appoloClient = getApolloClient(chainId).appoloClient;

  useEffect(() => {
    connector?.getChainId().then((chainId) => {
      if (chainId in CHAIN_GRAPH_URLS) {
        const contractDeployment = (contractDeployments as Deployments)[
          chainId
        ];
        if (contractDeployment) {
          console.log("chainId", chainId);
          setChainId(chainId as keyof typeof CHAIN_GRAPH_URLS);
          setContractAddress(contractDeployment.address);
          setContractAbi(JSON.parse((contractAbis as ABIs)[chainId]));
        } else {
          alert(
            `The contract is not deplopyed to the chain with ID ${chainId}. Please switch to another chain.`
          );
        }
      } else {
        alert(`The chain with ID ${chainId} is not supported`);
      }
    });
  }, [connector]);

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
      const parsedNote = await parseNote(note);
      if (parsedNote.currency !== "eth") {
        alert("Only ETH notes are supported");
        return;
      }
      console.log("parsedNote.netId", parsedNote.netId);
      console.log("chainId", chainId);
      if (parsedNote.netId.toString() !== chainId.toString()) {
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
          switch (chainId.toString()) {
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
          switch (chainId.toString()) {
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
          switch (chainId.toString()) {
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
          switch (chainId.toString()) {
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
      setCurrency(parsedNote.currency);
      setAmount(parsedNote.amount);
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
    fetchEvents();
  }, [poolAddress, commitmentHex, provider, chainId]);

  const {
    data: blocklistData,
    error: blocklistLoadingError,
    loading: isBlocklistLoading,
  } = getBlocklist(latestBlocklistHashForAddress);

  const poolDepositsQuery = gql`
    query Deposits(
      $limit: Int
      $offset: Int
      $amount: String
      $currency: String
    ) {
      deposits(
        orderBy: index
        first: $limit
        where: { amount: $amount, currency: $currency, index_gt: $offset }
      ) {
        from
        commitment
        index
      }
    }
  `;

  const blocklistedCommitmentsQuery = gql`
    query Deposits(
      $limit: Int
      $offset: Int
      $amount: String
      $currency: String
      $blocklist: [String!]
    ) {
      deposits(
        orderBy: commitment
        first: $limit
        where: {
          amount: $amount
          currency: $currency
          index_gt: $offset
          from_in: $blocklist
        }
      ) {
        from
        commitment
        index
      }
    }
  `;

  const feathersClient = getFeathersClient(PRODUCTION);

  async function getTrees() {
    let depositTree: MerkleTree;
    let exclusionTree: MerkleTree;

    if (isUsingGraph && appoloClient) {
      const mimcSponge = await buildMimcSponge();
      depositTree = new MerkleTree(20, [], {
        hashFunction: (left, right) =>
          mimcSponge.F.toString(
            mimcSponge.multiHash([BigInt(left), BigInt(right)])
          ),
        zeroElement:
          "21663839004416932945382355908790599225266501822907911457504978515578255421292",
      });
      exclusionTree = new MerkleTree(20, [], {
        hashFunction: (left, right) =>
          mimcSponge.F.toString(
            mimcSponge.multiHash([BigInt(left), BigInt(right)])
          ),
        zeroElement:
          "21663839004416932945382355908790599225266501822907911457504978515578255421292",
      });
      const pageSize: number = 1000;
      let returnedCount: number = 0;
      let i: number = 0;
      do {
        await appoloClient
          .query({
            query: poolDepositsQuery,
            variables: {
              limit: pageSize,
              offset: pageSize * i,
              currency: currency,
              amount: amount,
            },
          })
          .then(function (result: ApolloQueryResult<any>) {
            i++;
            returnedCount = result.data.deposits.length;
            depositTree.bulkInsert(
              result.data.deposits.map(
                (d: { commitment: string }) => d.commitment
              )
            );
            return console.log(
              `Fetched ${pageSize * i + result.data.deposits.length} deposits`
            );
          })
          .catch((err) => {
            console.log("Error fetching deposit data: ", err);
          });
      } while (returnedCount === pageSize);

      i = 0;
      var commitments: string[] = [];
      do {
        await appoloClient
          .query({
            query: blocklistedCommitmentsQuery,
            variables: {
              limit: pageSize,
              offset: pageSize * i,
              currency: "eth",
              amount: "0.1",
              blocklist: blocklistData?.blocklist,
            },
          })
          .then(function (result: ApolloQueryResult<any>) {
            i++;
            returnedCount = result.data.deposits.length;
            commitments.push(
              ...result.data.deposits.map(
                (d: { commitment: string }) => d.commitment
              )
            );
            return console.log(
              `Fetched ${
                pageSize * i + result.data.deposits.length
              } blocklisted commitments`
            );
          })
          .catch((err) => {
            console.log("Error fetching blocklisted commitment data: ", err);
          });
      } while (returnedCount === pageSize);

      console.log("blocklisted commitments", commitments);
      //TODO extract exclusion tree code into a separate module and use it in the backend code as well
      for (let j = 0; j < commitments.length - 1; j++) {
        if (j == 0) {
          exclusionTree.insert(BigInt(0).toString());
          exclusionTree.insert(commitments[0]);
        }
        exclusionTree.insert(commitments[j]);
        exclusionTree.insert(commitments[j + 1]);
      }
      console.log("exclusion tree", exclusionTree);
      exclusionTree.insert(
        exclusionTree.elements[exclusionTree.elements.length - 1]
      );
      exclusionTree.insert(
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
      );

      return { depositTree, exclusionTree };
    } else if (!isUsingGraph && feathersClient) {
      try {
        const {
          fullTree: serializedDepositTree,
          exclusionTree: serializedExclusionTree,
        } = await feathersClient.service("prover-parameters").find({
          query: {
            address: listAuthorAddress,
            poolName: poolName,
            chainId: chainId,
          },
        });
        depositTree = MerkleTree.deserialize(serializedDepositTree);
        exclusionTree = MerkleTree.deserialize(serializedExclusionTree);
        return { depositTree, exclusionTree };
      } catch (err) {
        console.log("err", err);
        setProofStatus("error");
        return { depositTree: undefined, exclusionTree: undefined };
      }
    } else {
      alert("The Graph is not ready yet. Please try again later.");
      return { depositTree: undefined, exclusionTree: undefined };
    }
  }

  async function generateProof() {
    setProofStatus("pending");

    const { depositTree, exclusionTree } = await getTrees();

    if (!depositTree || !exclusionTree) {
      return;
    }

    console.log("exclusionTree", exclusionTree.elements);

    //Find first element of the parsed exclusion tree that is greater than the commitment hex:
    const greaterIndex = exclusionTree!.elements.findIndex((leaf) => {
      return leaf >= commitmentHex;
    });

    if (exclusionTree!.elements[greaterIndex] === commitmentHex) {
      alert("Commitment is blocklisted");
      setProofStatus("idle");
      setCommitmentHex("");
      setNullifierHash("");
      setNullifier("");
      setSecret("");
      return;
    }

    const greaterElement = exclusionTree.elements[greaterIndex];
    const lesserIndex = greaterIndex - 1;

    const lesserElement = exclusionTree.elements[lesserIndex];
    console.log(
      `Your commitment is not blocklisted and falls between ${lesserElement} (#${lesserIndex}) and ${greaterElement} (#${greaterIndex})`
    );
    const lesserPath = exclusionTree.path(lesserIndex);

    const fullTreePath = depositTree.path(depositTree.indexOf(commitmentHex));

    const args = {
      depositsRoot: depositTree.root,
      nullifierHash: nullifierHash,
      nullifier: nullifier,
      secret: secret,
      depositPathElements: fullTreePath.pathElements,
      depositPathIndices: fullTreePath.pathIndices,
      exclusionPathElements: lesserPath.pathElements.slice(1),
      exclusionPathIndices: lesserPath.pathIndices.slice(1),
      exclusionRoot: exclusionTree.root,
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

    let valid = false;

    if (isUsingGraph) {
      const calldata = await groth16.exportSolidityCallData(
        utils.unstringifyBigInts(proof.proof),
        utils.unstringifyBigInts(proof.publicSignals)
      );
      const argv = calldata
        .replace(/["[\]\s]/g, "")
        .split(",")
        .map((x: any) => BigInt(x).toString());
      const a = [argv[0], argv[1]];
      const b = [
        [argv[2], argv[3]],
        [argv[4], argv[5]],
      ];
      const c = [argv[6], argv[7]];
      const inputs = argv.slice(8);
      setProofInput({ a, b, c, publicInputs: inputs });
    } else if (feathersClient) {
      let result = await feathersClient
        .service("submit-proof")
        .create(proof, { query: { poolName: poolName, chainId: chainId } });
      valid = result.valid;
      processProofResult(valid);
    } else {
      console.error("Feathers client not ready yet");
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

  const {
    data: proofVerificationResult,
    isError: proofVerificationError,
    isLoading: proofVerificationLoading,
  } = useContractRead({
    address: `0x${blocklistRegistryAddress.slice(2)}`,
    abi: contractAbi,
    args: [
      proofInput?.a,
      proofInput?.b,
      proofInput?.c,
      proofInput?.publicInputs,
    ],
    functionName: "verifyProof",
    enabled: !!isConnected && !!proofInput,
    onSuccess(data) {
      processProofResult(data);
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
              <Form.Switch
                type="switch"
                label="Use Graph"
                id="disabled-custom-switch"
                checked={isUsingGraph}
                onChange={function (e) {
                  return setIsUsingGraph(e.target.checked);
                }}
              />
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
              <Button
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
              </Button>
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

  function processProofResult(valid: any) {
    if (valid as boolean) {
      setProofStatus("success");
      alert("Proof submitted successfully");
    } else {
      setProofStatus("error");
      alert("Proof submission failed - proof is invalid");
    }
  }
}

export default Page;
