import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "./plugins/configurator";

const config: HardhatUserConfig = {
	defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			chainId: 1337,
		},
		localhost: {
			url: "http://127.0.0.1:8545",
			chainId: 1337,
		},
		// goerli, mainnet, etherscan are defined in the configurator plugin
	},
	solidity: {
		version: "0.8.9",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	paths: {
		sources: "./contracts",
		tests: "./test",
		cache: "./.cache",
		artifacts: "./.artifacts",
	},
	mocha: {
		timeout: 40000,
	},
};

export default config;
