// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ITornadoPoolInstance.sol";

/**
 * @dev Struct to store metadata about an IPFS CID.
 */
struct Multihash {
    /**
     * @dev The IPFS CID.
     */
    bytes32 digest;
    /**
     * @dev The hash function used to create the CID.
     */
    uint8 hashFunction;
    /**
     * @dev The size of the CID in bytes.
     */
    uint8 size;
}

/**
 * @dev Struct to store a zero-knowledge proof.
 */
struct Proof {
    /**
     * @dev The first element of the proof.
     */
    uint256[2] a;
    /**
     * @dev The second element of the proof.
     */
    uint256[2][2] b;
    /**
     * @dev The third element of the proof.
     */
    uint256[2] c;
    /**
     * @dev The input for the proof.
     */
    uint256[3] input;
}

interface IVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[3] memory input
    ) external view returns (bool);
}

/**
 * @title Sandscreener Repository
 * @dev This contract allows Editors to store blocklist references and Users to store the zero-kownledge proofs of non-inclusion into a specific blocklist.
 */
contract Repository is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR_ROLE");
    // Define the mapping of addresses to arrays of Multihash structs
    mapping(address => Multihash[]) public listHashes;
    mapping(address => Proof[]) _proofs;

    IVerifier private verifier;

    /**
     * @dev Constructor to grant the contract creator the default admin role.
     */
    constructor(address _verifier) {
        verifier = IVerifier(_verifier);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Add a new hash to the listHashes mapping.
     * @param _digest The IPFS CID to be stored.
     * @param _hashFunction The hash function used to create the CID.
     * @param _size The size of the CID in bytes.
     */
    function addListHash(
        bytes32 _digest,
        uint8 _hashFunction,
        uint8 _size
    ) public onlyRole(EDITOR_ROLE) {
        // Assert that the _digest parameter is not the zero bytes32 value
        require(_digest != bytes32(0), "Digest cannot be zero bytes32 value");

        address addr = msg.sender;
        listHashes[addr].push(Multihash(_digest, _hashFunction, _size));
    }

    /**
     * @dev Get the latest Multihash for the given address.
     * @param _address The address of the Editor.
     * @return The latest Multihash for the given address.
     */
    function getLatestHash(
        address _address
    ) public view returns (bytes32, uint8, uint8) {
        // Get the array of Multihash structs for the given address
        Multihash[] memory multihashes = getAllHashes(_address);
        require(
            multihashes.length > 0,
            "No hashes have been stored yet for this Editor"
        );
        // Return the last element in the array (the latest Multihash)
        return (
            multihashes[multihashes.length - 1].digest,
            multihashes[multihashes.length - 1].hashFunction,
            multihashes[multihashes.length - 1].size
        );
    }

    /**
     * @dev Get all Multihashes for the given address.
     * @param _address The address of the Editor.
     * @return All Multihashes for the given address.
     */
    function getAllHashes(
        address _address
    ) public view returns (Multihash[] memory) {
        require(hasRole(EDITOR_ROLE, _address), "The address is not an Editor");
        return listHashes[_address];
    }

    /**
     * @dev Store User's proof.
     * @param _proof The proof to be stored.
     * @param _signature The signature of the proof, signed by an Admin.
     */
    function addProof(Proof memory _proof, bytes memory _signature) public {
        bytes32 hash = hashProof(_proof);
        require(signedByAdmin(hash, _signature), "Signature mismatch");
        require(
            verifier.verifyProof(_proof.a, _proof.b, _proof.c, _proof.input),
            "Proof verification failed"
        );
        _proofs[msg.sender].push(_proof);
    }

    /**
     * @dev Get all proofs for the given User address.
     * @param account The address to retrieve the proofs for.
     * @return All proofs for the given address.
     */
    function getProofs(address account) public view returns (Proof[] memory) {
        return _proofs[account];
    }

    /**
     * @dev Hash a proof.
     * @param _proof The proof to be hashed.
     * @return The hash of the proof.
     */
    function hashProof(Proof memory _proof) public pure returns (bytes32) {
        bytes32 _hash = keccak256(
            abi.encode(_proof.a, _proof.b, _proof.c, _proof.input)
        );
        return _hash.toEthSignedMessageHash();
    }

    /**
     * @dev Check if the given signature is signed by an Admin.
     * @param _payload The hash of the data to be verified.
     * @param _signature The signature to be verified.
     * @return Whether the signature is valid.
     */
    function signedByAdmin(
        bytes32 _payload,
        bytes memory _signature
    ) public view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, _payload.recover(_signature));
    }

    /**
     * @dev Verify a zero-knowledge proof.
     * @param a The first element of the proof.
     * @param b The second element of the proof.
     * @param c The third element of the proof.
     * @param input The input for the proof.
     * @param tornadoPoolInstance The address of the Tornado pool for which the exclusion is being proven.
     * @return Whether the proof is valid.
     */
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[3] memory input,
        ITornadoPoolInstance tornadoPoolInstance
    ) public view returns (bool) {
        require(
            tornadoPoolInstance.isKnownRoot(bytes32(input[0])),
            "The root is not found in the specified Tornado pool"
        );
        return verifier.verifyProof(a, b, c, input);
    }
}
