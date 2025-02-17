const { getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");
developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle unit tests", function () {
      let raffle, raffleEntranceFee, deployer;
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        const signer = await ethers.getSigner(deployer);
        raffle = await ethers.getContractAt(
          "Raffle",
          (
            await deployments.get("Raffle")
          ).address,
          signer
        );

        raffleEntranceFee = await raffle.getEntranceFee();
      });

      describe("fulfillRandomWords", function () {
        it("works with live Chainlink Keepers and chainlink VRF, we get a random number", async function () {
          const startingTimeStamp = await raffle.getLatestTimeStamp();
          const accounts = await ethers.getSigners();

          await new Promise(async (resolve, reject) => {
            raffle.once("RaffleWinner", async () => {
              console.log("RaffleWinner event emitted");
              try {
                const recentWinner = await raffle.getRecentWinner();
                console.log("recentWinner", recentWinner);
                const raffleState = await raffle.getRaffleState();
                const winnerEndingBalance =
                  await accounts[0].provider.getBalance(recentWinner);
                const endingTimeStamp = await raffle.getLatestTimeStamp();
                await expect(raffle.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(raffleState, 0);
                assert.equal(
                  winnerEndingBalance.toString(),
                  (winnerStartingBalance - gasCost).toString()
                );
                assert(endingTimeStamp > startingTimeStamp);

                resolve();
              } catch (e) {
                console.log(e);
                reject(e);
              }
            });
            const winnerStartingBalance = await accounts[0].provider.getBalance(
              accounts[0].address
            );
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            const transactionReceipt = await tx.wait(1);
            const { gasUsed, gasPrice } = transactionReceipt;
            const gasCost = BigInt(gasUsed) * BigInt(gasPrice);
            // const upKeepNeeded = (await raffle.checkUpkeep("0x")).upkeepNeeded;
            // console.log("upKeepNeeded", upKeepNeeded.toString());
          });
        });
      });
    });
