import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SilentRoll } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  player: HardhatEthersSigner;
};

describe("SilentRollSepolia", function () {
  let signers: Signers;
  let silentRoll: SilentRoll;
  let silentRollAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const silentRollDeployment = await deployments.get("SilentRoll");
      silentRollAddress = silentRollDeployment.address;
      silentRoll = await ethers.getContractAt("SilentRoll", silentRollDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { player: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("plays a round and updates points", async function () {
    steps = 8;
    this.timeout(4 * 40000);

    progress("Ensuring player is joined...");
    const alreadyJoined = await silentRoll.isJoined(signers.player.address);
    if (!alreadyJoined) {
      let tx = await silentRoll.connect(signers.player).joinGame();
      await tx.wait();
    }

    progress("Ensuring no active round...");
    const roundActive = await silentRoll.isRoundActive(signers.player.address);
    if (roundActive) {
      const encryptedGuess = await fhevm
        .createEncryptedInput(silentRollAddress, signers.player.address)
        .addBool(true)
        .encrypt();

      let tx = await silentRoll.connect(signers.player).submitGuess(encryptedGuess.handles[0], encryptedGuess.inputProof);
      await tx.wait();
    }

    progress("Starting round...");
    let tx = await silentRoll.connect(signers.player).startRound();
    await tx.wait();

    progress("Encrypting guess...");
    const encryptedGuess = await fhevm
      .createEncryptedInput(silentRollAddress, signers.player.address)
      .addBool(true)
      .encrypt();

    progress("Submitting guess...");
    tx = await silentRoll.connect(signers.player).submitGuess(encryptedGuess.handles[0], encryptedGuess.inputProof);
    await tx.wait();

    progress("Reading encrypted roll sum...");
    const encryptedRollSum = await silentRoll.getLastRollSum(signers.player.address);

    progress("Decrypting roll sum...");
    const clearRollSum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedRollSum,
      silentRollAddress,
      signers.player,
    );

    progress("Reading encrypted points...");
    const encryptedPoints = await silentRoll.getPoints(signers.player.address);

    progress("Decrypting points...");
    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedPoints,
      silentRollAddress,
      signers.player,
    );

    const expectedPoints = clearRollSum >= 7 ? 10000 : 0;
    expect(clearPoints).to.eq(expectedPoints);
  });
});
