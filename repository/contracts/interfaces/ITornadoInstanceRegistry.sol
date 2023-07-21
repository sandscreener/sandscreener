// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * Tornado Cash pool instance registry.
 */
interface ITornadoInstanceRegistry {
    /**
     * @dev Returns the deployed Tornado Cash pool parameters.
     * @param instanceAddress the address of a Tornado Cash pool instance.
     */
    function instances(
        address instanceAddress
    )
        external
        view
        returns (
            bool isERC20,
            address token,
            uint8 state,
            uint24 uniswapPoolSwappingFee,
            uint32 protocolFeePercentage
        );
}
