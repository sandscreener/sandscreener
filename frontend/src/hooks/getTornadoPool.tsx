import { useEffect, useState } from "react";
import { ethers } from "ethers";

/**
 * Returns the Tornado Pool contract
 * @param poolAddress - The address of the Tornado Pool contract
 * @param tornadoPoolABI - The ABI of the Tornado Pool contract
 * @param provider - The Web3 provider
 */
const getTornadoPoolContract = (
  poolAddress: string | undefined,
  tornadoPoolABI: ethers.ContractInterface | undefined,
  provider: ethers.providers.Provider | undefined
): ethers.Contract | undefined => {
  const [tornadoPoolContract, setTornadoPoolContract] = useState<
    ethers.Contract | undefined
  >();

  useEffect(() => {
    if (!poolAddress || !tornadoPoolABI || !provider) return;
    const tornadoPoolContract: ethers.Contract = new ethers.Contract(
      poolAddress,
      tornadoPoolABI,
      provider
    );
    setTornadoPoolContract(tornadoPoolContract);
  }, [poolAddress, tornadoPoolABI, provider]);

  return tornadoPoolContract;
};

export default getTornadoPoolContract;
