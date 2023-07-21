// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IVerifier.sol";
import "./interfaces/ITornadoPoolInstance.sol";
import "./interfaces/IInstanceStateChecker.sol";

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

/**
 * @title Sandscreener Repository
 * @dev This contract allows Editors to store blocklist references and Users to store the zero-kownledge proofs of non-inclusion into a specific blocklist.
 */
contract Repository is AccessControl {
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR_ROLE");
    // The mapping of addresses to arrays of blocklist Multihashes
    mapping(address => Multihash[]) public blocklistHashes;
    // The mapping of Editor addresses to their submitted blocklist hashes to the corresponding exclusion tree root hash
    mapping(address => mapping(bytes32 => bytes32)) public exclusionTreeRoots;
    //User proofs by Tornado pool address, blocklist hash, and root hash at the blocklist at the moment of proof submission
    mapping(address => mapping(address => mapping(bytes32 => bytes32)))
        public userProofs;

    IVerifier private immutable verifier;
    IInstanceStateChecker private immutable instanceStateChecker;

    event ExclusionRootStored(
        bytes32 indexed exclusionRootHash,
        address editorAddress,
        bytes32 blocklistHash
    );

    event ProofSubmitted(
        address indexed userAddress,
        address poolAddress,
        bytes32 blocklistHash,
        bytes32 rootHash
    );

    /**
     * @dev Constructor to grant the contract creator the default admin role.
     */
    constructor(address _verifier, address _instanceCheckerAddress) {
        verifier = IVerifier(_verifier);
        instanceStateChecker = IInstanceStateChecker(_instanceCheckerAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Add a new hash to the blocklisth hashes mapping.
     * @param digest The IPFS CID to be stored.
     * @param hashFunction The hash function used to create the CID.
     * @param size The size of the CID in bytes.
     * @param exclusionRootHash The exclusion tree root hash for the given blocklist.
     */
    function addBlocklistHash(
        bytes32 digest,
        uint8 hashFunction,
        uint8 size,
        bytes32 exclusionRootHash
    ) public onlyRole(EDITOR_ROLE) {
        require(digest != bytes32(0), "Digest cannot be a zero value");
        require(hashFunction != 0, "Hash function cannot be a zero value");
        require(size != 0, "Size cannot be a zero value");

        address addr = msg.sender;
        blocklistHashes[addr].push(Multihash(digest, hashFunction, size));

        storeExclusionRootHash(
            exclusionRootHash,
            addr,
            digest,
            hashFunction,
            size
        );
    }

    /**
     * @dev Update the exclusion tree root hash for the given blocklist.
     * @param digest The IPFS CID to be stored.
     * @param hashFunction The hash function used to create the CID.
     * @param size The size of the CID in bytes.
     * @param exclusionRootHash The new exclusion tree root hash.
     */
    function updateExclusionTreeRoot(
        bytes32 digest,
        uint8 hashFunction,
        uint8 size,
        bytes32 exclusionRootHash
    ) public onlyRole(EDITOR_ROLE) {
        require(
            exclusionRootHash != bytes32(0),
            "Exclusion tree root hash cannot be a zero value"
        );

        address addr = msg.sender;
        (
            bytes32 storedDigest,
            uint8 storedHashFunction,
            uint8 storedSize
        ) = getLatestHash(addr);

        require(
            storedDigest == digest &&
                storedHashFunction == hashFunction &&
                storedSize == size,
            "Blocklist was not previously stored"
        );

        storeExclusionRootHash(
            exclusionRootHash,
            addr,
            digest,
            hashFunction,
            size
        );
    }

    function storeExclusionRootHash(
        bytes32 exclusionRootHash,
        address editorAddress,
        bytes32 digest,
        uint8 hashFunction,
        uint8 size
    ) private {
        require(
            exclusionRootHash != bytes32(0),
            "Exclusion tree root hash cannot be a zero value"
        );

        bytes32 blocklistHash = keccak256(
            abi.encodePacked(digest, hashFunction, size)
        );
        exclusionTreeRoots[editorAddress][blocklistHash] = exclusionRootHash;

        emit ExclusionRootStored(
            exclusionRootHash,
            editorAddress,
            blocklistHash
        );
    }

    /**
     * @dev Get the latest Multihash for the given address.
     * @param editorAddress The address of the Editor.
     * @return The latest Multihash for the given address.
     */
    function getLatestHash(
        address editorAddress
    ) public view returns (bytes32, uint8, uint8) {
        // Get the array of Multihash structs for the given address
        Multihash[] memory multihashes = getAllHashes(editorAddress);
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
     * @param editorAddress The address of the Editor.
     * @return All Multihashes for the given address.
     */
    function getAllHashes(
        address editorAddress
    ) public view returns (Multihash[] memory) {
        require(
            hasRole(EDITOR_ROLE, editorAddress),
            "The address is not an Editor"
        );
        return blocklistHashes[editorAddress];
    }

    /**
     * @dev Verify a zero-knowledge proof.
     * @param a The first element of the proof.
     * @param b The second element of the proof.
     * @param c The third element of the proof.
     * @param input The input for the proof.
     * @param tornadoPoolAddress The address of the Tornado pool for which the exclusion is being proven.
     * @param editor The Editor whose blocklist was used to generate the proof.
     * @return Whether the proof is valid.
     */
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[3] memory input,
        address tornadoPoolAddress,
        address editor
    ) public returns (bool) {
        require(
            instanceStateChecker.isInstanceActive(tornadoPoolAddress),
            "The specified Tornado pool is not active"
        );
        ITornadoPoolInstance tornadoPoolInstance = ITornadoPoolInstance(
            tornadoPoolAddress
        );
        require(
            tornadoPoolInstance.isKnownRoot(bytes32(input[0])),
            "The root is not found in the specified Tornado pool"
        );
        (
            bytes32 storedDigest,
            uint8 storedHashFunction,
            uint8 storedSize
        ) = getLatestHash(editor);
        bytes32 blocklistHash = keccak256(
            abi.encodePacked(storedDigest, storedHashFunction, storedSize)
        );
        bytes32 exclusionRootHash = exclusionTreeRoots[editor][blocklistHash];
        require(
            input[1] == uint256(exclusionRootHash),
            "Invalid exclusion root hash"
        );
        bool isValid = verifier.verifyProof(a, b, c, input);
        if (isValid) {
            emit ProofSubmitted(
                msg.sender,
                tornadoPoolAddress,
                blocklistHash,
                exclusionRootHash
            );
            userProofs[msg.sender][tornadoPoolAddress][
                blocklistHash
            ] = exclusionRootHash;
        }
        return isValid;
    }
}
