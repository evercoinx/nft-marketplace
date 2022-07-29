import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Markeplace", function () {
	async function deployMarketplaceFixture() {
		const [deployer, user, user2] = await ethers.getSigners();

		const DummyNft = await ethers.getContractFactory("DummyNft");
		const dummyNft = await DummyNft.deploy();
		await dummyNft.mint(user.address, "https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu");

		const DummyFt = await ethers.getContractFactory("DummyFt");
		const dummyFt = await DummyFt.deploy(1_000_000);

		const withdrawalWaitPeriod = 2 * 24 * 60 * 60; // 2 days
		const Marketplace = await ethers.getContractFactory("Marketplace");
		const marketplace = await upgrades.deployProxy(Marketplace, [withdrawalWaitPeriod]);

		return {
			marketplace,
			dummyNft,
			dummyFt,
			deployer,
			user,
			user2,
			withdrawalWaitPeriod,
			tokenId: 0,
			tokenPrice: ethers.utils.parseEther("0.1"),
		};
	}

	describe("Deploy the contract", function () {
		it("Should return the right owner", async function () {
			const { marketplace, deployer } = await loadFixture(deployMarketplaceFixture);

			const actual = await marketplace.owner();
			expect(actual).to.be.equal(deployer.address);
		});

		it("Should return the right pausable state", async function () {
			const { marketplace } = await loadFixture(deployMarketplaceFixture);

			const actual = await marketplace.paused();
			expect(actual).to.be.false;
		});

		it("Should return the right withdrawal wait period", async function () {
			const { marketplace, withdrawalWaitPeriod } = await loadFixture(deployMarketplaceFixture);

			const actual = await marketplace.withdrawalWaitPeriod();
			expect(actual).to.be.equal(withdrawalWaitPeriod);
		});

		it("Should return the zero listing for an account which haven't listed a token yet", async function () {
			const { marketplace, dummyNft, tokenId } = await loadFixture(deployMarketplaceFixture);

			const actual = await marketplace.getListing(dummyNft.address, tokenId);
			expect(actual).to.contain.keys("price", "seller");
			expect(actual.price).to.be.equal(0);
			expect(actual.seller).to.be.equal(ethers.constants.AddressZero);
		});

		it("Should return the zero payment date for an account which haven't bought a token yet", async function () {
			const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

			const actual = await marketplace.paymentDates(user.address);
			expect(actual).to.be.equal(0);
		});
	});

	describe("List a token", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from an non-owner account", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(user2.address, tokenId);

				const promise = marketplace.connect(user2).listToken(dummyNft.address, tokenId, tokenPrice);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "NftOwnerMismatched")
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

			it("Should revert without a reason if called with a non-NFT contract", async function () {
				const { marketplace, dummyFt, user, tokenId, tokenPrice } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.connect(user).listToken(dummyFt.address, tokenId, tokenPrice);
				await expect(promise).to.be.revertedWithoutReason();
			});

			it("Should reject if called along with sending ether", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);

				const promise = marketplace
					.connect(user)
					.listToken(dummyNft.address, tokenId, tokenPrice, { value: 1 });
				await expect(promise).to.be.rejected;
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
			it("Should return the corresponding listing after listing the token", async function () {
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
					.to.be.revertedWithCustomError(marketplace, "NftOwnerMismatched")
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

			it("Should reject if called along with sending ether", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).delistToken(dummyNft.address, tokenId, { value: 1 });
				await expect(promise).to.be.rejected;
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
			it("Should return an empty listing after delisting the token", async function () {
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
					.be.revertedWithCustomError(marketplace, "ListingPriceMismatched")
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
					.be.revertedWithCustomError(marketplace, "ListingPriceMismatched")
					.withArgs(dummyNft.address, tokenId, value);
			});

			it("Should revert with the right error if called by the token owner", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise)
					.be.revertedWithCustomError(marketplace, "PurchaseForbidden")
					.withArgs(user.address);
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
			it("Should return an empty listing after selling the token", async function () {
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

			it("Should return the right pending payments after selling the token", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				const actual = await marketplace.payments(user.address);
				expect(actual).to.be.equal(tokenPrice);
			});

			it("Should return the right payment date after selling the token", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				const paymentDate = (await time.latest()) + withdrawalWaitPeriod;

				const actual = await marketplace.paymentDates(user.address);
				expect(actual).to.be.equal(paymentDate);
			});

			it("Should change the token owner after selling the token", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				const actual = await dummyNft.ownerOf(tokenId);
				expect(actual).to.equal(user2.address);
			});

			it("Should change the buyer's balance after selling the token to them", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise).to.changeEtherBalance(user2, tokenPrice.mul(-1));
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
					.to.be.revertedWithCustomError(marketplace, "NftOwnerMismatched")
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

			it("Should reject if called along with sending ether", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const newTokenPrice = tokenPrice.mul(2);
				const promise = marketplace
					.connect(user)
					.updateListing(dummyNft.address, tokenId, newTokenPrice, { value: 1 });
				await expect(promise).to.be.rejected;
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
			it("Should return the listing with a new price after delisting the token", async function () {
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

	describe("Withdraw payments", function () {
		describe("Validations", function () {
			it("Should revert with the right error if called from a non-payee or non-owner account", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				const promise = marketplace.connect(user2).withdrawPayments(user.address);
				await expect(promise)
					.to.be.revertedWithCustomError(marketplace, "WithdrawalForbidden")
					.withArgs(user2.address);
			});

			it("Should revert with the right error if called from a payee account before finishing the withdrawal wait period", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				await time.increase(withdrawalWaitPeriod - 1);

				const promise = marketplace.connect(user).withdrawPayments(user.address);
				await expect(promise).to.be.revertedWithCustomError(marketplace, "WithdrawalTooEarly");
			});

			it("Should reject if called along with sending ether", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				await time.increase(withdrawalWaitPeriod);

				const promise = marketplace.connect(user).withdrawPayments(user.address, { value: 1 });
				await expect(promise).to.be.rejected;
			});

			it("Shouldn't revert if called from a payee account after finishing the withdrawal wait period", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				await time.increase(withdrawalWaitPeriod);

				const promise = marketplace.connect(user).withdrawPayments(user.address);
				await expect(promise).not.be.reverted;
			});

			it("Shouldn't revert if called from the owner account after finishing the withdrawal wait period", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				await time.increase(withdrawalWaitPeriod);

				const promise = marketplace.withdrawPayments(user.address);
				await expect(promise).not.be.reverted;
			});

			it("Shouldn't revert if called from a payee account having no payments", async function () {
				const { marketplace, dummyNft, user, tokenId, tokenPrice, withdrawalWaitPeriod } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await time.increase(withdrawalWaitPeriod);

				const promise = marketplace.connect(user).withdrawPayments(user.address);
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when withdrawing the payments", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				await time.increase(withdrawalWaitPeriod);

				const promise = marketplace.connect(user).withdrawPayments(user.address);
				await expect(promise).to.emit(marketplace, "PaymentsWithdrawn").withArgs(user.address, tokenPrice);
			});
		});

		describe("Post actions", function () {
			it("Should return empty payments after withdrawing the payment", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				await time.increase(withdrawalWaitPeriod);
				await marketplace.connect(user).withdrawPayments(user.address);

				const actual = await marketplace.payments(user.address);
				expect(actual).to.be.equal(0);
			});

			it("Should change the user's balance after withdrawing the payment", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				await time.increase(withdrawalWaitPeriod);

				const promise = await marketplace.connect(user).withdrawPayments(user.address);
				await expect(promise).to.changeEtherBalance(user, tokenPrice);
			});
		});
	});

	describe("Renounce the contract's ownership", function () {
		describe("Validations", function () {
			it("Should revert with the right reason if called from an non-owner account", async function () {
				const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.connect(user).renounceOwnership();
				await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
			});

			it("Shouldn't revert if called from the owner account", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.renounceOwnership();
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when renouncing the ownership", async function () {
				const { marketplace, deployer } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.renounceOwnership();
				await expect(promise)
					.to.emit(marketplace, "OwnershipTransferred")
					.withArgs(deployer.address, ethers.constants.AddressZero);
			});
		});

		describe("Post actions", function () {
			it("Should return no owner after renouncing the ownership", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				await marketplace.renounceOwnership();

				const actual = await marketplace.owner();
				expect(actual).to.be.equal(ethers.constants.AddressZero);
			});
		});
	});

	describe("Transfer the contract's ownership", function () {
		describe("Validations", function () {
			it("Should revert with the right reason if called from an non-owner account", async function () {
				const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.connect(user).transferOwnership(user.address);
				await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
			});

			it("Should revert with the right reason if setting the owner with the zero address", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.transferOwnership(ethers.constants.AddressZero);
				await expect(promise).to.be.revertedWith("Ownable: new owner is the zero address");
			});

			it("Shouldn't revert if called with the right parameter", async function () {
				const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.transferOwnership(user.address);
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when transferring the ownership", async function () {
				const { marketplace, deployer, user } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.transferOwnership(user.address);
				await expect(promise)
					.to.emit(marketplace, "OwnershipTransferred")
					.withArgs(deployer.address, user.address);
			});
		});

		describe("Post actions", function () {
			it("Should return the right owner after transferring the ownership", async function () {
				const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

				await marketplace.transferOwnership(user.address);

				const actual = await marketplace.owner();
				expect(actual).to.be.equal(user.address);
			});
		});
	});

	describe("Pause the contract", function () {
		describe("Validations", function () {
			it("Should revert with the right reason if called from an non-owner account", async function () {
				const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.connect(user).pause();
				await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
			});

			it("Should revert with the right reason if called multiple times", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				await marketplace.pause();

				const promise = marketplace.pause();
				await expect(promise).to.be.revertedWith("Pausable: paused");
			});

			it("Should reject if called along with sending ether", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.pause({ value: 1 });
				await expect(promise).to.be.rejected;
			});

			it("Shouldn't revert if called from the owner account", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.pause();
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when pausing the contract", async function () {
				const { marketplace, deployer } = await loadFixture(deployMarketplaceFixture);

				const promise = await marketplace.pause();

				await expect(promise).to.emit(marketplace, "Paused").withArgs(deployer.address);
			});
		});

		describe("Post actions", function () {
			it("Should return the paused state after pausing the contract", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				await marketplace.pause();

				const actual = await marketplace.paused();
				expect(actual).to.be.true;
			});

			it("Should prevent users from buying tokens after pausing the contract", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.pause();

				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise).to.be.revertedWith("Pausable: paused");
			});

			it("Should prevent users from withdrawing payments after pausing the contract", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await marketplace.pause();

				const promise = marketplace.connect(user).withdrawPayments(user.address);
				await expect(promise).to.be.revertedWith("Pausable: paused");
			});
		});
	});

	describe("Unpause the contract", function () {
		describe("Validations", function () {
			it("Should revert with the right reason if the contract has not been paused yet", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				const promise = marketplace.unpause();
				await expect(promise).to.be.revertedWith("Pausable: not paused");
			});

			it("Should revert with the right reason if called from an non-owner account", async function () {
				const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

				await marketplace.pause();

				const promise = marketplace.connect(user).unpause();
				await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
			});

			it("Should revert with the right reason if called multiple times", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				await marketplace.pause();
				await marketplace.unpause();

				const promise = marketplace.unpause();
				await expect(promise).to.be.revertedWith("Pausable: not paused");
			});

			it("Should reject if called along with sending ether", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				await marketplace.pause();

				const promise = marketplace.unpause({ value: 1 });
				await expect(promise).to.be.rejected;
			});

			it("Shouldn't revert if called from the owner account", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				await marketplace.pause();

				const promise = marketplace.unpause();
				await expect(promise).not.to.be.reverted;
			});
		});

		describe("Events", function () {
			it("Should emit an event when unpausing the contract", async function () {
				const { marketplace, deployer } = await loadFixture(deployMarketplaceFixture);

				await marketplace.pause();

				const promise = await marketplace.unpause();
				await expect(promise).to.emit(marketplace, "Unpaused").withArgs(deployer.address);
			});
		});

		describe("Post actions", function () {
			it("Should return the unpaused state after unpausing the contract", async function () {
				const { marketplace } = await loadFixture(deployMarketplaceFixture);

				await marketplace.pause();
				await marketplace.unpause();

				const actual = await marketplace.paused();
				expect(actual).to.be.false;
			});

			it("Should allow users to buy tokens after unpausing the contract", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice } = await loadFixture(
					deployMarketplaceFixture,
				);

				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);

				await marketplace.pause();
				await marketplace.unpause();

				const promise = marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });
				await expect(promise).not.to.be.reverted;
			});

			it("Should allow users to withdraw payments after unpausing the contract", async function () {
				const { marketplace, dummyNft, user, user2, tokenId, tokenPrice, withdrawalWaitPeriod } =
					await loadFixture(deployMarketplaceFixture);
				await dummyNft.connect(user).approve(marketplace.address, tokenId);
				await marketplace.connect(user).listToken(dummyNft.address, tokenId, tokenPrice);
				await marketplace.connect(user2).buyToken(dummyNft.address, tokenId, { value: tokenPrice });

				await marketplace.pause();
				await marketplace.unpause();

				await time.increase(withdrawalWaitPeriod);

				const promise = marketplace.connect(user).withdrawPayments(user.address);
				await expect(promise).not.to.be.reverted;
			});
		});
	});

	describe("Fallback", function () {
		it("Should revert without a reason if sending ether to the contract", async function () {
			const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

			const promise = user.sendTransaction({
				to: marketplace.address,
				value: ethers.utils.parseEther("1"),
			});
			await expect(promise).to.be.revertedWithoutReason();
		});

		it("Should revert without a reason if calling a non-existing method on the contract", async function () {
			const { marketplace, user } = await loadFixture(deployMarketplaceFixture);
			const iface = new ethers.utils.Interface(["function foobar()"]);

			const promise = user.sendTransaction({
				to: marketplace.address,
				data: iface.encodeFunctionData("foobar"),
			});
			await expect(promise).to.be.revertedWithoutReason();
		});

		it("Should revert without a reason if sending no ether and no data to the contract", async function () {
			const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

			const promise = user.sendTransaction({
				to: marketplace.address,
			});
			await expect(promise).to.be.revertedWithoutReason();
		});
	});
});
