// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IInstanceStateChecker.sol";
import "./interfaces/ITornadoInstanceRegistry.sol";

/**
 * Tornado Cash pool instance validity checker for mainnet.
 */
contract MainnetInstanceStateChecker is IInstanceStateChecker {
    address public immutable instanceRegsitryAddress;

    constructor(address _instanceRegsitryAddress) {
        require(
            _instanceRegsitryAddress != address(0),
            "Instance registry address cannot be zero"
        );
        instanceRegsitryAddress = _instanceRegsitryAddress;
    }

    /**
     * @dev Returns ZK-proof verification status.
     * @param tornadoPoolAddress The address of the Tornado Cash pool.
     */
    function isInstanceActive(
        address tornadoPoolAddress
    ) external view returns (bool verified) {
        (, , uint8 state, , ) = ITornadoInstanceRegistry(
            instanceRegsitryAddress
        ).instances(tornadoPoolAddress);

        return state != 0;
    }
}
