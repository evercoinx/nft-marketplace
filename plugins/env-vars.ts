import * as dotenv from "dotenv";
import Joi from "joi";
import { extendEnvironment } from "hardhat/config";
import { HardhatPluginError, lazyObject } from "hardhat/plugins";
import "./type-extensions";

dotenv.config();

const PLUGIN_NAME = "env-vars";

const schema = Joi.object()
	.keys({
		MARKETPLACE_LISTING_FEE: Joi.number()
			.required()
			.positive()
			.description("The listing fee for the marketplace (in ETH)"),
		MARKETPLACE_WITHDRAWAL_PERIOD: Joi.number()
			.required()
			.integer()
			.positive()
			.description("The withdrawal wait period for the marketplaced (in seconds)"),
		MARKETPLACE_ADDRESS: Joi.string()
			.optional()
			.allow("")
			.regex(/^0x[0-9A-Fa-f]{40}$/)
			.description("The contract address of the marketplace"),
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

extendEnvironment((hre) => {
	hre.envVars = lazyObject(() => ({
		marketplace: {
			listingFee: envVars.MARKETPLACE_LISTING_FEE,
			withdrawalPeriod: envVars.MARKETPLACE_WITHDRAWAL_PERIOD,
			address: envVars.MARKETPLACE_ADDRESS,
		},
	}));
});
