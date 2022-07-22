import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Markeplace", function () {
	async function deployMarketplaceFixture() {
		const Marketplace = await ethers.getContractFactory("Marketplace");
		const marketplace = await Marketplace.deploy();

		const GameItem = await ethers.getContractFactory("GameItem");
		const gameItem = await GameItem.deploy();
		const [owner, player, player2] = await ethers.getSigners();
		const tokenId = 0;
		const tokenPrice = ethers.utils.parseEther("0.1");

		await gameItem.mint(player.address, "https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu");

		return {
			marketplace,
			gameItem,
			owner,
			player,
			player2,
			tokenId,
			tokenPrice,
		};
	}

	describe("Item listings", function () {
		describe("Validations", function () {
			it("Should revert with the right error if the marketplace is not approved to list the item", async function () {
				const { marketplace, gameItem, player, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				const promise = marketplace.connect(player).listItem(gameItem.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "NotApprovedForMarketplace");
			});

			it("Should revert with the right error if called with the price equal to zero", async function () {
				const { marketplace, gameItem, player, tokenId } = await loadFixture(deployMarketplaceFixture);

				await gameItem.connect(player).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(player).listItem(gameItem.address, tokenId, 0);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "PriceMustBeAboveZero");
			});

			it("Should revert with the right error if called from an account which is not the item owner", async function () {
				const { marketplace, gameItem, player, player2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await gameItem.connect(player).approve(player2.address, tokenId);

				const promise = marketplace.connect(player2).listItem(gameItem.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "NotOwner");
			});

			it("Should revert with the right error if the item has been already listed", async function () {
				const { marketplace, gameItem, player, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await gameItem.connect(player).approve(marketplace.address, tokenId);
				await marketplace.connect(player).listItem(gameItem.address, tokenId, tokenPrice);

				const promise = marketplace.connect(player).listItem(gameItem.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "AlreadyListed");
			});

			it("Shouldn't fail if called by the token owner with the right price", async function () {
				const { marketplace, gameItem, player, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await gameItem.connect(player).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(player).listItem(gameItem.address, tokenId, tokenPrice);
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event on item listings", async function () {
				const { marketplace, gameItem, player, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await gameItem.connect(player).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(player).listItem(gameItem.address, tokenId, tokenPrice);
				await expect(promise)
					.to.emit(marketplace, "ItemListed")
					.withArgs(player.address, gameItem.address, tokenId, tokenPrice);
			});
		});

		describe("Actions", function () {
			it("Should list the item with the right price and the seller's address", async function () {
				const { marketplace, gameItem, player, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await gameItem.connect(player).approve(marketplace.address, tokenId);
				await marketplace.connect(player).listItem(gameItem.address, tokenId, tokenPrice);

				const actual = await marketplace.getListing(gameItem.address, tokenId);
				expect(actual).to.contain.keys("price", "seller");
				expect(actual.price).to.be.equal(tokenPrice);
				expect(actual.seller).to.be.equal(player.address);
			});
		});
	});
});
