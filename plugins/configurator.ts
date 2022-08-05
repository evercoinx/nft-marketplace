import * as dotenv from "dotenv";
import "@nomiclabs/hardhat-etherscan";
import Joi from "joi";
import { extendConfig, extendEnvironment } from "hardhat/config";
import { HardhatPluginError, lazyObject } from "hardhat/plugins";
import { HardhatConfig, HardhatUserConfig, HttpNetworkConfig } from "hardhat/types";
import "./type-extensions";

dotenv.config();

const PLUGIN_NAME = "configurator";

const schema = Joi.object()
	.keys({
		MARKETPLACE_LISTING_FEE: Joi.number().required().description("Marketplace listing fee (in ETH)"),
		MARKETPLACE_WITHDRAWAL_PERIOD: Joi.number()
			.required()
			.integer()
			.description("Marketplace withdrawal wait period (in seconds)"),
		MARKETPLACE_ADDRESS: Joi.string()
			.optional()
			.allow("")
			.length(42)
			.alphanum()
			.description("Marketplace contract address"),
		ALCHEMY_API_KEY: Joi.string().required().length(32).alphanum().description("Alchemy API key"),
		ETHERSCAN_API_KEY: Joi.string().required().length(34).alphanum().description("Etherscan API Key"),
		GOERLI_SENDER_MNEMONIC: Joi.string().required().description("Sender's mnemonic for Goerli network"),
		GOERLI_SENDER_PASSPHRASE: Joi.string()
			.optional()
			.allow("")
			.description("Sender's passphrase for Goerli network"),
		GOERLI_SENDER_ADDRESS: Joi.string()
			.required()
			.length(42)
			.alphanum()
			.description("Sender's address for Goerli network"),
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
	throw new HardhatPluginError(PLUGIN_NAME, error.message);
}

//eslint-disable-next-line @typescript-eslint/no-unused-vars
extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
	const goerliAccounts = {
		mnemonic: envVars.GOERLI_SENDER_MNEMONIC,
		passphrase: envVars.GOERLI_SENDER_PASSPHRASE,
		initialIndex: 0,
		count: 10,
	};

	config.networks = {
		...config.networks,
		ethereumGoerli: {
			url: `https://eth-goerli.alchemyapi.io/v2/${envVars.ALCHEMY_API_KEY}`,
			chainId: 5,
			from: envVars.GOERLI_SENDER_ADDRESS,
			accounts: goerliAccounts,
		} as HttpNetworkConfig,
		optimismGoerli: {
			url: `https://opt-goerli.g.alchemy.com/v2/${envVars.ALCHEMY_API_KEY}`,
			chainId: 420,
			from: envVars.GOERLI_SENDER_ADDRESS,
			accounts: goerliAccounts,
		} as HttpNetworkConfig,
	};

	config.etherscan = {
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
	};
});

extendEnvironment((hre) => {
	hre.envVars = lazyObject(() => ({
		marketplace: {
			listingFee: envVars.MARKETPLACE_LISTING_FEE,
			withdrawalPeriod: envVars.MARKETPLACE_WITHDRAWAL_PERIOD,
			address: envVars.MARKETPLACE_ADDRESS,
		},
	}));
});
