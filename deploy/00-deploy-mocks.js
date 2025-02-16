const { developmentChains } = require("../helper-hardhat-config");

const { network, ethers } = require("hardhat");

const BASE_FEE = ethers.parseEther("0.25");
const GAS_PRICE_LINK = 1e9;
const WEI_PER_UNIT_LINK = 4e15 // // LINK / ETH price

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const args = [BASE_FEE, GAS_PRICE_LINK, WEI_PER_UNIT_LINK];

  if (developmentChains.includes(network.name)) {
    await deploy("VRFCoordinatorV2_5Mock", {
      from: deployer,
      args: args,
      log: true,
      waitConfirmations: network.config.blockConfirmations || 1,
    });
    log("Mocks deployed");
    log("---------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
