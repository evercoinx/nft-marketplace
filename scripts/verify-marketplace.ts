import { envVars, ethers, run } from "hardhat";

async function main() {
	if (!envVars.marketplace.address) {
		throw new Error("Marketplace address is not specified; aborted");
	}

	const listingFee = ethers.utils.parseEther(envVars.marketplace.listingFee.toString());

	await run("verify:verify", {
		address: envVars.marketplace.address,
		constructorArguments: [listingFee, envVars.marketplace.withdrawalPeriod],
	});
	console.log(`Marketplace is verified at ${envVars.marketplace.address}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
