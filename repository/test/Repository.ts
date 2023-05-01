import { BigNumber } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import bs58 from 'bs58';
import { ProofStruct } from '../typechain-types/contracts/Repository.sol/Repository';
const { expect } = require('chai');

describe('Repository', function () {
  // An example list IPFS hash
  const hash = 'Qmf5fFadtidqhR6gsP2F46Hppw6h7oxEZsJdqcKLihviXN';
  async function deployRepositoryFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, editor, user, unauthorized] = await ethers.getSigners();

    const Verifier = await ethers.getContractFactory('Verifier');
    const verifier = await Verifier.deploy();

    await verifier.deployed();
    // Deploy the Repository contract
    const Repository = await ethers.getContractFactory('Repository');
    const repository = await Repository.deploy(verifier.address);
    await repository.deployed();

    return { repository, owner, editor, user, unauthorized };
  }

  it('should only allow the editor to add a hash', async function () {
    const { repository, editor, unauthorized } = await loadFixture(
      deployRepositoryFixture
    );

    // Grant the EDITOR_ROLE to the first account
    await repository.grantRole(await repository.EDITOR_ROLE(), editor.address);
    //Convert the hash to bytes
    const hashBytes = bs58.decode(hash);

    const digest = hashBytes.slice(2);
    const hashFunction = hashBytes[0];
    const size = hashBytes[1];
    // The first account should be able to add a hash
    await repository.connect(editor).addListHash(digest, hashFunction, size);

    // The second account should not be able to add a hash
    // because it does not have the EDITOR_ROLE
    await expect(
      repository.connect(unauthorized).addListHash(digest, hashFunction, size)
    ).to.be.revertedWith(
      'AccessControl: account 0x90f79bf6eb2c4f870365e785982e1f101e93b906 is missing role 0x21d1167972f621f75904fb065136bc8b53c7ba1c60ccd3a7758fbee465851e9c'
    );
  });

  it('should not be able to add a zero hash', async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    // Grant the EDITOR_ROLE to the first account
    await repository
      .connect(owner)
      .grantRole(await repository.EDITOR_ROLE(), editor.address);

    // The first account should be able to add a hash
    const hashBytes = bs58.decode(hash);
    await expect(
      repository
        .connect(editor)
        .addListHash(ethers.constants.HashZero, hashBytes[0], hashBytes[1])
    ).to.be.revertedWith('Digest cannot be zero bytes32 value');
  });

  it('should add a new hash to the list of hashes', async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    // Grant the EDITOR_ROLE to the first account
    await repository
      .connect(owner)
      .grantRole(await repository.EDITOR_ROLE(), editor.address);

    // The first account should be able to add a hash
    const hashBytes = bs58.decode(hash);
    await repository
      .connect(editor)
      .addListHash(hashBytes.slice(2), hashBytes[0], hashBytes[1]);

    // Check that the added hash can be retrieved
    const [digest, hashFunction, size] = await repository.getLatestHash(
      editor.address
    );
    //Check that the list of hashes for that account only contains one hash
    const hashes = await repository.getAllHashes(editor.address);
    expect(hashes.length).to.equal(1);

    const digestTrimmed = digest.slice(2);
    //Convert the digest string to a hex number
    var digestBytes = new Array();
    for (var n = 0; n < digestTrimmed.length; n += 2) {
      digestBytes.push(parseInt(digestTrimmed.slice(n, n + 2), 16));
    }
    const byteArray = [hashFunction, size, ...digestBytes];
    //Restore the base58 encoded hash
    const encodedHash = bs58.encode(byteArray);
    //Check that the hash is the same as the one we added
    expect(encodedHash).to.equal(hash);
  });

  it('should fail if the address is not an editor', async function () {
    const { repository } = await loadFixture(deployRepositoryFixture);

    await expect(
      repository.getLatestHash(ethers.constants.AddressZero)
    ).to.be.revertedWith('The address is not an Editor');
  });

  it('should fail if no hash is added by the editor', async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    await repository
      .connect(owner)
      .grantRole(await repository.EDITOR_ROLE(), editor.address);
    await expect(repository.getLatestHash(editor.address)).to.be.revertedWith(
      'No hashes have been stored yet for this Editor'
    );
  });

  it('should only allow signed proofs to be added', async function () {
    const { repository, owner, user, unauthorized } = await loadFixture(
      deployRepositoryFixture
    );

    // Define a proof as a Proof struct
    const proof: ProofStruct = {
      a: [BigNumber.from(1), BigNumber.from(2)],
      b: [
        [BigNumber.from(3), BigNumber.from(4)],
        [BigNumber.from(5), BigNumber.from(6)],
      ],
      c: [BigNumber.from(7), BigNumber.from(8)],
      input: [BigNumber.from(9), BigNumber.from(10), BigNumber.from(11)],
    };
    // Hash the proof to sign
    const hashedTxData = ethers.utils.defaultAbiCoder.encode(
      ['uint256[2]', 'uint256[2][2]', 'uint256[2]', 'uint256[3]'],
      [proof.a, proof.b, proof.c, proof.input]
    );
    const message = ethers.utils.solidityKeccak256(['bytes'], [hashedTxData]);
    // Sign the hash of the proof
    const signature = await owner.signMessage(ethers.utils.arrayify(message));

    // The first account should be able to add a proof
    await expect(
      await repository.hasRole(
        await repository.DEFAULT_ADMIN_ROLE(),
        owner.address
      )
    ).to.be.true;
    await repository.connect(user).addProof(proof, signature);
    //Check that the user proof can be retrieved
    const userProof = (await repository.getProofs(user.address))[0];
    expect(userProof.a).to.eql(proof.a);
    expect(userProof.b).to.eql(proof.b);
    expect(userProof.c).to.eql(proof.c);
    expect(userProof.input).to.eql(proof.input);

    // The second account should not be able to add a proof
    // because it is not signed by an admin
    // Sign the hash of the proof using another account
    const signature2 = await unauthorized.signMessage(
      ethers.utils.arrayify(message)
    );
    // Expect the transaction to be reverted because the signature is not valid
    await expect(
      repository.connect(unauthorized).addProof(proof, signature2)
    ).to.be.revertedWith('Signature mismatch');
  });
});
