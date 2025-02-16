const { run } = require("hardhat");

async function verify(contractAddress, args) {
  console.log("Verifying contract. Please wait...");
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.includes("already verified")) {
      console.log("Contract already verified.");
    } else {
      console.log("Error verifying contract:", e);
    }
  }
}
module.exports = { verify };
