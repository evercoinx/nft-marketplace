import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Markeplace", function () {
    async function deployMarketplaceFixture() {
        const [deployer, user, user2] = await ethers.getSigners();

        const TestERC721 = await ethers.getContractFactory("TestERC721");
        const testERC721 = await TestERC721.deploy();

        await testERC721.mint(
            user.address,
            "https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu",
        );
        const events = await testERC721.queryFilter(testERC721.filters.TokenMinted());

        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const testERC20 = await TestERC20.deploy(1_000_000);

        const listingFee = ethers.utils.parseEther("0.001");
        const withdrawalPeriod = 3 * 24 * 60 * 60; // 3 days
        const Marketplace = await ethers.getContractFactory("Marketplace");
        const marketplace = await upgrades.deployProxy(Marketplace, [
            listingFee,
            withdrawalPeriod,
        ]);

        return {
            marketplace,
            testERC721,
            testERC20,
            deployer,
            user,
            user2,
            listingFee,
            withdrawalPeriod,
            tokenId: events[0]?.args.tokenId,
            tokenPrice: ethers.utils.parseEther("0.1"),
        };
    }

    describe("Deploy the contract", function () {
        it("Should return the right listing fee", async function () {
            const { marketplace, listingFee } = await loadFixture(deployMarketplaceFixture);

            const actual = await marketplace.listingFee();
            expect(actual).to.be.equal(listingFee);
        });

        it("Should return the right withdrawal period", async function () {
            const { marketplace, withdrawalPeriod } = await loadFixture(deployMarketplaceFixture);

            const actual = await marketplace.withdrawalPeriod();
            expect(actual).to.be.equal(withdrawalPeriod);
        });

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

        it("Should return the zero listing for an account which haven't listed a token yet", async function () {
            const { marketplace, testERC721, tokenId } = await loadFixture(
                deployMarketplaceFixture,
            );

            const actual = await marketplace.getListing(testERC721.address, tokenId);
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

    describe("Upgrade the contract", function () {
        it("Shouldn't rejected after upgrading to a new version", async function () {
            const { marketplace } = await loadFixture(deployMarketplaceFixture);

            const TestMarketplaceV2 = await ethers.getContractFactory("TestMarketplaceV2");

            const promise = upgrades.upgradeProxy(marketplace.address, TestMarketplaceV2);
            await expect(promise).not.to.be.rejected;
        });

        it("Should return the same proxy address after upgrading to a new version", async function () {
            const { marketplace } = await loadFixture(deployMarketplaceFixture);

            const TestMarketplaceV2 = await ethers.getContractFactory("TestMarketplaceV2");

            const testMarketplaceV2 = await upgrades.upgradeProxy(
                marketplace.address,
                TestMarketplaceV2,
            );
            expect(testMarketplaceV2.address).to.be.equal(marketplace.address);
        });

        it("Should return the right new property after upgrading to a new version", async function () {
            const { marketplace } = await loadFixture(deployMarketplaceFixture);

            const TestMarketplaceV2 = await ethers.getContractFactory("TestMarketplaceV2");
            const testMarketplaceV2 = await upgrades.upgradeProxy(
                marketplace.address,
                TestMarketplaceV2,
            );

            const newProperty = 1;
            await testMarketplaceV2.setNewProperty(newProperty);

            const actual = await testMarketplaceV2.newProperty();
            expect(actual).to.be.equal(newProperty);
        });

        it("Should return the right listing fee after upgrading to a new version", async function () {
            const { marketplace, listingFee } = await loadFixture(deployMarketplaceFixture);

            const TestMarketplaceV2 = await ethers.getContractFactory("TestMarketplaceV2");
            const testMarketplaceV2 = await upgrades.upgradeProxy(
                marketplace.address,
                TestMarketplaceV2,
            );

            const actual = await testMarketplaceV2.listingFee();
            expect(actual).to.be.equal(listingFee);
        });

        it("Should return the right withdrawal period after upgrading to a new version", async function () {
            const { marketplace, withdrawalPeriod } = await loadFixture(deployMarketplaceFixture);

            const TestMarketplaceV2 = await ethers.getContractFactory("TestMarketplaceV2");
            const testMarketplaceV2 = await upgrades.upgradeProxy(
                marketplace.address,
                TestMarketplaceV2,
            );

            const actual = await testMarketplaceV2.withdrawalPeriod();
            expect(actual).to.be.equal(withdrawalPeriod);
        });

        it("Should return the right owner after upgrading to a new version", async function () {
            const { marketplace, deployer } = await loadFixture(deployMarketplaceFixture);

            const TestMarketplaceV2 = await ethers.getContractFactory("TestMarketplaceV2");
            const testMarketplaceV2 = await upgrades.upgradeProxy(
                marketplace.address,
                TestMarketplaceV2,
            );

            const actual = await testMarketplaceV2.owner();
            expect(actual).to.be.equal(deployer.address);
        });

        it("Should return the right pausable state after upgrading to a new version", async function () {
            const { marketplace } = await loadFixture(deployMarketplaceFixture);

            const TestMarketplaceV2 = await ethers.getContractFactory("TestMarketplaceV2");
            const testMarketplaceV2 = await upgrades.upgradeProxy(
                marketplace.address,
                TestMarketplaceV2,
            );

            const actual = await testMarketplaceV2.paused();
            expect(actual).to.be.false;
        });
    });

    describe("List a token", function () {
        describe("Validations", function () {
            it("Should revert with the right error if called from an non-owner account", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(user2.address, tokenId);

                const promise = marketplace
                    .connect(user2)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "InvalidNFTOwner")
                    .withArgs(user2.address);
            });

            it("Should revert with the right error if the marketplace is not an approved operator", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                const promise = marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "NFTNotApproved")
                    .withArgs(testERC721.address, tokenId);
            });

            it("Should revert with the right error if a token has been already listed", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "TokenAlreadyListed")
                    .withArgs(testERC721.address, tokenId);
            });

            it("Should revert with the right error if called with the zero price", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId } = await loadFixture(
                    deployMarketplaceFixture,
                );

                await testERC721.connect(user).approve(marketplace.address, tokenId);

                const promise = marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, 0, { value: listingFee });
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "ZeroPrice")
                    .withArgs();
            });

            it("Should revert with the right error if called with the zero listing fee", async function () {
                const { marketplace, testERC721, user, tokenId, tokenPrice } = await loadFixture(
                    deployMarketplaceFixture,
                );

                await testERC721.connect(user).approve(marketplace.address, tokenId);

                const promise = marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice);
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "InvalidListingFee")
                    .withArgs(testERC721.address, tokenId, 0);
            });

            it("Should revert with the right error if called with a listing fee greater than expected", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);

                const newListingFee = listingFee.add(1);
                const promise = marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: newListingFee });
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "InvalidListingFee")
                    .withArgs(testERC721.address, tokenId, newListingFee);
            });

            it("Should revert without a reason if called with a non-NFT contract", async function () {
                const { marketplace, testERC20, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);
                const promise = marketplace
                    .connect(user)
                    .listToken(testERC20.address, tokenId, tokenPrice, { value: listingFee });
                await expect(promise).to.be.revertedWithoutReason();
            });

            it("Shouldn't revert if called with the right parameters", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);

                const promise = marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                await expect(promise).not.to.be.reverted;
            });
        });

        describe("Events", function () {
            it("Should emit an event when listing a token", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);

                const promise = marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                await expect(promise)
                    .to.emit(marketplace, "TokenListed")
                    .withArgs(user.address, testERC721.address, tokenId, tokenPrice);
            });
        });

        describe("Post actions", function () {
            it("Should return the right listing item after listing a token", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const actual = await marketplace.getListing(testERC721.address, tokenId);
                expect(actual).to.contain.keys("price", "seller");
                expect(actual.price).to.be.equal(tokenPrice);
                expect(actual.seller).to.be.equal(user.address);
            });

            it("Should return the right listing count after listing a token", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const actual = await marketplace.listingCount();
                expect(actual).to.be.equal(1);
            });

            it("Should change the buyer's balance after listing a token", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                const promise = marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await expect(promise).to.changeEtherBalances(
                    [user, marketplace],
                    [listingFee.mul(-1), 0],
                );
            });
        });
    });

    describe("Delist a token", function () {
        describe("Validations", function () {
            it("Should revert with the right error if called from an non-owner account", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await testERC721.connect(user).approve(user2.address, tokenId);

                const promise = marketplace
                    .connect(user2)
                    .delistToken(testERC721.address, tokenId);
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "InvalidNFTOwner")
                    .withArgs(user2.address);
            });

            it("Should revert with the right error if a token hasn't been listed yet", async function () {
                const { marketplace, testERC721, user, tokenId } = await loadFixture(
                    deployMarketplaceFixture,
                );

                await testERC721.connect(user).approve(marketplace.address, tokenId);

                const promise = marketplace.connect(user).delistToken(testERC721.address, tokenId);
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "TokenNotListed")
                    .withArgs(testERC721.address, tokenId);
            });

            it("Should reject if called along with sending ether", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace
                    .connect(user)
                    .delistToken(testERC721.address, tokenId, { value: 1 });
                await expect(promise).to.be.rejected;
            });

            it("Shouldn't revert if called with the right parameters", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace.connect(user).delistToken(testERC721.address, tokenId);
                await expect(promise).not.be.reverted;
            });
        });

        describe("Events", function () {
            it("Should emit an event when delisting a token", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace.connect(user).delistToken(testERC721.address, tokenId);
                await expect(promise)
                    .to.emit(marketplace, "TokenDelisted")
                    .withArgs(user.address, testERC721.address, tokenId);
            });
        });

        describe("Post actions", function () {
            it("Should return an empty listing after delisting a token", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await marketplace.connect(user).delistToken(testERC721.address, tokenId);

                const actual = await marketplace.getListing(testERC721.address, tokenId);
                expect(actual).to.contain.keys("price", "seller");
                expect(actual.price).to.be.equal(0);
                expect(actual.seller).to.be.equal(ethers.constants.AddressZero);
            });

            it("Should return the right listing count after delisting a token", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await marketplace.connect(user).delistToken(testERC721.address, tokenId);

                const actual = await marketplace.listingCount();
                expect(actual).to.be.equal(0);
            });
        });
    });

    describe("Buy a token", function () {
        describe("Validations", function () {
            it("Should revert with the rigth error if a token hasn't been listed yet", async function () {
                const { marketplace, testERC721, user, user2, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);

                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise)
                    .be.revertedWithCustomError(marketplace, "TokenNotListed")
                    .withArgs(testERC721.address, tokenId);
            });

            it("Should revert with the right error if an account removed its approval from the marketplace", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await testERC721.connect(user).approve(ethers.constants.AddressZero, tokenId);

                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "NFTNotApproved")
                    .withArgs(testERC721.address, tokenId);
            });

            it("Should revert with the right error if an account transferred its token to another account", async function () {
                const {
                    marketplace,
                    testERC721,
                    deployer,
                    user,
                    user2,
                    listingFee,
                    tokenId,
                    tokenPrice,
                } = await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await testERC721
                    .connect(user)
                    .transferFrom(user.address, deployer.address, tokenId);

                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "NFTNotApproved")
                    .withArgs(testERC721.address, tokenId);
            });

            it("Should revert with the right error if called with a price lower than expected", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const newTokenPrice = tokenPrice.sub(1);
                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: newTokenPrice });
                await expect(promise)
                    .be.revertedWithCustomError(marketplace, "InvalidListingPrice")
                    .withArgs(testERC721.address, tokenId, newTokenPrice);
            });

            it("Should revert with the right error if called with a price greater than expected", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const newTokenPrice = tokenPrice.add(1);
                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: newTokenPrice });
                await expect(promise)
                    .be.revertedWithCustomError(marketplace, "InvalidListingPrice")
                    .withArgs(testERC721.address, tokenId, newTokenPrice);
            });

            it("Should revert with the right error if called by the token's owner", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace
                    .connect(user)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise)
                    .be.revertedWithCustomError(marketplace, "PurchaseForbidden")
                    .withArgs(user.address);
            });

            it("Shouldn't revert if called with the right parameters", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise).not.be.reverted;
            });
        });

        describe("Events", function () {
            it("Should emit an event when buying a token", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise)
                    .to.emit(marketplace, "TokenBought")
                    .withArgs(user2.address, testERC721.address, tokenId, tokenPrice);
            });
        });

        describe("Post actions", function () {
            it("Should return an empty listing item after buying a token", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                const actual = await marketplace.getListing(testERC721.address, tokenId);
                expect(actual).to.contain.keys("price", "seller");
                expect(actual.price).to.be.equal(0);
                expect(actual.seller).to.be.equal(ethers.constants.AddressZero);
            });

            it("Should return the right payments after buying a token", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                const actual = await marketplace.payments(user.address);
                expect(actual).to.be.equal(tokenPrice);
            });

            it("Should return the right payment date after buying a token", async function () {
                const {
                    marketplace,
                    testERC721,
                    user,
                    user2,
                    listingFee,
                    withdrawalPeriod,
                    tokenId,
                    tokenPrice,
                } = await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                const paymentDate = (await time.latest()) + withdrawalPeriod;

                const actual = await marketplace.paymentDates(user.address);
                expect(actual).to.be.equal(paymentDate);
            });

            it("Should return the right listing count after delisting a token", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                const actual = await marketplace.listingCount();
                expect(actual).to.be.equal(0);
            });

            it("Should change the token's owner after buying a token", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                const actual = await testERC721.ownerOf(tokenId);
                expect(actual).to.equal(user2.address);
            });

            it("Should change the buyer's balance after buying a token", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise).to.changeEtherBalances(
                    [user2, user],
                    [tokenPrice.mul(-1), 0],
                );
            });
        });
    });

    describe("Update a listing", function () {
        describe("Validations", function () {
            it("Should revert with the right error if called from an non-owner account", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const newTokenPrice = tokenPrice.mul(2);
                const promise = marketplace
                    .connect(user2)
                    .updateListing(testERC721.address, tokenId, newTokenPrice);

                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "InvalidNFTOwner")
                    .withArgs(user2.address);
            });

            it("Should revert with the right error if a token has not been listed yet", async function () {
                const { marketplace, testERC721, user, tokenId, tokenPrice } = await loadFixture(
                    deployMarketplaceFixture,
                );

                await testERC721.connect(user).approve(marketplace.address, tokenId);

                const newTokenPrice = tokenPrice.mul(2);
                const promise = marketplace
                    .connect(user)
                    .updateListing(testERC721.address, tokenId, newTokenPrice);
                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "TokenNotListed")
                    .withArgs(testERC721.address, tokenId);
            });

            it("Should revert with the right error if called with a zero price", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const promise = marketplace
                    .connect(user)
                    .updateListing(testERC721.address, tokenId, 0);

                await expect(promise)
                    .to.be.revertedWithCustomError(marketplace, "ZeroPrice")
                    .withArgs();
            });

            it("Should reject if called along with sending ether", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const newTokenPrice = tokenPrice.mul(2);
                const promise = marketplace
                    .connect(user)
                    .updateListing(testERC721.address, tokenId, newTokenPrice, { value: 1 });
                await expect(promise).to.be.rejected;
            });

            it("Shouldn't revert if called with the right parameters", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const newTokenPrice = tokenPrice.mul(2);
                const promise = marketplace
                    .connect(user)
                    .updateListing(testERC721.address, tokenId, newTokenPrice);
                await expect(promise).not.be.reverted;
            });
        });

        describe("Events", function () {
            it("Should emit an event when updating a listing", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const newTokenPrice = tokenPrice.mul(2);
                const promise = marketplace
                    .connect(user)
                    .updateListing(testERC721.address, tokenId, newTokenPrice);
                await expect(promise)
                    .to.emit(marketplace, "TokenListed")
                    .withArgs(user.address, testERC721.address, tokenId, newTokenPrice);
            });
        });

        describe("Post actions", function () {
            it("Should return the right listing item after delisting a token", async function () {
                const { marketplace, testERC721, user, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                const newTokenPrice = tokenPrice.mul(2);
                await marketplace
                    .connect(user)
                    .updateListing(testERC721.address, tokenId, newTokenPrice);

                const actual = await marketplace.getListing(testERC721.address, tokenId);
                expect(actual).to.contain.keys("price", "seller");
                expect(actual.price).to.be.equal(newTokenPrice);
                expect(actual.seller).to.be.equal(user.address);
            });
        });
    });

    describe("Withdraw a payment", function () {
        describe("For a token's buyer", function () {
            describe("Validations", function () {
                it("Should revert with the right error if called from a non-payee or non-owner account", async function () {
                    const {
                        marketplace,
                        testERC721,
                        user,
                        user2,
                        listingFee,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                    const promise = marketplace.connect(user2).withdrawPayments(user.address);
                    await expect(promise)
                        .to.be.revertedWithCustomError(marketplace, "WithdrawalForbidden")
                        .withArgs(user.address);
                });

                it("Should revert with the right error if called from a payee account before finishing a withdrawal period", async function () {
                    const {
                        marketplace,
                        testERC721,
                        user,
                        user2,
                        listingFee,
                        withdrawalPeriod,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                    await marketplace
                        .connect(user2)
                        .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                    await time.increase(withdrawalPeriod - 1);
                    const currentTimestamp = await time.latest();

                    const promise = marketplace.connect(user).withdrawPayments(user.address);
                    await expect(promise)
                        .to.be.revertedWithCustomError(marketplace, "WithdrawalLocked")
                        .withArgs(user.address, currentTimestamp + 1, currentTimestamp + 1);
                });

                it("Shouldn't revert if called from a payee account after finishing a withdrawal period", async function () {
                    const {
                        marketplace,
                        testERC721,
                        user,
                        user2,
                        listingFee,
                        withdrawalPeriod,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                    await marketplace
                        .connect(user2)
                        .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                    await time.increase(withdrawalPeriod);

                    const promise = marketplace.connect(user).withdrawPayments(user.address);
                    await expect(promise).not.be.reverted;
                });

                it("Should reject if called along with sending ether", async function () {
                    const {
                        marketplace,
                        testERC721,
                        user,
                        user2,
                        listingFee,
                        withdrawalPeriod,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                    await marketplace
                        .connect(user2)
                        .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                    await time.increase(withdrawalPeriod);

                    const promise = marketplace
                        .connect(user)
                        .withdrawPayments(user.address, { value: 1 });
                    await expect(promise).to.be.rejected;
                });

                it("Shouldn't revert if called from the owner account after finishing a withdrawal period", async function () {
                    const {
                        marketplace,
                        testERC721,
                        user,
                        user2,
                        listingFee,
                        withdrawalPeriod,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                    await marketplace
                        .connect(user2)
                        .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                    await time.increase(withdrawalPeriod);

                    const promise = marketplace.withdrawPayments(user.address);
                    await expect(promise).not.be.reverted;
                });

                it("Shouldn't revert if called from a payee account having no payments", async function () {
                    const {
                        marketplace,
                        testERC721,
                        user,
                        listingFee,
                        withdrawalPeriod,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                    await time.increase(withdrawalPeriod);

                    const promise = marketplace.connect(user).withdrawPayments(user.address);
                    await expect(promise).not.to.be.reverted;
                });
            });

            describe("Events", function () {
                it("Should emit an event when withdrawing a payment", async function () {
                    const {
                        marketplace,
                        testERC721,
                        user,
                        user2,
                        listingFee,
                        withdrawalPeriod,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                    await marketplace
                        .connect(user2)
                        .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                    await time.increase(withdrawalPeriod);

                    const promise = marketplace.connect(user).withdrawPayments(user.address);
                    await expect(promise)
                        .to.emit(marketplace, "PaymentsWithdrawn")
                        .withArgs(user.address, tokenPrice);
                });
            });

            describe("Post actions", function () {
                it("Should return the user's zero payment after withdrawing a payment", async function () {
                    const {
                        marketplace,
                        testERC721,
                        user,
                        user2,
                        listingFee,
                        withdrawalPeriod,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                    await marketplace
                        .connect(user2)
                        .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                    await time.increase(withdrawalPeriod);
                    await marketplace.connect(user).withdrawPayments(user.address);

                    const actual = await marketplace.payments(user.address);
                    expect(actual).to.be.equal(0);
                });

                it("Should change the user's balance after withdrawing a payment", async function () {
                    const {
                        marketplace,
                        testERC721,
                        deployer,
                        user,
                        user2,
                        listingFee,
                        withdrawalPeriod,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                    await marketplace
                        .connect(user2)
                        .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                    await time.increase(withdrawalPeriod);

                    const promise = await marketplace.connect(user).withdrawPayments(user.address);
                    await expect(promise).to.changeEtherBalances(
                        [user, user2, deployer],
                        [tokenPrice, 0, 0],
                    );
                });
            });
        });

        describe("For the contract's onwer", function () {
            describe("Validations", function () {
                it("Should revert with the right error if called from a non-owner account", async function () {
                    const {
                        marketplace,
                        testERC721,
                        deployer,
                        user,
                        user2,
                        listingFee,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                    const promise = marketplace.connect(user2).withdrawPayments(deployer.address);
                    await expect(promise)
                        .to.be.revertedWithCustomError(marketplace, "WithdrawalForbidden")
                        .withArgs(deployer.address);
                });

                it("Should reject if called along with sending ether", async function () {
                    const {
                        marketplace,
                        testERC721,
                        deployer,
                        user,
                        listingFee,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                    const promise = marketplace.withdrawPayments(deployer.address, { value: 1 });
                    await expect(promise).to.be.rejected;
                });

                it("Shouldn't revert if called with the right parameters", async function () {
                    const {
                        marketplace,
                        testERC721,
                        deployer,
                        user,
                        listingFee,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                    const promise = marketplace.withdrawPayments(deployer.address);
                    await expect(promise).not.to.be.reverted;
                });
            });

            describe("Events", function () {
                it("Should emit an event when withdrawing a payment", async function () {
                    const {
                        marketplace,
                        testERC721,
                        deployer,
                        user,
                        listingFee,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                    const promise = marketplace.withdrawPayments(deployer.address);
                    await expect(promise)
                        .to.emit(marketplace, "PaymentsWithdrawn")
                        .withArgs(deployer.address, listingFee);
                });
            });

            describe("Post actions", function () {
                it("Should return the contrat owner's zero payment after withdrawing a payment", async function () {
                    const {
                        marketplace,
                        testERC721,
                        deployer,
                        user,
                        listingFee,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                    await marketplace.withdrawPayments(deployer.address);

                    const actual = await marketplace.payments(deployer.address);
                    expect(actual).to.be.equal(0);
                });

                it("Should change the contract onwer's balance after withdrawing a payment", async function () {
                    const {
                        marketplace,
                        testERC721,
                        deployer,
                        user,
                        listingFee,
                        tokenId,
                        tokenPrice,
                    } = await loadFixture(deployMarketplaceFixture);

                    await testERC721.connect(user).approve(marketplace.address, tokenId);
                    await marketplace
                        .connect(user)
                        .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                    const promise = await marketplace.withdrawPayments(deployer.address);
                    await expect(promise).to.changeEtherBalances(
                        [deployer, user],
                        [listingFee, 0],
                    );
                });
            });
        });
    });

    describe("Renounce contract's ownership", function () {
        describe("Validations", function () {
            it("Should revert with the right reason if called from an non-owner account", async function () {
                const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.connect(user).renounceOwnership();
                await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
            });

            it("Should reject if called along with sending ether", async function () {
                const { marketplace } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.renounceOwnership({ value: 1 });
                await expect(promise).to.be.rejected;
            });

            it("Shouldn't revert if called from the owner account", async function () {
                const { marketplace } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.renounceOwnership();
                await expect(promise).not.to.be.reverted;
            });
        });

        describe("Events", function () {
            it("Should emit an event when renouncing contract's ownership", async function () {
                const { marketplace, deployer } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.renounceOwnership();
                await expect(promise)
                    .to.emit(marketplace, "OwnershipTransferred")
                    .withArgs(deployer.address, ethers.constants.AddressZero);
            });
        });

        describe("Post actions", function () {
            it("Should return the zero address owner after renouncing contract's ownership", async function () {
                const { marketplace } = await loadFixture(deployMarketplaceFixture);

                await marketplace.renounceOwnership();

                const actual = await marketplace.owner();
                expect(actual).to.be.equal(ethers.constants.AddressZero);
            });
        });
    });

    describe("Set a listing fee", function () {
        describe("Validations", function () {
            it("Should revert with the right reason if called from an non-owner account", async function () {
                const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.connect(user).setListingFee(0);
                await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
            });

            it("Should reject if called along with sending ether", async function () {
                const { marketplace, listingFee } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.setListingFee(listingFee.add(1), { value: 1 });
                await expect(promise).to.be.rejected;
            });

            it("Shouldn't revert if called with the right parameters", async function () {
                const { marketplace, listingFee } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.setListingFee(listingFee.add(1));
                await expect(promise).not.be.reverted;
            });
        });

        describe("Events", function () {
            it("Should emit an event when setting a new listing fee", async function () {
                const { marketplace, listingFee } = await loadFixture(deployMarketplaceFixture);

                const newListingFee = listingFee.add(1);
                const promise = marketplace.setListingFee(newListingFee);
                await expect(promise)
                    .to.emit(marketplace, "ListingFeeSet")
                    .withArgs(newListingFee);
            });
        });

        describe("Post actions", function () {
            it("Should return the right listing fee after setting a new listing fee", async function () {
                const { marketplace, listingFee } = await loadFixture(deployMarketplaceFixture);

                const newListingFee = listingFee.add(1);
                await marketplace.setListingFee(listingFee.add(1));

                const actual = await marketplace.listingFee();
                expect(actual).to.equal(newListingFee);
            });
        });
    });

    describe("Set a withdrawal period", function () {
        describe("Validations", function () {
            it("Should revert with the right reason if called from an non-owner account", async function () {
                const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.connect(user).setWithdrawalPeriod(0);
                await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
            });

            it("Should reject if called along with sending ether", async function () {
                const { marketplace, withdrawalPeriod } = await loadFixture(
                    deployMarketplaceFixture,
                );

                const promise = marketplace.setWithdrawalPeriod(withdrawalPeriod + 1, {
                    value: 1,
                });
                await expect(promise).to.be.rejected;
            });

            it("Shouldn't revert if called with the right parameters", async function () {
                const { marketplace, withdrawalPeriod } = await loadFixture(
                    deployMarketplaceFixture,
                );

                const promise = marketplace.setWithdrawalPeriod(withdrawalPeriod + 1);
                await expect(promise).not.be.reverted;
            });
        });

        describe("Events", function () {
            it("Should emit an event when setting a new withdrawal period", async function () {
                const { marketplace, withdrawalPeriod } = await loadFixture(
                    deployMarketplaceFixture,
                );

                const newWithdrawalPeriod = withdrawalPeriod + 1;
                const promise = marketplace.setWithdrawalPeriod(newWithdrawalPeriod);
                await expect(promise)
                    .to.emit(marketplace, "WithdrawalPeriodSet")
                    .withArgs(newWithdrawalPeriod);
            });
        });

        describe("Post actions", function () {
            it("Should return the right withdrawal period after setting a new withdrawal period", async function () {
                const { marketplace, withdrawalPeriod } = await loadFixture(
                    deployMarketplaceFixture,
                );

                const newWithdrawalPeriod = withdrawalPeriod + 1;
                await marketplace.setWithdrawalPeriod(newWithdrawalPeriod);

                const actual = await marketplace.withdrawalPeriod();
                expect(actual).to.equal(newWithdrawalPeriod);
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

            it("Should revert with the right reason if setting the zero address owner", async function () {
                const { marketplace } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.transferOwnership(ethers.constants.AddressZero);
                await expect(promise).to.be.revertedWith("Ownable: new owner is the zero address");
            });

            it("Should reject if called along with sending ether", async function () {
                const { marketplace } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.transferOwnership(ethers.constants.AddressZero, {
                    value: 1,
                });
                await expect(promise).to.be.rejected;
            });

            it("Shouldn't revert if called with the right parameter", async function () {
                const { marketplace, user } = await loadFixture(deployMarketplaceFixture);

                const promise = marketplace.transferOwnership(user.address);
                await expect(promise).not.to.be.reverted;
            });
        });

        describe("Events", function () {
            it("Should emit an event when transferring contract's ownership", async function () {
                const { marketplace, deployer, user } = await loadFixture(
                    deployMarketplaceFixture,
                );

                const promise = marketplace.transferOwnership(user.address);
                await expect(promise)
                    .to.emit(marketplace, "OwnershipTransferred")
                    .withArgs(deployer.address, user.address);
            });
        });

        describe("Post actions", function () {
            it("Should return the right owner after transferring contract's ownership", async function () {
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
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                await marketplace.pause();

                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise).to.be.revertedWith("Pausable: paused");
            });

            it("Should prevent users from withdrawing payments after pausing the contract", async function () {
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                await marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await marketplace.pause();

                const promise = marketplace.connect(user).withdrawPayments(user.address);
                await expect(promise).to.be.revertedWith("Pausable: paused");
            });
        });
    });

    describe("Unpause the contract", function () {
        describe("Validations", function () {
            it("Should revert with the right reason if the contract hasn't been paused yet", async function () {
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
                const { marketplace, testERC721, user, user2, listingFee, tokenId, tokenPrice } =
                    await loadFixture(deployMarketplaceFixture);

                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });

                await marketplace.pause();
                await marketplace.unpause();

                const promise = marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });
                await expect(promise).not.to.be.reverted;
            });

            it("Should allow users to withdraw payments after unpausing the contract", async function () {
                const {
                    marketplace,
                    testERC721,
                    user,
                    user2,
                    listingFee,
                    withdrawalPeriod,
                    tokenId,
                    tokenPrice,
                } = await loadFixture(deployMarketplaceFixture);
                await testERC721.connect(user).approve(marketplace.address, tokenId);
                await marketplace
                    .connect(user)
                    .listToken(testERC721.address, tokenId, tokenPrice, { value: listingFee });
                await marketplace
                    .connect(user2)
                    .buyToken(testERC721.address, tokenId, { value: tokenPrice });

                await marketplace.pause();
                await marketplace.unpause();

                await time.increase(withdrawalPeriod);

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
