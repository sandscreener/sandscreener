import "bootstrap/dist/css/bootstrap.min.css";
import { utils } from "ffjavascript";
import {
  useAccount,
  useContractRead,
  useContractWrite,
  useNetwork,
  usePrepareContractWrite,
  useProvider,
  useWaitForTransaction,
} from "wagmi";
import { buildMimcSponge } from "circomlibjs";
import { Account, Connect, NetworkSwitcher } from "../components";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import contractDeployments from "../contracts/deployments.json";
import contractAbis from "../contracts/contractAbi.json";
import useBlocklist from "../hooks/useBlocklist";
import tornadoPoolABI from "../contracts/tornado/TornadoCash_Eth_01.json";
import { parseNote } from "../utils/crypto.js";
import Auditor from "../components/Auditor";
import Editor from "../components/Editor";
import getCIDFromMultihash from "../utils/getCIDFromMultihash";
import { isAddressValid } from "../utils/addressValidation";
import MerkleTree from "fixed-merkle-tree";
import { ApolloQueryResult, gql } from "@apollo/client";
import CHAIN_GRAPH_URLS from "../config/subgraph";
import useApolloClient from "../hooks/useApolloClient";
import Button from "react-bootstrap/Button";
import { Accordion, Form } from "react-bootstrap";
import useFeathersClient from "../hooks/useFeathersClient";
import useTornadoPoolContract from "../hooks/useTornadoPool";
import getExclusionTree from "../utils/getExclusionTree";
import useProofsOfInnocense from "../hooks/useProofsOfInnocense";
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
  const { address: connectedUserAddress, isConnected } = useAccount();
  const [chainId, setChainId] = useState<
    keyof typeof CHAIN_GRAPH_URLS | undefined
  >();
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
  const [proofQueryAddress, setProofQueryAddress] = useState<string>();
  const provider = useProvider({
    chainId: chainId,
  });
  const tornadoPoolContract = useTornadoPoolContract(
    poolAddress,
    tornadoPoolABI,
    provider
  );
  const [poolName, setPoolName] = useState("");
  const [commitmentHex, setCommitmentHex] = useState("");
  const [nullifierHash, setNullifierHash] = useState("");
  const [nullifier, setNullifier] = useState("");
  const [secret, setSecret] = useState("");
  const [isCommitmentValid, setCommitmentValid] = useState(false);
  const [contractAbi, setContractAbi] = useState<{}[] | undefined>();

  const apolloClient = useApolloClient(chainId).apolloClient;

  const { chain, chains } = useNetwork();

  useEffect(() => {
    if (chain?.id && chain.id in CHAIN_GRAPH_URLS) {
      const contractDeployment = (contractDeployments as Deployments)[chain.id];
      if (contractDeployment) {
        console.log("chainId", chain.id);
        setChainId(chain.id as keyof typeof CHAIN_GRAPH_URLS);
      }
      if (contractDeployment) {
        setContractAddress(contractDeployment.address);
        setContractAbi(JSON.parse((contractAbis as ABIs)[chain.id]));
      }
    } else if (chain?.id) {
      alert(
        `The contract is not deplopyed to the ${
          chain.name
        }. Please switch to available chains: ${chains.map(
          (chain) => chain.name + ", "
        )}`
      );
    }
  }, [chain, chains]);

  useEffect(() => {
    if (!chainId) return;
    if (chainId in CHAIN_GRAPH_URLS) {
    }
  }, [chainId]);

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
    args: [listAuthorAddress],
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
    if (!chainId) return;
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
      if (
        parsedNote.netId.toString() !== chainId.toString() &&
        (parsedNote.netId.toString() !== "5" || chainId.toString() !== "31337")
      ) {
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
            case "31337":
              setPoolAddress("0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7");
              setPoolName("01ETH");
              break;
            case "1":
              setPoolAddress("0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc");
              setPoolName("01ETH");
              break;
          }
          break;
        case "1":
          switch (chainId.toString()) {
            case "5":
            case "31337":
              setPoolAddress("0x3aac1cC67c2ec5Db4eA850957b967Ba153aD6279");
              setPoolName("1ETH");
              break;
            case "1":
              setPoolAddress("0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936");
              setPoolName("1ETH");
              break;
          }
          break;
        case "10":
          switch (chainId.toString()) {
            case "5":
            case "31337":
              setPoolAddress("0x723B78e67497E85279CB204544566F4dC5d2acA0");
              setPoolName("10ETH");
              break;
            case "1":
              setPoolAddress("0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF");
              setPoolName("10ETH");
              break;
          }
          break;
        case "100":
          switch (chainId.toString()) {
            case "5":
            case "31337":
              setPoolAddress("0x0E3A09dDA6B20aFbB34aC7cD4A6881493f3E7bf7");
              setPoolName("100ETH");
              break;
            case "1":
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
    if (!commitmentHex || isCommitmentValid || !tornadoPoolContract) return;

    const filter = tornadoPoolContract.filters.Deposit(commitmentHex);
    const fetchEvents = async () => {
      const events = await tornadoPoolContract.queryFilter(filter);
      setCommitmentValid(events.length > 0);
      if (events.length <= 0) {
        alert(`Commitment not found in ${tornadoPoolContract.address}`);
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
  }, [commitmentHex, tornadoPoolContract, isCommitmentValid]);

  const connectedUserProofs = useProofsOfInnocense(
    blocklistRegistryAddress,
    contractAbi,
    provider,
    connectedUserAddress
  );

  const otherUserProofs = useProofsOfInnocense(
    blocklistRegistryAddress,
    contractAbi,
    provider,
    proofQueryAddress
  );

  const {
    data: blocklistData,
    error: blocklistLoadingError,
    loading: isBlocklistLoading,
  } = useBlocklist(latestBlocklistHashForAddress);

  const poolDepositsQuery = gql`
    query Deposits(
      $first: Int
      $index_gt: Int
      $amount: String
      $currency: String
    ) {
      deposits(
        orderBy: index
        first: $first
        where: { amount: $amount, currency: $currency, index_gt: $index_gt }
      ) {
        from
        commitment
        index
      }
    }
  `;

  const feathersClient = useFeathersClient(PRODUCTION);

  async function getTrees(blocklistedAddresses: string[]) {
    let depositTree: MerkleTree;
    let exclusionTree: MerkleTree;

    if (isUsingGraph && apolloClient) {
      const mimcSponge = await buildMimcSponge();
      depositTree = new MerkleTree(20, [], {
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
        await apolloClient
          .query({
            query: poolDepositsQuery,
            variables: {
              first: pageSize,
              index_gt: pageSize * i - 1,
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
            console.log(
              `Fetched ${
                pageSize * (i - 1) + result.data.deposits.length
              } deposits`
            );
          })
          .catch((err) => {
            console.log("Error fetching deposit data: ", err);
          });
      } while (returnedCount === pageSize);

      exclusionTree = await getExclusionTree(
        apolloClient,
        blocklistedAddresses,
        currency,
        amount
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

    if (!blocklistData?.blocklist) {
      return;
    }
    const { depositTree, exclusionTree } = await getTrees(
      blocklistData.blocklist
    );

    if (!depositTree || !exclusionTree || !tornadoPoolContract) {
      return;
    }

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

    const rootCheckPassed: boolean = await tornadoPoolContract.isKnownRoot(
      ethers.utils.hexZeroPad(
        ethers.utils.hexlify(BigInt(depositTree.root)),
        32
      )
    );

    if (!rootCheckPassed) {
      alert(
        "The Merkle root of the deposit tree is not known to the smart contract. Please try again."
      );
      setProofStatus("idle");
      return;
    }

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
  });

  const { config: verifyProofConfig } = usePrepareContractWrite({
    address: `0x${blocklistRegistryAddress.slice(2)}`,
    abi: contractAbi,
    args: [
      proofInput?.a,
      proofInput?.b,
      proofInput?.c,
      proofInput?.publicInputs,
      tornadoPoolContract?.address,
      listAuthorAddress,
    ],
    functionName: "verifyProof",
    enabled:
      !!isConnected &&
      !!proofInput &&
      !!tornadoPoolContract &&
      !!listAuthorAddress,
    onSuccess(data) {
      writeProofPrompt(data);
    },
    onError(err) {
      alert("Error submitting proof");
      console.log("proofVerificationError", err);
    },
  });

  const {
    data: proofVerificationData,
    write: verifyProof,
    reset: resetProofVerification,
  } = useContractWrite(verifyProofConfig);

  useEffect(() => {
    if (verifyProof) {
      verifyProof();
      setProofInput(undefined);
      resetProofVerification();
    }
  }, [verifyProof]);

  const {
    isLoading: isProofVerificationLoading,
    isSuccess: isProofVerificationSuccess,
    isError: isProofVerificationError,
  } = useWaitForTransaction({
    hash: proofVerificationData?.hash,
    onSuccess(data) {
      setProofStatus("success");
    },
    onError(err) {
      setProofStatus("error");
    },
    onSettled(data, error) {
      setProofStatus("idle");
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
          {chain?.unsupported && (
            <>
              <p>
                {chain?.name.replace("Chain 1", "Ethereum Mainnet")} is not
                supported
              </p>
              <p>
                Please swtch to a supproted chain:{" "}
                {chains.map((chain) => chain.name).join(", ")}
              </p>
            </>
          )}
          {!chain?.unsupported && (
            <>
              <div style={{ padding: 5, margin: 5 }}>
                Explore Blocklists
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
                {listAuthorAddress && latestBlocklistHashForAddress && (
                  <p>Latest hash: {latestBlocklistHashForAddress}</p>
                )}
                {isBlocklistLoading && <p>Loading blocklist...</p>}
                {blocklistLoadingError && (
                  <p>Error loading blocklist: {blocklistLoadingError}</p>
                )}
                {blocklistData && (
                  <div>
                    <Accordion>
                      <Accordion.Item eventKey="0">
                        <Accordion.Header>Blocklist</Accordion.Header>
                        <Accordion.Body>
                          <ul>
                            {blocklistData.blocklist.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </Accordion.Body>
                      </Accordion.Item>
                    </Accordion>
                  </div>
                )}
              </div>
              <hr />
              <div style={{ padding: 5, margin: 5 }}>
                Prove Your Innocense
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
                    style={{ paddingTop: 5, marginTop: 5 }}
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
                  {proofStatus === "success" && "Proof submitted!"}
                  {proofStatus === "pending" && <progress value={undefined} />}
                </form>
                {connectedUserProofs.length > 0 && (
                  <div style={{ paddingTop: 5, marginTop: 5 }}>
                    <Accordion>
                      <Accordion.Item eventKey="0">
                        <Accordion.Header>Your Recent Proofs</Accordion.Header>
                        <Accordion.Body>
                          <ul>
                            {connectedUserProofs.map((item) => (
                              <li
                                key={item.txHash}
                              >{`Tornado pool: ${item.poolAddress}; editor: ${item.editor}; blocklist exclusion root submitted in block ${item.blockNumber}`}</li>
                            ))}
                          </ul>
                        </Accordion.Body>
                      </Accordion.Item>
                    </Accordion>
                  </div>
                )}
                <div>
                  <hr />
                  {"Check User's Innocense"}
                  <form>
                    <label htmlFor="proofQueryAddress">User Address:</label>
                    <input
                      style={{ padding: 5, margin: 5 }}
                      type="text"
                      id="proofQueryAddress"
                      value={proofQueryAddress ?? ""}
                      onChange={(e) => {
                        const addr = `0x${e.target.value.slice(2)}`;
                        setProofQueryAddress(addr);
                      }}
                    />
                  </form>
                </div>
                {proofQueryAddress && otherUserProofs.length > 0 && (
                  <div style={{ paddingTop: 5, marginTop: 5 }}>
                    <Accordion>
                      <Accordion.Item eventKey="0">
                        <Accordion.Header>
                          {`Proofs for ${proofQueryAddress}`}
                        </Accordion.Header>
                        <Accordion.Body>
                          <ul>
                            {otherUserProofs.map((item) => (
                              <li
                                key={item.blockNumber}
                              >{`Tornado pool: ${item.poolAddress}; editor: ${item.editor}; blocklist exclusion root submitted in block ${item.blockNumber}`}</li>
                            ))}
                          </ul>
                        </Accordion.Body>
                      </Accordion.Item>
                    </Accordion>
                  </div>
                )}
              </div>
              <hr />
            </>
          )}
          <div>
            <Editor
              chainId={chainId}
              editorRoleHashData={editorRoleHashData}
              apolloClient={apolloClient}
            />
            <Auditor
              chainId={chainId}
              editorRoleHashData={editorRoleHashData}
            />
          </div>
        </>
      )}
    </>
  );

  function writeProofPrompt(valid: any) {
    if (valid as boolean) {
      alert(
        "The proof is ready to be submitted into the regsitry contract. You will now be prompted to perform the transaction by your wallet."
      );
    } else {
      setProofStatus("error");
      alert("Proof submission failed - proof is invalid");
    }
  }

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
