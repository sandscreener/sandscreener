import React, { useState } from "react";
import {
  useAccount,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import contractDeployments from "../contracts/deployments.json";
import contractAbis from "../contracts/contractAbi.json";
import { isAddressValid } from "../utils/address_validation";
import CHAIN_GRAPH_URLS from "../config/subgraph";
import { Button } from "react-bootstrap";

const Auditor = (props: {
  chainId: keyof typeof CHAIN_GRAPH_URLS;
  editorRoleHashData: any;
}) => {
  const contractDeployment: { address: string } | undefined = (
    contractDeployments as any
  )[props.chainId ?? "5"];
  //TODO parse safely, may not be deployed on a specific chain yet
  const repositoryAddress = contractDeployment?.address;
  const [editorAddress, _setEditorAddress] = useState("");
  const [isEditorAddressValid, setIsEditorAddressValid] = useState(false);
  const setEditorAddress = (address: string) => {
    //Check that the address is an Ethereum address
    setIsEditorAddressValid(isAddressValid(address));
    _setEditorAddress(address);
  };

  const [isPrepareEditorWriteError, setIsPrepareEditorWriteError] =
    useState(false);
  const [prepareEditorWriteError, setPrepareEditorWriteError] =
    useState<Error>();

  const contractJson: string | undefined = (contractAbis as any)[
    props.chainId ?? "5"
  ];
  //TODO parse safely, may not be deployed on a specific chain yet
  const contractAbi = JSON.parse(contractJson ?? "{}");
  const { address, isConnected } = useAccount();

  //Read Admin role hash
  const {
    data: adminRoleHashData,
    isError: adminRoleHashError,
    isLoading: adminRoleHashLoading,
  } = useContractRead({
    address: `0x${repositoryAddress?.slice(2)}`,
    abi: contractAbi,
    functionName: "DEFAULT_ADMIN_ROLE",
    enabled: !!repositoryAddress && !!isConnected,
    onSuccess(data) {
      console.log("adminRoleHash", adminRoleHashData);
    },
  });

  const {
    data: isAdmin,
    isError: isAdminError,
    isLoading: isAdminLoading,
  } = useContractRead({
    address: `0x${repositoryAddress?.slice(2)}`,
    abi: contractAbi,
    functionName: "hasRole",
    args: [adminRoleHashData, address],
    enabled: !!repositoryAddress && !!isConnected && !!adminRoleHashData,
    onSuccess(data) {
      console.log("Connected user is", data ? "Admin" : "not Admin");
      setIsPrepareEditorWriteError(false);
      setPrepareEditorWriteError(undefined);
    },
    onError(err) {
      setIsPrepareEditorWriteError(true);
      setPrepareEditorWriteError(err);
    },
  });

  const { config: grantEditorConfig } = usePrepareContractWrite({
    address: `0x${repositoryAddress?.slice(2)}`,
    abi: contractAbi,
    functionName: "grantRole",
    args: [props.editorRoleHashData, editorAddress],
    enabled:
      !!repositoryAddress &&
      !!editorAddress &&
      !!isAdmin &&
      isEditorAddressValid,
    onSuccess() {
      setIsPrepareEditorWriteError(false);
      setPrepareEditorWriteError(undefined);
    },
    onError(err) {
      setIsPrepareEditorWriteError(true);
      setPrepareEditorWriteError(err);
    },
  });
  const {
    data: grantEditorData,
    write: writeGrantEditor,
    error: grantEditorError,
    isError: isGrantEditorError,
  } = useContractWrite(grantEditorConfig);

  const { isLoading: isGrantEditorLoading, isSuccess: isGrantEditorSuccess } =
    useWaitForTransaction({
      hash: grantEditorData?.hash,
    });

  const { config: revokeEditorConfig } = usePrepareContractWrite({
    address: `0x${repositoryAddress?.slice(2)}`,
    abi: contractAbi,
    functionName: "revokeRole",
    args: [props.editorRoleHashData, editorAddress],
    enabled:
      !!repositoryAddress &&
      !!editorAddress &&
      !!isAdmin &&
      isEditorAddressValid,
    onSuccess() {
      setIsPrepareEditorWriteError(false);
      setPrepareEditorWriteError(undefined);
    },
    onError(err) {
      setIsPrepareEditorWriteError(true);
      setPrepareEditorWriteError(err);
    },
  });

  const {
    data: revokeEditorData,
    write: writeRevokeEditor,
    error: revokeEditorError,
    isError: isRevokeEditorError,
  } = useContractWrite(revokeEditorConfig);
  const { isLoading: isRevokeEditorLoading, isSuccess: isRevokeEditorSuccess } =
    useWaitForTransaction({
      hash: revokeEditorData?.hash,
    });

  return (
    <div>
      {isAdmin && (
        <div>
          You are the Auditor.
          <form>
            <label htmlFor="editorAddress">Editor Address:</label>
            <input
              style={{ padding: 5, margin: 5 }}
              type="text"
              id="editorAddress"
              value={editorAddress}
              onChange={(e) => setEditorAddress(e.target.value)}
            />
            <br />
            <Button
              style={{ padding: 5, margin: 5 }}
              type="button"
              disabled={
                !writeGrantEditor ||
                isGrantEditorLoading ||
                isRevokeEditorLoading
              }
              onClick={() => writeGrantEditor?.()}
            >
              {isGrantEditorLoading
                ? "Granting Editor Role..."
                : "Grant Editor Role"}
            </Button>
            {isGrantEditorLoading && <progress value={undefined} />}
            {isGrantEditorSuccess && (
              <div>
                Successfully granted the editor role!
                <div>
                  <a
                    href={`https://${
                      props.chainId === 5 ? "goerli." : ""
                    }etherscan.io/tx/${grantEditorData?.hash}`}
                  >
                    Etherscan
                  </a>
                </div>
              </div>
            )}
            <Button
              style={{ padding: 5, margin: 5 }}
              type="button"
              disabled={
                !writeRevokeEditor ||
                isRevokeEditorLoading ||
                isGrantEditorLoading
              }
              onClick={() => writeRevokeEditor?.()}
            >
              {isRevokeEditorLoading
                ? "Revoking Editor Role..."
                : "Revoke Editor Role"}
            </Button>
            {isRevokeEditorLoading && <progress value={undefined} />}
            {isRevokeEditorSuccess && (
              <div>
                Successfully revoked the editor role!
                <div>
                  <a
                    href={`https://${
                      props.chainId === 5 ? "goerli." : ""
                    }etherscan.io/tx/${revokeEditorData?.hash}`}
                  >
                    Etherscan
                  </a>
                </div>
              </div>
            )}
          </form>
          <hr />
        </div>
      )}
    </div>
  );
};

export default Auditor;
