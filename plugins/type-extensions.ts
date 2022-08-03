import "hardhat/types/runtime";

export interface EnvVars {
	marketplace: {
		listingFee: number;
		withdrawalPeriod: number;
		address: string;
	};
}

declare module "hardhat/types/runtime" {
	export interface HardhatRuntimeEnvironment {
		envVars: EnvVars;
	}
}
