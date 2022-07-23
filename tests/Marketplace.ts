import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Markeplace", function () {
	async function deployMarketplaceFixture() {
		const Marketplace = await ethers.getContractFactory("Marketplace");
		const marketplace = await Marketplace.deploy();

		const TestItem = await ethers.getContractFactory("TestItem");
		const testItem = await TestItem.deploy();
		const [deployer, user, user2] = await ethers.getSigners();
		const tokenId = 0;
		const tokenPrice = ethers.utils.parseEther("0.1");

		await testItem.mint(user.address, "https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu");

		return {
			marketplace,
			testItem,
			deployer,
			user,
			user2,
			tokenId,
			tokenPrice,
		};
	}

	describe("Item listings", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from an non-owner account", async function () {
				const { marketplace, testItem, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await testItem.connect(user).approve(user2.address, tokenId);

				const promise = marketplace.connect(user2).listItem(testItem.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "NotOwner");
			});

			it("Should revert with the right error if the marketplace is not an approved operator", async function () {
				const { marketplace, testItem, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				const promise = marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "NotApprovedOperator");
			});

			it("Should revert with the right error if the item has been already listed", async function () {
				const { marketplace, testItem, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await testItem.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "AlreadyListed")
					.withArgs(testItem.address, tokenId);
			});

			it("Should revert with the right error if called with the price equals to zero wei", async function () {
				const { marketplace, testItem, user, tokenId } = await loadFixture(deployMarketplaceFixture);

				await testItem.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).listItem(testItem.address, tokenId, 0);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "PriceMustBeAboveZero");
			});

			it("Shouldn't fail if called by the token owner with the price above zero wei", async function () {
				const { marketplace, testItem, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await testItem.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event on an item listing", async function () {
				const { marketplace, testItem, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await testItem.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);
				await expect(promise)
					.to.emit(marketplace, "ItemListed")
					.withArgs(user.address, testItem.address, tokenId, tokenPrice);
			});
		});

		describe("Actions", function () {
			it("Should list the item with the right price and the seller's address", async function () {
				const { marketplace, testItem, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await testItem.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);

				const actual = await marketplace.getListing(testItem.address, tokenId);
				expect(actual).to.contain.keys("price", "seller");
				expect(actual.price).to.be.equal(tokenPrice);
				expect(actual.seller).to.be.equal(user.address);
			});
		});
	});

	describe("Listing cancellations", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from an non-owner account", async function () {
				const { marketplace, testItem, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await testItem.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);

				await testItem.connect(user).approve(user2.address, tokenId);

				const promise = marketplace.connect(user2).delistToken(testItem.address, tokenId);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "NotOwner");
			});

			it("Should revert with the right error if the item has not been listed yet", async function () {
				const { marketplace, testItem, user, tokenId } = await loadFixture(deployMarketplaceFixture);

				await testItem.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).delistToken(testItem.address, tokenId);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "NotListed")
					.withArgs(testItem.address, tokenId);
			});
		});

		describe("Events", function () {
			it("Should emit an event on a token delisting", async function () {
				const { marketplace, testItem, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await testItem.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).delistToken(testItem.address, tokenId);
				await expect(promise)
					.to.emit(marketplace, "TokenDelisted")
					.withArgs(user.address, testItem.address, tokenId);
			});
		});

		describe("Actions", function () {
			it("Should delist the token without returing any data regarding its previous listing", async function () {
				const { marketplace, testItem, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await testItem.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listItem(testItem.address, tokenId, tokenPrice);

				await marketplace.connect(user).delistToken(testItem.address, tokenId);

				const actual = await marketplace.getListing(testItem.address, tokenId);
				expect(actual).to.contain.keys("price", "seller");
				expect(actual.price).to.be.equal(0);
				expect(actual.seller).to.be.equal(ethers.constants.AddressZero);
			});
		});
	});
});
