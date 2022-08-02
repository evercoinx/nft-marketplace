import * as dotenv from "dotenv";
import { extendConfig, extendEnvironment } from "hardhat/config";
import { HardhatPluginError, lazyObject } from "hardhat/plugins";
import { HardhatConfig, HardhatUserConfig, HttpNetworkConfig } from "hardhat/types";
import Joi from "joi";
import "./type-extensions";

dotenv.config();

const PLUGIN_NAME = "env-vars";

const schema = Joi.object()
	.keys({
		MARKETPLACE_LISTING_FEE: Joi.number().required().description("Marketplace listing fee (in ETH)"),
		MARKETPLACE_WITHDRAWAL_PERIOD: Joi.number()
			.integer()
			.required()
			.description("Marketplace withdrawal wait period (in seconds)"),
		ALCHEMY_API_KEY: Joi.string().required().length(40).alphanum().description("Alchemy API key"),
		GOERLI_PRIVATE_KEY: Joi.string().length(64).required().alphanum().description("Private key for Goerli network"),
	})
	.unknown();

const { value: envVars, error } = schema.prefs({ errors: { label: "key" } }).validate(process.env);
if (error) {
	throw new HardhatPluginError(PLUGIN_NAME, error.message);
}

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
	if (typeof userConfig.networks?.goerli !== "undefined") {
		throw new HardhatPluginError(PLUGIN_NAME, `Goerli network cannot be redefined`);
	}

	config.networks = {
		...config.networks,
		goerli: {
			url: `https://eth-goerli.alchemyapi.io/v2/${envVars.ALCHEMY_API_KEY}`,
			accounts: [envVars.GOERLI_PRIVATE_KEY],
		} as HttpNetworkConfig,
	};
});

extendEnvironment((hre) => {
	hre.envVars = lazyObject(() => ({
		marketplace: {
			listingFee: envVars.MARKETPLACE_LISTING_FEE,
			withdrawalPeriod: envVars.MARKETPLACE_WITHDRAWAL_PERIOD,
		},
	}));
});
