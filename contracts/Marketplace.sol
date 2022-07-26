// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { PullPaymentUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PullPaymentUpgradeable.sol";

error OperatorNotApproved();
error SpenderNotNftOwner(address spender);
error PurchaseForbidden(address buyer);
error WithdrawalForbidden(address payee);
error TokenAlreadyListed(address tokenContract, uint256 tokenId);
error TokenNotListed(address tokenContract, uint256 tokenId);
error PriceMismatched(address tokenContract, uint256 tokenId, uint256 price);
error PriceNotPositive(uint256 price);

contract Marketplace is Initializable, OwnableUpgradeable, PausableUpgradeable, PullPaymentUpgradeable {
	struct Listing {
		uint256 price;
		address seller;
	}

	event TokenListed(address indexed seller, address indexed tokenContract, uint256 indexed tokenId, uint256 price);
	event TokenDelisted(address indexed seller, address indexed tokenContract, uint256 indexed tokenId);
	event TokenBought(address indexed buyer, address indexed tokenContract, uint256 indexed tokenId, uint256 price);
	event PaymentsWithdrawn(address indexed payee, uint256 amount);

	mapping(address => mapping(uint256 => Listing)) private _listings;

	modifier isNftOwner(
		address tokenContract,
		uint256 tokenId,
		address spender
	) {
		IERC721 nft = IERC721(tokenContract);
		if (nft.ownerOf(tokenId) != spender) {
			revert SpenderNotNftOwner(spender);
		}
		_;
	}

	modifier isListed(address tokenContract, uint256 tokenId) {
		Listing memory listing = _listings[tokenContract][tokenId];
		if (listing.price <= 0) {
			revert TokenNotListed(tokenContract, tokenId);
		}
		_;
	}

	modifier isApproved(address tokenContract, uint256 tokenId) {
		IERC721 nft = IERC721(tokenContract);
		if (nft.getApproved(tokenId) != address(this)) {
			revert OperatorNotApproved();
		}
		_;
	}

	/// @custom:oz-upgrades-unsafe-allow constructor
	constructor() {
		_disableInitializers();
	}

	function initialize() public initializer {
		OwnableUpgradeable.__Ownable_init();
		PausableUpgradeable.__Pausable_init();
		PullPaymentUpgradeable.__PullPayment_init();
	}

	function listToken(
		address tokenContract,
		uint256 tokenId,
		uint256 price
	) external isNftOwner(tokenContract, tokenId, msg.sender) isApproved(tokenContract, tokenId) {
		if (price <= 0) {
			revert PriceNotPositive(price);
		}

		Listing memory listing = _listings[tokenContract][tokenId];
		if (listing.price > 0) {
			revert TokenAlreadyListed(tokenContract, tokenId);
		}

		_listings[tokenContract][tokenId] = Listing(price, msg.sender);
		emit TokenListed(msg.sender, tokenContract, tokenId, price);
	}

	function delistToken(address tokenContract, uint256 tokenId)
		external
		isListed(tokenContract, tokenId)
		isNftOwner(tokenContract, tokenId, msg.sender)
	{
		delete _listings[tokenContract][tokenId];
		emit TokenDelisted(msg.sender, tokenContract, tokenId);
	}

	function buyToken(address tokenContract, uint256 tokenId)
		external
		payable
		whenNotPaused
		isListed(tokenContract, tokenId)
		isApproved(tokenContract, tokenId)
	{
		Listing memory listedToken = _listings[tokenContract][tokenId];
		if (listedToken.price != msg.value) {
			revert PriceMismatched(tokenContract, tokenId, msg.value);
		}

		IERC721 nft = IERC721(tokenContract);
		if (nft.ownerOf(tokenId) == msg.sender) {
			revert PurchaseForbidden(msg.sender);
		}

		super._asyncTransfer(listedToken.seller, msg.value);
		delete _listings[tokenContract][tokenId];

		nft.safeTransferFrom(listedToken.seller, msg.sender, tokenId);
		emit TokenBought(msg.sender, tokenContract, tokenId, listedToken.price);
	}

	function withdrawPayments(address payable payee) public override whenNotPaused {
		if (msg.sender != payee) {
			revert WithdrawalForbidden(msg.sender);
		}

		uint256 amount = super.payments(payee);
		super.withdrawPayments(payee);
		emit PaymentsWithdrawn(payee, amount);
	}

	function updateListing(
		address tokenContract,
		uint256 tokenId,
		uint256 newPrice
	) external isListed(tokenContract, tokenId) isNftOwner(tokenContract, tokenId, msg.sender) {
		if (newPrice == 0) {
			revert PriceNotPositive(newPrice);
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

	function getListing(address tokenContract, uint256 tokenId) external view returns (Listing memory) {
		return _listings[tokenContract][tokenId];
	}
}
