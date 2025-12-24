import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SilentRoll, SilentRoll__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SilentRoll")) as SilentRoll__factory;
  const silentRoll = (await factory.deploy()) as SilentRoll;
  const silentRollAddress = await silentRoll.getAddress();

  return { silentRoll, silentRollAddress };
}

describe("SilentRoll", function () {
  let signers: Signers;
  let silentRoll: SilentRoll;
  let silentRollAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ silentRoll, silentRollAddress } = await deployFixture());
  });

  it("requires players to join before starting a round", async function () {
    await expect(silentRoll.connect(signers.alice).startRound()).to.be.revertedWith("Join first");

    await silentRoll.connect(signers.alice).joinGame();
    await expect(silentRoll.connect(signers.alice).startRound()).to.not.be.reverted;
  });

  it("runs a round and awards points based on encrypted guess", async function () {
    await silentRoll.connect(signers.alice).joinGame();
    await silentRoll.connect(signers.alice).startRound();

    const encryptedGuess = await fhevm
      .createEncryptedInput(silentRollAddress, signers.alice.address)
      .addBool(true)
      .encrypt();

    const tx = await silentRoll
      .connect(signers.alice)
      .submitGuess(encryptedGuess.handles[0], encryptedGuess.inputProof);
    await tx.wait();

    const encryptedRollSum = await silentRoll.getLastRollSum(signers.alice.address);
    const clearRollSum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedRollSum,
      silentRollAddress,
      signers.alice,
    );

    const encryptedPoints = await silentRoll.getPoints(signers.alice.address);
    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedPoints,
      silentRollAddress,
      signers.alice,
    );

    const expectedPoints = clearRollSum >= 7 ? 10000 : 0;
    expect(clearPoints).to.eq(expectedPoints);

    const roundActive = await silentRoll.isRoundActive(signers.alice.address);
    expect(roundActive).to.eq(false);
  });
});
