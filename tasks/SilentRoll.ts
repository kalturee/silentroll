import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the SilentRoll address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const silentRoll = await deployments.get("SilentRoll");
  console.log("SilentRoll address is " + silentRoll.address);
});

task("task:join", "Calls joinGame() on SilentRoll")
  .addOptionalParam("address", "Optionally specify the SilentRoll contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentRoll");
    console.log(`SilentRoll: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const silentRoll = await ethers.getContractAt("SilentRoll", deployment.address);

    const tx = await silentRoll.connect(signers[0]).joinGame();
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log("joinGame succeeded");
  });

task("task:start-round", "Calls startRound() on SilentRoll")
  .addOptionalParam("address", "Optionally specify the SilentRoll contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentRoll");
    console.log(`SilentRoll: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const silentRoll = await ethers.getContractAt("SilentRoll", deployment.address);

    const tx = await silentRoll.connect(signers[0]).startRound();
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log("startRound succeeded");
  });

task("task:submit-guess", "Calls submitGuess(true|false) on SilentRoll")
  .addOptionalParam("address", "Optionally specify the SilentRoll contract address")
  .addParam("big", "true for big, false for small")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const big = String(taskArguments.big).toLowerCase() === "true";

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentRoll");
    console.log(`SilentRoll: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const silentRoll = await ethers.getContractAt("SilentRoll", deployment.address);

    const encryptedGuess = await fhevm
      .createEncryptedInput(deployment.address, signers[0].address)
      .addBool(big)
      .encrypt();

    const tx = await silentRoll.connect(signers[0]).submitGuess(encryptedGuess.handles[0], encryptedGuess.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log("submitGuess succeeded");
  });

task("task:decrypt-points", "Decrypts points from SilentRoll")
  .addOptionalParam("address", "Optionally specify the SilentRoll contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentRoll");
    console.log(`SilentRoll: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const silentRoll = await ethers.getContractAt("SilentRoll", deployment.address);

    const encryptedPoints = await silentRoll.getPoints(signers[0].address);
    const clearPoints = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedPoints,
      deployment.address,
      signers[0],
    );

    console.log(`Encrypted points: ${encryptedPoints}`);
    console.log(`Clear points    : ${clearPoints}`);
  });

task("task:decrypt-roll", "Decrypts last roll sum from SilentRoll")
  .addOptionalParam("address", "Optionally specify the SilentRoll contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentRoll");
    console.log(`SilentRoll: ${deployment.address}`);

    const signers = await ethers.getSigners();
    const silentRoll = await ethers.getContractAt("SilentRoll", deployment.address);

    const encryptedRollSum = await silentRoll.getLastRollSum(signers[0].address);
    const clearRollSum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedRollSum,
      deployment.address,
      signers[0],
    );

    console.log(`Encrypted roll sum: ${encryptedRollSum}`);
    console.log(`Clear roll sum    : ${clearRollSum}`);
  });
