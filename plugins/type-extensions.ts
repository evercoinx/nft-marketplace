import "hardhat/types/runtime";

export interface EnvVars {
	marketplace: {
		listingFee: number;
		withdrawalPeriod: number;
	};
}

declare module "hardhat/types/runtime" {
	export interface HardhatRuntimeEnvironment {
		envVars: EnvVars;
	}
}
