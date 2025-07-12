require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.30",
  gasReporter: {
    enabled: true,
    currency: "ETH", // oder USD, ETH
    showTimeSpent: true,
  },
};