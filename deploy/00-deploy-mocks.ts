import { ethers, network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { DEVELOPMENT_CHAINS, VRF_COORDINATOR } from "../constants/constants";

/** @dev Per request cost is 0.25 Link / Oracle gas*/
const BASE_FEE = ethers.utils.parseEther("0.25");

/**
 * @dev This is calculated value, based on gas price of the chain.
 * e.g Link per gas
 * value changes based on gas price of the chain.
 */
const GAS_PRICE_LINK = 1e9;

const deployMocks: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy, log } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();

    if (DEVELOPMENT_CHAINS.includes(network.name)) {
        log("Local network detected... Deploying mocks");
        await deploy(VRF_COORDINATOR, {
            contract: VRF_COORDINATOR,
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
            waitConfirmations: 1,
        });
        log("Mocks deployed!");
        log("--------------------------");
    }
};
deployMocks.tags = ["all", "mocks"];
export default deployMocks;
