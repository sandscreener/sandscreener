// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * Tornado Cash pool instance validity checker.
 */
interface IInstanceStateChecker {
    /**
     * @dev Checks if Tornado Cash pool instance is active.
     * @param tornadoPoolAddress The address of the Tornado Cash pool.
     * @return active true if the pool is active, false otherwise.
     */
    function isInstanceActive(
        address tornadoPoolAddress
    ) external view returns (bool active);
}
