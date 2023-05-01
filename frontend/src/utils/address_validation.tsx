import { ethers } from 'ethers';

export function isAddressValid(address: string): React.SetStateAction<boolean> {
  //Check that the address is an Ethereum address
  return (
    address !== '0x' &&
    address.length === 42 &&
    address.slice(0, 2) === '0x' &&
    ethers.utils.isAddress(address)
  );
}
