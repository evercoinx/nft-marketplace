import { envVars, ethers, network, upgrades } from "hardhat";

async function main() {
    const deployer = network.config.from
        ? await ethers.getSigner(network.config.from)
        : (await ethers.getSigners())[0];
    console.log(`Deployer's address is ${deployer.address}`);

    const Marketplace = await ethers.getContractFactory("Marketplace");
    const listingFee = ethers.utils.parseEther(envVars.marketplace.listingFee.toString());

    const marketplace = await upgrades.deployProxy(Marketplace.connect(deployer), [
        listingFee,
        envVars.marketplace.withdrawalPeriod,
    ]);

    await marketplace.deployed();
    console.log(`Marketplace proxy contract is deployed at ${marketplace.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
