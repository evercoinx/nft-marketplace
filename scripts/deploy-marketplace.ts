import { ethers, upgrades } from "hardhat";

async function main() {
	const listingFee = ethers.utils.parseEther("0.001");
	const withdrawalPeriod = 3 * 24 * 60 * 60; // 3 days
	const Marketplace = await ethers.getContractFactory("Marketplace");
	const marketplace = await upgrades.deployProxy(Marketplace, [listingFee, withdrawalPeriod]);

	await marketplace.deployed();
	console.log(`Marketplace is deployed to ${marketplace.address}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
