import { HardhatUserConfig } from "hardhat/config";
import Joi from "joi";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "./plugins/env-vars";

const schema = Joi.object()
	.keys({
		ALCHEMY_API_KEY: Joi.string()
			.required()
			.length(32)
			.alphanum()
			.description("The API key of the Alchemy node provider"),
		ETHERSCAN_API_KEY: Joi.string()
			.required()
			.length(34)
			.alphanum()
			.description("The API key of the Etherscan explorer"),
		GOERLI_SENDER_MNEMONIC: Joi.string()
			.required()
			.regex(/[a-z ]{12,24}/)
			.description("The sender's mnemonic for the Goerli network"),
		GOERLI_SENDER_PASSPHRASE: Joi.string()
			.optional()
			.allow("")
			.description("The sender's passphrase for the Goerli network"),
		GOERLI_SENDER_ADDRESS: Joi.string()
			.required()
			.regex(/^0x[0-9A-Fa-f]{40}$/)
			.alphanum()
			.description("The sender's address for the Goerli network"),
	})
	.unknown();

const { value: envVars, error } = schema
	.prefs({
		errors: {
			label: "key",
		},
	})
	.validate(process.env);
if (error) {
	throw error;
}

const goerliAccounts = {
	mnemonic: envVars.GOERLI_SENDER_MNEMONIC,
	passphrase: envVars.GOERLI_SENDER_PASSPHRASE,
	initialIndex: 0,
	count: 10,
};

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
		ethereumGoerli: {
			url: `https://eth-goerli.alchemyapi.io/v2/${envVars.ALCHEMY_API_KEY}`,
			chainId: 5,
			from: envVars.GOERLI_SENDER_ADDRESS,
			accounts: goerliAccounts,
		},
		optimismGoerli: {
			url: `https://opt-goerli.g.alchemy.com/v2/${envVars.ALCHEMY_API_KEY}`,
			chainId: 420,
			from: envVars.GOERLI_SENDER_ADDRESS,
			accounts: goerliAccounts,
		},
	},
	etherscan: {
		apiKey: envVars.ETHERSCAN_API_KEY,
		customChains: [
			{
				network: "ethereumGoerli",
				chainId: 5,
				urls: {
					apiURL: "https://api-goerli.etherscan.io/api",
					browserURL: "https://goerli.etherscan.io",
				},
			},
			// TODO Verify this configuration when the Optimistic Goerli testnet is launched at the Etherscan explorer.
			// {
			// 	network: "optimismGoerli",
			// 	chainId: 420,
			// 	urls: {
			// 		apiURL: "https://api-goerli-optimistic.etherscan.io/api",
			// 		browserURL: "https://goerli-optimistic.etherscan.io",
			// 	},
			// },
		],
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
