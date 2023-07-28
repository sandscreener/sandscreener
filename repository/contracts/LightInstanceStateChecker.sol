// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IInstanceStateChecker.sol";
import "./interfaces/ITornadoProxy.sol";

/**
 * Tornado Cash pool instance validity checker for Goerli testnet and non-mainnet networks.
 */
contract LightInstanceStateChecker is IInstanceStateChecker {
    address public immutable tornadoProxyAddress;

    constructor(address _tornadoProxyAddress) {
        require(
            _tornadoProxyAddress != address(0),
            "Tornado proxy address cannot be zero"
        );
        tornadoProxyAddress = _tornadoProxyAddress;
    }

    /**
     * @dev Returns ZK-proof verification status.
     * @param tornadoPoolAddress The address of the Tornado Cash pool.
     */
    function isInstanceActive(
        address tornadoPoolAddress
    ) external view returns (bool verified) {
        (, , uint8 state) = ITornadoProxy(tornadoProxyAddress).instances(
            tornadoPoolAddress
        );

        return state != 0;
    }
}
