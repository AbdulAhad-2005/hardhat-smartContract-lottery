const { getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");
!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle unit tests", function () {
    let raffle, vrfCoordinatorV2_5Mock, raffleEntranceFee, deployer, interval;
    const chainId = network.config.chainId;
    beforeEach(async () => {
      deployer = (await getNamedAccounts()).deployer;
      const signer = await ethers.getSigner(deployer);
      await deployments.fixture(["all"]);
      raffle = await ethers.getContractAt(
        "Raffle",
        (
          await deployments.get("Raffle")
        ).address,
        signer
      );
      vrfCoordinatorV2_5Mock = await ethers.getContractAt(
        "VRFCoordinatorV2_5Mock",
        (
          await deployments.get("VRFCoordinatorV2_5Mock")
        ).address,
        signer
      );

      raffleEntranceFee = await raffle.getEntranceFee();
      interval = await raffle.getInterval();

      // ✅ Add the Raffle contract as a valid consumer to the VRF subscription
      subscriptionId = await raffle.getSubscriptionId(); // Fetch subscription ID
      await vrfCoordinatorV2_5Mock.addConsumer(subscriptionId, raffle.target);
    });

    describe("constructor", function () {
      it("initializes the raffle correctly", async function () {
        const raffleState = await raffle.getRaffleState();
        const interval = await raffle.getInterval();
        assert.equal(raffleState.toString(), "0");
        assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
      });
    });

    describe("enter raffle", function () {
      it("reverts when you don't pay enough", async function () {
        await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
          raffle,
          "Raffle__NotEnougthETHEntered"
        );
      });

      it("records players when they enter the raffle", async function () {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        const playerFromContract = await raffle.getPlayer(0);
        assert.equal(playerFromContract, deployer);
      });

      it("emits an event on enter", async function () {
        await expect(
          raffle.enterRaffle({ value: raffleEntranceFee })
        ).to.emit(raffle, "RaffleEnter");
      });

      it("does't allow entrance when raffle is calculating winner", async function () {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        await network.provider.send("evm_increaseTime", [
          Number(interval) + 1,
        ]);
        await network.provider.send("evm_mine", []);
        // now we can pretend to be a chainlink upkeeper
        await raffle.performUpkeep("0x");
        await expect(
          raffle.enterRaffle({ value: raffleEntranceFee })
        ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
      });
    });

    describe("checkUpkeep", function () {
      it("return false if people haven't send any ETH", async function () {
        await network.provider.send("evm_increaseTime", [
          Number(interval) + 1,
        ]);
        await network.provider.send("evm_mine", []);
        const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
        assert(!upkeepNeeded);
      });

      it("return false if raffle isn't open", async function () {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        await network.provider.send("evm_increaseTime", [
          Number(interval) + 1,
        ]);
        await network.provider.send("evm_mine", []);
        await raffle.performUpkeep("0x");
        const raffleState = await raffle.getRaffleState();
        const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
        assert.equal(raffleState.toString(), "1");
        assert(!upkeepNeeded);
      });

      it("returns false if enough time hasn't passed", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        await network.provider.send("evm_increaseTime", [
          Number(interval) - 5,
        ]); // use a higher number here if this test fails
        await network.provider.request({ method: "evm_mine", params: [] });
        const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
        assert(!upkeepNeeded);
      });

      it("returns true if enough time has passed, has players, eth, and is open", async () => {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        await network.provider.send("evm_increaseTime", [
          Number(interval) + 1,
        ]);
        await network.provider.request({ method: "evm_mine", params: [] });
        const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
        assert(upkeepNeeded);
      });
    });

    describe("performUpkeep", function () {
      it("it can only run if checkUpkeep returns true", async function () {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        await network.provider.send("evm_increaseTime", [
          Number(interval) + 1,
        ]);
        await network.provider.send("evm_mine", []);
        const tx = await raffle.performUpkeep("0x");
        assert(tx);
      });

      it("it reverts when checkUpkeep returns false", async function () {
        await expect(
          raffle.performUpkeep("0x")
        ).to.be.revertedWithCustomError(raffle, "Raffle__UpkeepNotNeeded");
      });

      it("updates the raffle state, emit an event, and calls the vrf coordinator", async function () {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        await network.provider.send("evm_increaseTime", [
          Number(interval) + 1,
        ]);
        await network.provider.send("evm_mine", []);
        const txResponse = await raffle.performUpkeep("0x");
        const txReceipt = await txResponse.wait();
        const requestId = txReceipt.logs[1].args.requestId;
        const raffleState = await raffle.getRaffleState();
        assert(Number(requestId) > 0);
        assert(Number(raffleState) == 1);
      });
    });

    describe("fulfillRandomWords", function () {
      beforeEach(async function () {
        await raffle.enterRaffle({ value: raffleEntranceFee });
        await network.provider.send("evm_increaseTime", [
          Number(interval) + 1,
        ]);
        await network.provider.send("evm_mine", []);
      });
      it("can only be called after performUpkeep", async function () {
        await expect(
          vrfCoordinatorV2_5Mock.fulfillRandomWords(0, raffle.target)
        ).to.be.revertedWithCustomError(vrfCoordinatorV2_5Mock, "InvalidRequest");
        await expect(
          vrfCoordinatorV2_5Mock.fulfillRandomWords(1, raffle.target)
        ).to.be.revertedWithCustomError(vrfCoordinatorV2_5Mock, "InvalidRequest");
      });

      it("picks a winner, resets the lottery and sends the money", async function () {
        const additionalEntrances = 3;
        const accounts = await ethers.getSigners();
        for (
          let accountIndex = 1;
          accountIndex <= additionalEntrances;
          accountIndex++
        ) {
          const accountConnectedWithRaffle = await raffle.connect(
            accounts[accountIndex]
          );
          await accountConnectedWithRaffle.enterRaffle({
            value: raffleEntranceFee,
          });
        }
        const startingTimeStamp = await raffle.getLatestTimeStamp();
        let winnerStartingBalance;
        await new Promise(async (resolve, reject) => {
          raffle.once("RaffleWinner", async () => {
            console.log("WinnerPicked event fired");
            try {
              console.log("account 0: ", await accounts[0].address);
              console.log("account 1: ", await accounts[1].address);
              console.log("account 2: ", await accounts[2].address);
              console.log("account 3: ", await accounts[3].address);
              recentWinner = await raffle.getRecentWinner();
              console.log("recentWinner: ", recentWinner);
              const raffleState = await raffle.getRaffleState();
              const endingTimeStamp = await raffle.getLatestTimeStamp();
              const numPlayers = await raffle.getNumOfPlayers();
              const winnerEndingBalance =
                await accounts[1].provider.getBalance(recentWinner);
              assert.equal(numPlayers.toString(), "0");
              assert.equal(raffleState.toString(), "0");
              assert(endingTimeStamp > startingTimeStamp);
              assert(
                winnerEndingBalance.toString(),
                winnerStartingBalance +
                raffleEntranceFee * BigInt(additionalEntrances + 1) // ✅ Fixed multiplication
              );
              resolve();
            } catch (error) {
              console.log("error: ", error);
              reject(error);
            }
          });
          // kicking off the event by mocking the chainlink keepers and vrf coordinator
          try {
            const tx = await raffle.performUpkeep("0x");
            const txReceipt = await tx.wait(1);
            winnerStartingBalance = await accounts[1].provider.getBalance(
              accounts[1].address
            );
            await vrfCoordinatorV2_5Mock.fulfillRandomWords(
              txReceipt.logs[1].args.requestId,
              raffle.target
            );
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  });
