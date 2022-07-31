// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { PullPaymentUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PullPaymentUpgradeable.sol";

error OperatorNotApproved();
error NFTOwnerMismatched(address spender);
error PurchaseForbidden(address buyer);
error WithdrawalForbidden(address payee);
error WithdrawalTooEarly(address payee, uint256 currentTimestamp);
error TokenAlreadyListed(IERC721 tokenContract, uint256 tokenId);
error TokenNotListed(IERC721 tokenContract, uint256 tokenId);
error ListingFeeMismatched(IERC721 tokenContract, uint256 tokenId, uint256 fee);
error ListingPriceMismatched(IERC721 tokenContract, uint256 tokenId, uint256 price);
error ZeroPrice();

contract Marketplace is
	Initializable,
	OwnableUpgradeable,
	PausableUpgradeable,
	ReentrancyGuardUpgradeable,
	PullPaymentUpgradeable
{
	struct Listing {
		uint256 price;
		address seller;
	}

	event TokenListed(address indexed seller, IERC721 indexed tokenContract, uint256 indexed tokenId, uint256 price);
	event TokenDelisted(address indexed seller, IERC721 indexed tokenContract, uint256 indexed tokenId);
	event TokenBought(address indexed buyer, IERC721 indexed tokenContract, uint256 indexed tokenId, uint256 price);
	event PaymentsWithdrawn(address indexed payee, uint256 amount);

	uint256 public listingFee;
	uint256 public withdrawalPeriod;
	mapping(address => uint256) public paymentDates;
	mapping(IERC721 => mapping(uint256 => Listing)) private _listings;

	modifier isNFTOwner(
		IERC721 tokenContract,
		uint256 tokenId,
		address spender
	) {
		if (tokenContract.ownerOf(tokenId) != spender) {
			revert NFTOwnerMismatched(spender);
		}
		_;
	}

	modifier isListed(IERC721 tokenContract, uint256 tokenId) {
		Listing memory listing = _listings[tokenContract][tokenId];
		if (listing.price <= 0) {
			revert TokenNotListed(tokenContract, tokenId);
		}
		_;
	}

	modifier isApproved(IERC721 tokenContract, uint256 tokenId) {
		if (tokenContract.getApproved(tokenId) != address(this)) {
			revert OperatorNotApproved();
		}
		_;
	}

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function initialize(uint256 listingFee_, uint256 withdrawalPeriod_) public initializer {
		OwnableUpgradeable.__Ownable_init();
		PausableUpgradeable.__Pausable_init();
		ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
		PullPaymentUpgradeable.__PullPayment_init();

		listingFee = listingFee_;
		withdrawalPeriod = withdrawalPeriod_;
	}

	function listToken(
		IERC721 tokenContract,
		uint256 tokenId,
		uint256 price
	) external payable nonReentrant isNFTOwner(tokenContract, tokenId, msg.sender) isApproved(tokenContract, tokenId) {
		if (price == 0) {
			revert ZeroPrice();
		}
		if (msg.value != listingFee) {
			revert ListingFeeMismatched(tokenContract, tokenId, msg.value);
		}

		Listing memory listing = _listings[tokenContract][tokenId];
		if (listing.price > 0) {
			revert TokenAlreadyListed(tokenContract, tokenId);
		}

		_listings[tokenContract][tokenId] = Listing(price, msg.sender);
		emit TokenListed(msg.sender, tokenContract, tokenId, price);
	}

	function delistToken(IERC721 tokenContract, uint256 tokenId)
		external
		isListed(tokenContract, tokenId)
		nonReentrant
		isNFTOwner(tokenContract, tokenId, msg.sender)
	{
		delete _listings[tokenContract][tokenId];
		emit TokenDelisted(msg.sender, tokenContract, tokenId);
	}

	function buyToken(IERC721 tokenContract, uint256 tokenId)
		external
		payable
		whenNotPaused
		isListed(tokenContract, tokenId)
		nonReentrant
		isApproved(tokenContract, tokenId)
	{
		Listing memory listing = _listings[tokenContract][tokenId];
		if (listing.price != msg.value) {
			revert ListingPriceMismatched(tokenContract, tokenId, msg.value);
		}

		if (tokenContract.ownerOf(tokenId) == msg.sender) {
			revert PurchaseForbidden(msg.sender);
		}

		super._asyncTransfer(listing.seller, msg.value);

		paymentDates[listing.seller] = block.timestamp + withdrawalPeriod;
		delete _listings[tokenContract][tokenId];

		tokenContract.safeTransferFrom(listing.seller, msg.sender, tokenId);
		emit TokenBought(msg.sender, tokenContract, tokenId, listing.price);
	}

	function withdrawPayments(address payable payee) public override whenNotPaused {
		if (msg.sender != payee && msg.sender != super.owner()) {
			revert WithdrawalForbidden(msg.sender);
		}

		if (block.timestamp <= paymentDates[payee]) {
			revert WithdrawalTooEarly(msg.sender, block.timestamp);
		}

		delete paymentDates[payee];

		uint256 amount = super.payments(payee);
		super.withdrawPayments(payee);
		emit PaymentsWithdrawn(payee, amount);
	}

	function updateListing(
		IERC721 tokenContract,
		uint256 tokenId,
		uint256 newPrice
	) external isListed(tokenContract, tokenId) nonReentrant isNFTOwner(tokenContract, tokenId, msg.sender) {
		if (newPrice == 0) {
			revert ZeroPrice();
		}

		_listings[tokenContract][tokenId].price = newPrice;
		emit TokenListed(msg.sender, tokenContract, tokenId, newPrice);
	}

	function pause() external onlyOwner {
		super._pause();
	}

	function unpause() external onlyOwner {
		super._unpause();
	}

	function getListing(IERC721 tokenContract, uint256 tokenId) external view returns (Listing memory) {
		return _listings[tokenContract][tokenId];
	}
}
