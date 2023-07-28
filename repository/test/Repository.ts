import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import bs58 from "bs58";
import { expect } from "chai";
import { Repository } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Repository", function () {
  // An example list IPFS hash
  const hash = "Qmf5fFadtidqhR6gsP2F46Hppw6h7oxEZsJdqcKLihviXN";
  let proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
    input: [string, string, string];
  };
  async function deployRepositoryFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, editor, user, unauthorized] = await ethers.getSigners();

    const verifier = await ethers.deployContract("Verifier");
    await verifier.deployed();

    const instanceChecker = await ethers.deployContract(
      "LightInstanceStateChecker",
      ["0x454d870a72e29d5e5697f635128d18077bd04c60"]
    );
    await instanceChecker.deployed();

    // Deploy the Repository contract
    const repository: Repository = (await ethers.deployContract("Repository", [
      verifier.address, // Tornado Proxy on Goerli
      instanceChecker.address,
    ])) as Repository;
    await repository.deployed();

    return { repository, owner, editor, user, unauthorized };
  }

  async function grantEditorRole(
    repository: Repository,
    owner: SignerWithAddress,
    editor: SignerWithAddress
  ) {
    await repository
      .connect(owner)
      .grantRole(await repository.EDITOR_ROLE(), editor.address);
  }

  async function addBlocklistHash(
    hash: string,
    repository: Repository,
    editor: SignerWithAddress,
    blocklistRoot: string
  ) {
    //Convert the hash to bytes
    const hashBytes = bs58.decode(hash);
    const digest = hashBytes.slice(2);
    const hashFunction = hashBytes[0];
    const size = hashBytes[1];
    // The first account should be able to add a hash
    return await repository
      .connect(editor)
      .addBlocklistHash(digest, hashFunction, size, blocklistRoot);
  }

  beforeEach(() => {
    proof = {
      a: [
        "8429860696870209631424410335923371474133778417543961868014142216750376449883",
        "18002447978382135461456376065845241247275353432599864436523810051974064193051",
      ],
      b: [
        [
          "4414137458164890742897542228953023567041474349592040890345933370721007000568",
          "6082776541095930848190178567203824052804497705548951852905591453694165950585",
        ],
        [
          "20364442820791155099513413662185073894300626666060241136029381806629480923624",
          "14739595751619722599286729595882941569109668246044349539647484051417975909871",
        ],
      ],
      c: [
        "12699708841618315542824208667079210105786035277201951397695990633700115095998",
        "14427890429506596743390602420010231589795510337385413558022875140471981679727",
      ],
      input: [
        "8247432752069855570268690103956196602748578499708155033818327397618176652095",
        "20739760504633648115176694042601499420637557827097160981870180480661241713026",
        "13496935901753226448709892995262485791905551549916148943385876327277619140416",
      ],
    };
  });

  it("should only allow the editor to add a hash", async function () {
    const { repository, owner, editor, unauthorized } = await loadFixture(
      deployRepositoryFixture
    );

    // Grant the EDITOR_ROLE to the first account
    await grantEditorRole(repository, owner, editor);

    const hashBytes = bs58.decode(hash);
    const digest = hashBytes.slice(2);
    const hashFunction = hashBytes[0];
    const size = hashBytes[1];

    let expectedListHash = ethers.utils.solidityKeccak256(
      ["bytes32", "uint8", "uint8"],
      [digest, hashFunction, size]
    );

    await expect(
      await addBlocklistHash(
        hash,
        repository,
        editor,
        "13496935901753226448709892995262485791905551549916148943385876327277619140416"
      )
    )
      .to.emit(repository, "ExclusionRootStored")
      .withArgs(
        ethers.BigNumber.from(
          "13496935901753226448709892995262485791905551549916148943385876327277619140416"
        ).toHexString(),
        editor.address,
        expectedListHash
      );

    // The second account should not be able to add a hash
    // because it does not have the EDITOR_ROLE
    await expect(
      addBlocklistHash(
        hash,
        repository,
        unauthorized,
        "13496935901753226448709892995262485791905551549916148943385876327277619140416"
      )
    ).to.be.revertedWith(
      "AccessControl: account 0x90f79bf6eb2c4f870365e785982e1f101e93b906 is missing role 0x21d1167972f621f75904fb065136bc8b53c7ba1c60ccd3a7758fbee465851e9c"
    );
  });

  it("should not be able to add a zero hash", async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    // Grant the EDITOR_ROLE to the first account
    await grantEditorRole(repository, owner, editor);

    // The first account should be able to add a hash
    const hashBytes = bs58.decode(hash);
    await expect(
      repository
        .connect(editor)
        .addBlocklistHash(
          ethers.constants.HashZero,
          hashBytes[0],
          hashBytes[1],
          "13496935901753226448709892995262485791905551549916148943385876327277619140416"
        )
    ).to.be.revertedWith("Digest cannot be a zero value");
    await expect(
      repository
        .connect(editor)
        .addBlocklistHash(
          hashBytes.slice(2),
          0,
          hashBytes[1],
          "13496935901753226448709892995262485791905551549916148943385876327277619140416"
        )
    ).to.be.revertedWith("Hash function cannot be a zero value");
    await expect(
      repository
        .connect(editor)
        .addBlocklistHash(
          hashBytes.slice(2),
          hashBytes[0],
          0,
          "13496935901753226448709892995262485791905551549916148943385876327277619140416"
        )
    ).to.be.revertedWith("Size cannot be a zero value");
    await expect(
      repository
        .connect(editor)
        .addBlocklistHash(
          hashBytes.slice(2),
          hashBytes[0],
          hashBytes[1],
          ethers.constants.HashZero
        )
    ).to.be.revertedWith("Exclusion tree root cannot be a zero value");
  });

  it("should add a new hash to the list of hashes", async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    // Grant the EDITOR_ROLE to the first account
    await grantEditorRole(repository, owner, editor);

    await addBlocklistHash(
      hash,
      repository,
      editor,
      "13496935901753226448709892995262485791905551549916148943385876327277619140416"
    );

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

  it("should be able to update the exclusion tree root", async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    // Grant the EDITOR_ROLE to the first account
    await grantEditorRole(repository, owner, editor);
    await addBlocklistHash(
      hash,
      repository,
      editor,
      "13496935901753226448709892995262485791905551549916148943385876327277619140416"
    );

    const hashBytes = bs58.decode(hash);
    const digest1 = hashBytes.slice(2);
    const hashFunction2 = hashBytes[0];
    const size3 = hashBytes[1];
    // The first account should be able to add a hash
    await repository
      .connect(editor)
      .updateExclusionTreeRoot(
        digest1,
        hashFunction2,
        size3,
        "13496935901753226448709892995262485791905551549916148943385876327277619140415"
      );

    // Check that the added hash can be retrieved
    const [returnedDigest, returnedHashFunction, returnedSize] =
      await repository.getLatestHash(editor.address);
    //Check that the list of hashes for that account only contains one hash
    const hashes = await repository.getAllHashes(editor.address);
    expect(hashes.length).to.equal(1);

    const digestTrimmed = returnedDigest.slice(2);
    //Convert the digest string to a hex number
    var digestBytes = new Array();
    for (var n = 0; n < digestTrimmed.length; n += 2) {
      digestBytes.push(parseInt(digestTrimmed.slice(n, n + 2), 16));
    }
    const byteArray = [returnedHashFunction, returnedSize, ...digestBytes];
    //Restore the base58 encoded hash
    const encodedHash = bs58.encode(byteArray);
    //Check that the hash is the same as the one we added
    expect(encodedHash).to.equal(hash);
  });

  it("should not be able to update the exclusion tree root with zero value", async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    // Grant the EDITOR_ROLE to the first account
    await grantEditorRole(repository, owner, editor);
    await addBlocklistHash(
      hash,
      repository,
      editor,
      "13496935901753226448709892995262485791905551549916148943385876327277619140416"
    );

    const hashBytes = bs58.decode(hash);
    const digest1 = hashBytes.slice(2);
    const hashFunction2 = hashBytes[0];
    const size3 = hashBytes[1];
    // The first account should be able to add a hash
    await expect(
      repository
        .connect(editor)
        .updateExclusionTreeRoot(
          digest1,
          hashFunction2,
          size3,
          ethers.constants.HashZero
        )
    ).to.be.revertedWith("Exclusion tree root cannot be a zero value");
  });

  it("should not be able to update the exclusion tree root for a wrong blocklist", async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    // Grant the EDITOR_ROLE to the first account
    await grantEditorRole(repository, owner, editor);
    await addBlocklistHash(
      "Qmf5fFadtidqhR6gsP2F46Hppw6h7oxEZsJdqcKLihviXa",
      repository,
      editor,
      "13496935901753226448709892995262485791905551549916148943385876327277619140416"
    );

    const hashBytes = bs58.decode(hash);
    const digest1 = hashBytes.slice(2);
    const hashFunction2 = hashBytes[0];
    const size3 = hashBytes[1];
    // The first account should be able to add a hash
    await expect(
      repository
        .connect(editor)
        .updateExclusionTreeRoot(
          digest1,
          hashFunction2,
          size3,
          "13496935901753226448709892995262485791905551549916148943385876327277619140415"
        )
    ).to.be.revertedWith("Blocklist was not previously stored");
  });

  it("should not be able to update an exclusion tree root for unsubmitted blocklist", async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    // Grant the EDITOR_ROLE to the first account
    await grantEditorRole(repository, owner, editor);

    const hashBytes = bs58.decode(hash);
    const digest1 = hashBytes.slice(2);
    const hashFunction2 = hashBytes[0];
    const size3 = hashBytes[1];
    // The first account should be able to add a hash
    await expect(
      repository
        .connect(editor)
        .updateExclusionTreeRoot(
          digest1,
          hashFunction2,
          size3,
          "13496935901753226448709892995262485791905551549916148943385876327277619140415"
        )
    ).to.be.revertedWith("No hashes have been stored yet for this Editor");
  });

  it("non-editor should not be able to call the exclusion tree root update", async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );

    const hashBytes = bs58.decode(hash);
    const digest1 = hashBytes.slice(2);
    const hashFunction2 = hashBytes[0];
    const size3 = hashBytes[1];
    // The first account should be able to add a hash
    await expect(
      repository
        .connect(editor)
        .updateExclusionTreeRoot(
          digest1,
          hashFunction2,
          size3,
          "13496935901753226448709892995262485791905551549916148943385876327277619140415"
        )
    ).to.be.revertedWith(
      "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x21d1167972f621f75904fb065136bc8b53c7ba1c60ccd3a7758fbee465851e9c"
    );
  });

  it("should fail if the address is not an editor", async function () {
    const { repository } = await loadFixture(deployRepositoryFixture);

    await expect(
      repository.getLatestHash(ethers.constants.AddressZero)
    ).to.be.revertedWith("The address is not an Editor");
  });

  it("should fail if no hash is added by the editor", async function () {
    const { repository, owner, editor } = await loadFixture(
      deployRepositoryFixture
    );
    await grantEditorRole(repository, owner, editor);
    await expect(repository.getLatestHash(editor.address)).to.be.revertedWith(
      "No hashes have been stored yet for this Editor"
    );
  });

  it("should verify the valid proof", async function () {
    const { repository, owner, user, editor } = await loadFixture(
      deployRepositoryFixture
    );

    await grantEditorRole(repository, owner, editor);
    await addBlocklistHash(
      hash,
      repository,
      editor,
      "13496935901753226448709892995262485791905551549916148943385876327277619140416"
    );

    const hashBytes = bs58.decode(hash);
    const digest = hashBytes.slice(2);
    const hashFunction = hashBytes[0];
    const size = hashBytes[1];

    let expectedListHash = ethers.utils.solidityKeccak256(
      ["bytes32", "uint8", "uint8"],
      [digest, hashFunction, size]
    );

    await expect(
      await repository
        .connect(user)
        .verifyProof(
          proof.a,
          proof.b,
          proof.c,
          proof.input,
          "0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7",
          editor.address
        )
    )
      .to.emit(repository, "ProofSubmitted")
      .withArgs(
        user.address,
        "0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7",
        expectedListHash,
        ethers.BigNumber.from(
          "13496935901753226448709892995262485791905551549916148943385876327277619140416"
        ).toHexString()
      );
  });

  it("should not store a valid proof with a wrong blocklist root", async function () {
    const { repository, owner, user, editor } = await loadFixture(
      deployRepositoryFixture
    );

    await grantEditorRole(repository, owner, editor);
    await addBlocklistHash(
      hash,
      repository,
      editor,
      //Change one last digit to differ from the expected blocklist root value
      "13496935901753226448709892995262485791905551549916148943385876327277619140415"
    );

    await expect(
      repository
        .connect(user)
        .verifyProof(
          proof.a,
          proof.b,
          proof.c,
          proof.input,
          "0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7",
          editor.address
        )
    ).to.be.revertedWith("Invalid exclusion tree root");
  });

  it("should fail the verification if the Merkle tree root is not found in a specified Tornado pool", async function () {
    const { repository, user, editor } = await loadFixture(
      deployRepositoryFixture
    );

    //Modify one last digit of the root
    proof.input[0] =
      "8247432752069855570268690103956196602748578499708155033818327397618176652094";
    await expect(
      repository
        .connect(user)
        .verifyProof(
          proof.a,
          proof.b,
          proof.c,
          proof.input,
          "0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7",
          editor.address
        )
    ).to.be.revertedWith("The root is not found in the specified Tornado pool");
  });

  it("should fail the verification if the proof inputs are incorrect", async function () {
    const { repository, owner, user, editor } = await loadFixture(
      deployRepositoryFixture
    );

    await grantEditorRole(repository, owner, editor);
    await addBlocklistHash(
      hash,
      repository,
      editor,
      "13496935901753226448709892995262485791905551549916148943385876327277619140416"
    );
    //Modify one last digit of one of the inputs
    proof.a[0] =
      "8429860696870209631424410335923371474133778417543961868014142216750376449882";
    await expect(
      repository
        .connect(user)
        .verifyProof(
          proof.a,
          proof.b,
          proof.c,
          proof.input,
          "0x6Bf694a291DF3FeC1f7e69701E3ab6c592435Ae7",
          editor.address
        )
    ).to.be.revertedWithoutReason();
  });
});
