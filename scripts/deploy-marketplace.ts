import { envVars, ethers, network, upgrades } from "hardhat";

async function main() {
	let Marketplace = await ethers.getContractFactory("Marketplace");
	if (network.config.from) {
		const deployer = await ethers.getSigner(network.config.from);
		Marketplace = Marketplace.connect(deployer);
	}

	const listingFee = ethers.utils.parseEther(envVars.marketplace.listingFee.toString());
	const marketplace = await upgrades.deployProxy(Marketplace, [listingFee, envVars.marketplace.withdrawalPeriod]);

	await marketplace.deployed();
	console.log(`Marketplace is deployed to ${marketplace.address}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
