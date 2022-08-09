import { envVars, run } from "hardhat";

async function main() {
    if (!envVars.marketplace.address) {
        throw new Error("Marketplace's address is not specified");
    }

    await run("verify:verify", {
        address: envVars.marketplace.address,
        constructorArguments: [],
    });
    console.log(`Marketplace contract is verified at ${envVars.marketplace.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
