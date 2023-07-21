// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * Tornado Cash pool instance registry.
 */
interface ITornadoProxy {
    /**
     * @dev Returns the deployed Tornado Cash pool parameters.
     * @param instanceAddress the address of a Tornado Cash pool instance.
     */
    function instances(
        address instanceAddress
    ) external view returns (bool isERC20, address token, uint8 state);
}
