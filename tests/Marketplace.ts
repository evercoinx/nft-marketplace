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

	describe("List a token", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from an non-owner account", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(user2.address, tokenId);

				const promise = marketplace.connect(user2).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "SpenderNotAllowed")
					.withArgs(user2.address);
			});

			it("Should revert with the right error if the marketplace is not an approved operator", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "OperatorNotApproved").withArgs();
			});

			it("Should revert with the right error if the item has been already listed", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "TokenAlreadyListed")
					.withArgs(dummyNft.address, tokenId);
			});

			it("Should revert with the right error if called with the price equals to zero wei", async function () {
				const { marketplace, dummyNft, user, tokenId } = await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, 0);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "PriceNotPositive").withArgs(0);
			});

			it("Shouldn't revert if called by the right parameters", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when listing the token", async function () {
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

		describe("Post actions", function () {
			it("Should get a non-empty listing after listing the token", async function () {
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

	describe("Delist a token", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from an non-owner account", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await dummyNft.connect(user).approve(user2.address, tokenId);

				const promise = marketplace.connect(user2).delistToken(dummyNft.address, tokenId);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "SpenderNotAllowed")
					.withArgs(user2.address);
			});

			it("Should revert with the right error if the item has not been listed yet", async function () {
				const { marketplace, dummyNft, user, tokenId } = await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user).delistToken(dummyNft.address, tokenId);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "TokenNotListed")
					.withArgs(dummyNft.address, tokenId);
			});

			it("Shouldn't revert if called with the right parameters", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).delistToken(dummyNft.address, tokenId);
				await expect(promise).not.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when delisting the token", async function () {
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

		describe("Post actions", function () {
			it("Should get an empty listing after delisting the token", async function () {
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

	describe("Buy a token", function () {
		describe("Validations", function () {
			it("Should revert with the rigth error if the token has not been listed yet", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise)
					.be.revertedWithCustomError(marketplace, "TokenNotListed")
					.withArgs(dummyNft.address, tokenId);
			});

			it("Should revert with the right error if the marketplace is not an approved operator", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await dummyNft.connect(user).approve(ethers.constants.AddressZero, tokenId);

				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise).to.be.revertedWithCustomError(marketplace, "OperatorNotApproved").withArgs();
			});

			it("Should revert with the right error if called with a price lower than the one in the listing", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const value = tokenPrice.sub(1);
				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value });
				await expect(promise)
					.be.revertedWithCustomError(marketplace, "PriceNotMatched")
					.withArgs(dummyNft.address, tokenId, value);
			});

			it("Should revert with the right error if called with a price greater than the one in the listing", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const value = tokenPrice.add(1);
				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value });
				await expect(promise)
					.be.revertedWithCustomError(marketplace, "PriceNotMatched")
					.withArgs(dummyNft.address, tokenId, value);
			});

			it("Should revert with the right error if called by the token owner", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise).be.revertedWithCustomError(marketplace, "OwnerNotAllowed").withArgs(user.address);
			});

			it("Shouldn't revert if called with the right parameters", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise).not.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when buying the token", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise)
					.to.emit(marketplace, "TokenBought")
					.withArgs(user2.address, dummyNft.address, tokenId, tokenPrice);
			});
		});

		describe("Post actions", function () {
			it("Should get an empty listing after buying the token", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				const actual = await marketplace.getListing(dummyNft.address, tokenId);
				expect(actual).to.contain.keys("price", "seller");
				expect(actual.price).to.be.equal(0);
				expect(actual.seller).to.be.equal(ethers.constants.AddressZero);
			});

			it("Should get non-empty seller's proceeds after selling the token to another user", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				const actual = await marketplace.getProceeds(user.address);
				expect(actual).to.be.equal(tokenPrice);
			});

			it("Should change the token owner after buying the token", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				const actual = await dummyNft.ownerOf(tokenId);
				expect(actual).to.equal(user2.address);
			});
		});
	});

	describe("Update listing", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from an non-owner account", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const newTokenPrice = tokenPrice.mul(2);
				const promise = marketplace.connect(user2).updateListing(dummyNft.address, tokenId, newTokenPrice);

				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "SpenderNotAllowed")
					.withArgs(user2.address);
			});

			it("Should revert with the right error if the item has not been listed yet", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const newTokenPrice = tokenPrice.mul(2);
				const promise = marketplace.connect(user).updateListing(dummyNft.address, tokenId, newTokenPrice);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "TokenNotListed")
					.withArgs(dummyNft.address, tokenId);
			});

			it("Should revert with the right error if called with a zero price", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const newTokenPrice = 0;
				const promise = marketplace.connect(user).updateListing(dummyNft.address, tokenId, newTokenPrice);

				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "PriceNotPositive")
					.withArgs(newTokenPrice);
			});

			it("Shouldn't revert if called with the right parameters", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const newTokenPrice = tokenPrice.mul(2);
				const promise = marketplace.connect(user).updateListing(dummyNft.address, tokenId, newTokenPrice);
				await expect(promise).not.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when updating the listing with a new price", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const newTokenPrice = tokenPrice.mul(2);
				const promise = marketplace.connect(user).updateListing(dummyNft.address, tokenId, newTokenPrice);
				await expect(promise)
					.to.emit(marketplace, "TokenListed")
					.withArgs(user.address, dummyNft.address, tokenId, newTokenPrice);
			});

			it("Should emit an event when updating the listing with the same price", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).updateListing(dummyNft.address, tokenId, tokenPrice);
				await expect(promise)
					.to.emit(marketplace, "TokenListed")
					.withArgs(user.address, dummyNft.address, tokenId, tokenPrice);
			});
		});

		describe("Post actions", function () {
			it("Should get the listing with a new price after delisting the token", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const newTokenPrice = tokenPrice.mul(2);
				await marketplace.connect(user).updateListing(dummyNft.address, tokenId, newTokenPrice);

				const actual = await marketplace.getListing(dummyNft.address, tokenId);
				expect(actual).to.contain.keys("price", "seller");
				expect(actual.price).to.be.equal(newTokenPrice);
				expect(actual.seller).to.be.equal(user.address);
			});
		});
	});

	describe("Fallback", function () {
		it("Should revert without a reason if an account sends ether to the contract", async function () {
			const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

			const promise = user.sendTransaction({
				to: marketplace.address,
				value: ethers.utils.parseEther("1"),
			});

			await expect(promise).to.be.revertedWithoutReason();
		});

		it("Should revert without a reason if an account calls a non-existing method on the contract", async function () {
			const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

			const promise = user.sendTransaction({
				to: marketplace.address,
				data: ethers.utils.solidityKeccak256(["string"], ["foobar()"]),
			});

			await expect(promise).to.be.revertedWithoutReason();
		});

		it("Should revert without a reason if an account sends no ether and no data", async function () {
			const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

			const promise = user.sendTransaction({
				to: marketplace.address,
			});

			await expect(promise).to.be.revertedWithoutReason();
		});
	});
});
