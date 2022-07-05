import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { DEVELOPMENT_CHAINS, RAFFLE, VRF_COORDINATOR } from "../../constants/constants";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain";

(!DEVELOPMENT_CHAINS.includes(network.name) ? describe.skip : describe)(RAFFLE, function () {
    let raffle: Raffle;
    let deployer: string;
    const RAFFLE_ENTRANCE_FEE: BigNumber = ethers.utils.parseEther("0.01");
    let interval: BigNumber;
    let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock;
    beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        raffle = await ethers.getContract(RAFFLE, deployer);
        vrfCoordinatorV2Mock = await ethers.getContract(VRF_COORDINATOR, deployer);
        interval = await raffle.getInterval();
    });

    //--------------------------------------------------------------------------------------

    describe("constructor", function () {
        it("Should initialize Raffle state to open", async function () {
            const raffleState = await raffle.getRaffleState();

            expect(raffleState).to.be.equal(0);
            expect(interval).to.be.equal(30);
        });
    });

    //--------------------------------------------------------------------------------------

    describe("enterRaffle", function () {
        it("Should revert, with NotEnoughEthEntered Error", async function () {
            let ethAmount;
            ethAmount = ethers.utils.parseEther("0.001");
            await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughtEthEntered");
            await expect(raffle.enterRaffle({ value: ethAmount })).to.be.revertedWith(
                "Raffle__NotEnoughtEthEntered"
            );
        });
        it("Should not allow to enter when raffle is not in open state", async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);

            // Pretend to be chainlink keeper
            await raffle.performUpkeep([]);
            expect(await raffle.getRaffleState()).to.be.equal(1);
            await expect(raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE })).to.be.revertedWith(
                "Raffle__NotOpen"
            );
        });
    });

    //--------------------------------------------------------------------------------------

    describe("getPlayer", function () {
        it("Should revert with IndexOutOfBounds", async function () {
            await expect(raffle.getPlayer(0)).to.be.revertedWith("Raffle__IndexOutOfBounds");
            await expect(raffle.getPlayer(1)).to.be.revertedWith("Raffle__IndexOutOfBounds");
        });
        it("Should return player", async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            expect((await raffle.getLastPlayer()).toString()).to.equal(deployer.toString());
        });
        it("Should emit event, when player enters Raffle", async function () {
            await expect(raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE }))
                .to.emit(raffle, "RaffleEnter")
                .withArgs(deployer);
        });
    });

    //--------------------------------------------------------------------------------------

    describe("getEntranceFee", function () {
        it("Should return entranceFee", async function () {
            expect(await raffle.getEntraceFee()).to.be.equal(RAFFLE_ENTRANCE_FEE);
        });
    });

    //--------------------------------------------------------------------------------------

    describe("getNumWords", function () {
        it("Should return number of random words requested", async function () {
            expect(await raffle.getNumWords()).to.be.equal(1);
        });
    });

    //--------------------------------------------------------------------------------------

    describe("getNumberOfPlayers", function () {
        it("Should return 0, when there is no player", async function () {
            expect(await raffle.getNumberOfPlayers()).to.be.equal(0);
        });
        it("Should return correct number of players", async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            expect(await raffle.getNumberOfPlayers()).to.be.equal(1);

            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            expect(await raffle.getNumberOfPlayers()).to.be.equal(2);

            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            expect(await raffle.getNumberOfPlayers()).to.be.equal(3);
        });
    });

    //--------------------------------------------------------------------------------//

    describe("checkUpKeep", function () {
        it("Should return false if people haven't sent any ETH", async function () {
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);

            // Pretend to be chainlink keeper..
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
            expect(upkeepNeeded).to.be.false;
        });
        it("Should return false if raffle is not open", async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);

            await raffle.performUpkeep([]);

            const raffleState = await raffle.getRaffleState();
            expect(raffleState).to.be.equal(1);

            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
            expect(upkeepNeeded).to.be.false;
        });
        it("Should return false if time interval is not passed!", async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            await network.provider.send("evm_increaseTime", [0]);
            await network.provider.send("evm_mine", []);

            let upkeepNeeded0 = (await raffle.callStatic.checkUpkeep([])).upkeepNeeded;
            expect(upkeepNeeded0).to.be.false;

            await network.provider.send("evm_increaseTime", [interval.toNumber() - 3]);
            await network.provider.send("evm_mine", []);
            let upkeepNeeded1 = (await raffle.callStatic.checkUpkeep([])).upkeepNeeded;
            expect(upkeepNeeded1).to.be.false;
        });
        it("Should return true if all conditions are matched!", async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            await network.provider.send("evm_increaseTime", [interval.toNumber()]);
            await network.provider.send("evm_mine", []);
            const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
            const raffleState = await raffle.getRaffleState();
            expect(raffleState).to.be.equal(0);
            expect(upkeepNeeded).to.be.true;
        });
    });

    //----------------------------------------------------------------------------------

    describe("performUpKeep", function () {
        it("Should only run if checkupKeep returns true!", async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);

            const tx = await raffle.performUpkeep([]);
            assert(tx);
        });
        it("Should revert if checkupKeep returns false!", async function () {
            await expect(raffle.performUpkeep([])).to.be.revertedWith(`Raffle__UpKeepNotNeeded`);
        });
        it("Should update raffle state, and emit event", async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);
            const txResponse = await raffle.performUpkeep([]);
            const txReceipt = await txResponse.wait(1);
            const raffleState = await raffle.getRaffleState();

            expect(txReceipt).to.emit("Raffle", "RequestedRaffleWinner");
            const requestId: BigNumber =
                txReceipt.events === undefined
                    ? 0
                    : txReceipt.events[1].args === undefined
                    ? 0
                    : txReceipt.events[1].args.requestId;
            expect(raffleState).to.be.equal(1);
            expect(requestId.toNumber()).to.be.greaterThan(0);
        });
    });

    //--------------------------------------------------------------------------------------

    describe("fulfillRandomWords", function () {
        this.beforeEach(async function () {
            await raffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
            await network.provider.send("evm_mine", []);
        });
        it("Should revert, if there is no request id", async function () {
            await expect(
                vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
            ).to.be.revertedWith("nonexistent request");

            await expect(
                vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
            ).to.be.revertedWith("nonexistent request");
        });
        it("Should pick winner, reset lottery and send money to winner", async function () {
            const additionalEntrances = 3;
            const accounts = await ethers.getSigners();
            for (let i = 1; i <= additionalEntrances; ++i) {
                const accountsConnectedRaffle = raffle.connect(accounts[i]);
                await accountsConnectedRaffle.enterRaffle({ value: RAFFLE_ENTRANCE_FEE });
            }

            const startingTimeStamp = await raffle.getLatestTimeStamp();

            await new Promise(async (resolve, reject) => {
                raffle.once("WinnerPicked", async () => {
                    try {
                        const numberOfPlayers = await raffle.getNumberOfPlayers();
                        const raffleState = await raffle.getRaffleState();
                        const endingTimeStamp = await raffle.getLatestTimeStamp();
                        // const recentWinner = await raffle.getRecentWinner();
                        const finalBalance = await raffle.provider.getBalance(raffle.address);

                        expect(numberOfPlayers).to.be.equal(0);
                        expect(raffleState).to.be.equal(0);
                        expect(endingTimeStamp.toNumber()).to.be.greaterThan(startingTimeStamp.toNumber());
                        expect(finalBalance.toNumber()).to.be.equal(0);
                    } catch (err) {
                        reject(err);
                    }
                    resolve(0);
                });

                const tx = await raffle.performUpkeep([]);  //This should revert??
                const txReceipt = await tx.wait(1);
                const requestId: number =
                    txReceipt.events === undefined
                        ? 0
                        : txReceipt.events[1].args === undefined
                        ? 0
                        : txReceipt.events[1].args.requestId;
                await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address);


            });
        });
    });
});
