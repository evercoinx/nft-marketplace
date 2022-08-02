import { envVars, ethers, upgrades } from "hardhat";

async function main() {
	const listingFee = ethers.utils.parseEther(envVars.marketplace.listingFee.toString());
	const Marketplace = await ethers.getContractFactory("Marketplace");
	const marketplace = await upgrades.deployProxy(Marketplace, [listingFee, envVars.marketplace.withdrawalPeriod]);

	await marketplace.deployed();
	console.log(`Marketplace is deployed to ${marketplace.address}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
