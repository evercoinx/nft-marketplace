import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Markeplace", function () {
	async function deployMarketplaceFixture() {
		const Marketplace = await ethers.getContractFactory("Marketplace");
		const marketplace = await Marketplace.deploy();

		const DummyNft = await ethers.getContractFactory("DummyNft");
		const dummyNft = await DummyNft.deploy();

		const [deployer, user, user2] = await ethers.getSigners();
		const tokenId = 0;
		const tokenPrice = ethers.utils.parseEther("0.1");

		await dummyNft.mint(user.address, "https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu");

		return {
			marketplace,
			dummyNft,
			deployer,
			user,
			user2,
			tokenId,
			tokenPrice,
		};
	}

	describe("Token listings", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from an non-owner account", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(user2.address, tokenId);

				const promise = marketplace.connect(user2).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "NotOwner");
			});

			it("Should revert with the right error if the marketplace is not an approved operator", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "NotApprovedOperator");
			});

			it("Should revert with the right error if the item has been already listed", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "AlreadyListed")
					.withArgs(dummyNft.address, tokenId);
			});

			it("Should revert with the right error if called with the price equals to zero wei", async function () {
				const { marketplace, dummyNft, user, tokenId } = await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, 0);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "PriceMustBeAboveZero");
			});

			it("Shouldn't fail if called by the token owner with the price above zero wei", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event on a token listing", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise)
					.to.emit(marketplace, "TokenListed")
					.withArgs(user.address, dummyNft.address, tokenId, tokenPrice);
			});
		});

		describe("Actions", function () {
			it("Should list the item with the right price and the seller's address", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const actual = await marketplace.getListing(dummyNft.address, tokenId);
				expect(actual).to.contain.keys("price", "seller");
				expect(actual.price).to.be.equal(tokenPrice);
				expect(actual.seller).to.be.equal(user.address);
			});
		});
	});

	describe("Token delistings", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from an non-owner account", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await dummyNft.connect(user).approve(user2.address, tokenId);

				const promise = marketplace.connect(user2).delistToken(dummyNft.address, tokenId);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "NotOwner");
			});

			it("Should revert with the right error if the item has not been listed yet", async function () {
				const { marketplace, dummyNft, user, tokenId } = await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).delistToken(dummyNft.address, tokenId);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "NotListed")
					.withArgs(dummyNft.address, tokenId);
			});
		});

		describe("Events", function () {
			it("Should emit an event on a token delisting", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).delistToken(dummyNft.address, tokenId);
				await expect(promise)
					.to.emit(marketplace, "TokenDelisted")
					.withArgs(user.address, dummyNft.address, tokenId);
			});
		});

		describe("Actions", function () {
			it("Should delist the token returing empty data regarding its previous listing", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await marketplace.connect(user).delistToken(dummyNft.address, tokenId);

				const actual = await marketplace.getListing(dummyNft.address, tokenId);
				expect(actual).to.contain.keys("price", "seller");
				expect(actual.price).to.be.equal(0);
				expect(actual.seller).to.be.equal(ethers.constants.AddressZero);
			});
		});
	});

	describe("Fallbacks", function () {
		it("Should revert without a reason if an account sends ether to the contract", async function () {
			const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

			const promise = user.sendTransaction({
				to: marketplace.address,
				value: ethers.utils.parseEther("1"),
			});

			await expect(promise).to.be.revertedWithoutReason();
		});
	});
});
