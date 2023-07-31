// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * An instance of a Tornado Cash Classic pool.
 */
interface ITornadoPoolInstance {
    /**
     * @dev Whether or not the Merkle tree root has recently been registered in the pool.
     * @param _root The Merkle tree root.
     */
    function isKnownRoot(bytes32 _root) external view returns (bool);
}
