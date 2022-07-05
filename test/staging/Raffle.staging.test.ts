import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { DEVELOPMENT_CHAINS, RAFFLE } from "../../constants/constants";
import { Raffle } from "../../typechain";

(DEVELOPMENT_CHAINS.includes(network.name) ? describe.skip : describe)(RAFFLE, function () {
    let raffle: Raffle;
    let deployer: string;
    let raffleEnteraceFee: BigNumber;
    const RAFFLE_ENTRANCE_FEE: BigNumber = ethers.utils.parseEther("0.01");

    beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        raffle = await ethers.getContract(RAFFLE, deployer);
        raffleEnteraceFee = await raffle.getEntraceFee();
    });

    describe("fullfillRandomWords", function () {
        it("Should work with chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
            const startingTimeStamp = await raffle.getLatestTimeStamp();

            await new Promise<void>(async (resolve, reject) => {
                raffle.once("WinnerPicked", async () => {
                    console.log("WinnerPicked event fired!");
                    try {
                        // const recentWinner = await raffle.getRecentWinner();
                        const raffleState = await raffle.getRaffleState();

                        const endingTimeStamp = await raffle.getLatestTimeStamp();

                        const finalBalance = await raffle.provider.getBalance(raffle.address);

                        const NoOfPlayers = await raffle.getNumberOfPlayers();
                        expect(NoOfPlayers.toNumber()).to.be.equal(0);
                        expect(finalBalance.toNumber()).to.be.equal(0);
                        expect(raffleState).to.be.equal(0);
                        expect(endingTimeStamp.toNumber()).to.be.greaterThan(
                            startingTimeStamp.toNumber()
                        );

                        resolve();
                    } catch (error) {
                        console.error(error);
                        reject(error);
                    }
                });
                await (await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE })).wait(1);
            });
        });
    });
});
