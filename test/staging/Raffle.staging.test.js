const { getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");
// const {
//   increaseTo,
// } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time");
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
        it("words with live Chainlink Keepers and chainlink VRF, we get a random number", async function () {
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
                await expect(getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(raffleState, 0);
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(raffleEntranceFee).toString()
                );
                assert(endingTimeStamp > startingTimeStamp);

                resolve();
              } catch (e) {
                console.log(e);
                reject(e);
              }
            });

            await raffle.enterRaffle({ value: raffleEntranceFee });
            const winnerStartingBalance = await accounts[0].provider.getBalance(
              accounts[0].address
            );
            console.log(
              "winnerStartingBalance",
              winnerStartingBalance.toString()
            );
            const upKeepNeeded = (await raffle.checkUpkeep("0x")).upkeepNeeded;
            console.log("upKeepNeeded", upKeepNeeded.toString());
          });
        });
      });
    });
