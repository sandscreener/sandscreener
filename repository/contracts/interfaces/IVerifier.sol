// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * ZK verifier interface.
 */
interface IVerifier {
    /**
     * @dev Returns ZK-proof verification status.
     * @param a The first element of the proof.
     * @param b The second element of the proof.
     * @param c The third element of the proof.
     * @param input The input for the proof.
     */
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[3] memory input
    ) external view returns (bool);
}
