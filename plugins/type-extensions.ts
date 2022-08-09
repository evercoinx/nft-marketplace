import "hardhat/types/runtime";

interface EnvVars {
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
