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
		MARKETPLACE_ADDRESS: Joi.string().optional().length(40).hex().description("Marketplace contract address"),
		ALCHEMY_API_KEY: Joi.string().required().length(32).alphanum().description("Alchemy API key"),
		ETHERSCAN_API_KEY: Joi.string().required().length(34).alphanum().description("Etherscan API Key"),
		GOERLI_PRIVATE_KEY: Joi.string().required().length(64).hex().description("Private key for Goerli network"),
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

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
	if (Array.isArray(userConfig.networks)) {
		for (const name of userConfig.networks) {
			if (["goerli", "mainnet"].includes(name)) {
				throw new HardhatPluginError(PLUGIN_NAME, `Network ${name} cannot be redefined`);
			}
		}
	}

	config.networks = {
		...config.networks,
		goerli: {
			url: `https://eth-goerli.alchemyapi.io/v2/${envVars.ALCHEMY_API_KEY}`,
			accounts: [envVars.GOERLI_PRIVATE_KEY],
		} as HttpNetworkConfig,
	};

	if (typeof userConfig.etherscan !== "undefined") {
		throw new HardhatPluginError(PLUGIN_NAME, `Explorer etherscan cannot be redefined`);
	}

	config.etherscan = {
		apiKey: {
			goerli: envVars.ETHERSCAN_API_KEY,
		},
		customChains: [
			{
				network: "goerli",
				chainId: 5,
				urls: {
					apiURL: "https://api-goerli.etherscan.io/api",
					browserURL: "https://goerli.etherscan.io",
				},
			},
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
