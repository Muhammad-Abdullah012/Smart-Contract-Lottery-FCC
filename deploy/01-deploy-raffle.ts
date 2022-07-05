import { ethers, network } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { DEVELOPMENT_CHAINS, RAFFLE, VRF_COORDINATOR } from "../constants/constants";
import { networkConfig } from "../helper-hardhat-config";

import { VRFCoordinatorV2Mock } from "../typechain/VRFCoordinatorV2Mock";

import { verify } from "../utils/verify";
const VRF_MOCK_SUB_FUND_AMOUNT = ethers.utils.parseEther("5");
const deployRaffle: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deploy, log } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();

    const chainId: number = network.config.chainId ?? 0;
    const fee = networkConfig[chainId].entranceFee;
    const gasLane = networkConfig[chainId].gasLane;
    const callbackGasLimit = networkConfig[chainId].callbackGasLimit;
    const interval = networkConfig[chainId].interval;

    let vrfCoordinatorV2Address: string, subscriptionId: string;
    let wait: boolean;
    if (DEVELOPMENT_CHAINS.includes(network.name)) {
        wait = false;
        const vrfCoordinatorV2Mock: VRFCoordinatorV2Mock = await ethers.getContract(
            VRF_COORDINATOR
        );
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        subscriptionId =
            transactionReceipt.events !== undefined &&
            transactionReceipt.events[0].args !== undefined
                ? transactionReceipt.events[0].args.subId.toString()
                : "0";
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_MOCK_SUB_FUND_AMOUNT);
    } else {
        wait = true;
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2 ?? "";
        subscriptionId = networkConfig[chainId].subscriptionId ?? "";
    }
    const args = [
        vrfCoordinatorV2Address,
        fee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    log("Deploying Raffle...");
    const raffle = await deploy(RAFFLE, {
        contract: RAFFLE,
        from: deployer,
        args, //constructor arguments..
        log: true,
        waitConfirmations: wait ? 6 : undefined,
    });
    log("Deployed successfully!!!");
    if (
        !DEVELOPMENT_CHAINS.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
      ) {
        await verify(raffle.address, args);
      }
    log("---------------------------");
};
deployRaffle.tags = ["all", "deployRaffle"];
export default deployRaffle;
