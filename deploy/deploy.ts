import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSilentRoll = await deploy("SilentRoll", {
    from: deployer,
    log: true,
  });

  console.log(`SilentRoll contract: `, deployedSilentRoll.address);
};
export default func;
func.id = "deploy_silentroll"; // id required to prevent reexecution
func.tags = ["SilentRoll"];
