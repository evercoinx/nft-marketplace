import { ethers, upgrades } from "hardhat";
import env from "../env";

async function main() {
	const listingFee = ethers.utils.parseEther(env.marketplace.listingFee.toString());
	const Marketplace = await ethers.getContractFactory("Marketplace");
	const marketplace = await upgrades.deployProxy(Marketplace, [listingFee, env.marketplace.withdrawalPeriod]);

	await marketplace.deployed();
	console.log(`Marketplace is deployed to ${marketplace.address}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
