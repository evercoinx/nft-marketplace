import * as dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

interface EnvVars {
	marketplace: {
		listingFee: number;
		withdrawalPeriod: number;
	};
	alchemy: {
		apiKey: string;
	};
	goerli: {
		privateKey: string;
	};
}

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
	throw new Error(`Environment validation error: ${error.message}`);
}

export default {
	marketplace: {
		listingFee: envVars.MARKETPLACE_LISTING_FEE,
		withdrawalPeriod: envVars.MARKETPLACE_WITHDRAWAL_PERIOD,
	},
	alchemy: {
		apiKey: envVars.ALCHEMY_API_KEY,
	},
	goerli: {
		privateKey: envVars.GOERLI_PRIVATE_KEY,
	},
} as EnvVars;
