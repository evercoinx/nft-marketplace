import { envVars, run } from "hardhat";

async function main() {
	if (!envVars.marketplace.address) {
		throw new Error("Marketplace address is not specified");
	}

	await run("verify:verify", {
		address: envVars.marketplace.address,
		constructorArguments: [],
	});
	console.log(`Marketplace is verified at ${envVars.marketplace.address}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
