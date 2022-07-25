// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { PullPayment } from "@openzeppelin/contracts/security/PullPayment.sol";

error OperatorNotApproved();
error OwnerNotAllowed(address owner);
error SpenderNotAllowed(address spender);
error WithdrawalNotAllowed(address spender);
error TokenAlreadyListed(address tokenContract, uint256 tokenId);
error TokenNotListed(address tokenContract, uint256 tokenId);
error PriceNotPositive(uint256 price);
error PriceNotMatched(address tokenContract, uint256 tokenId, uint256 price);

contract Marketplace is PullPayment {
	struct Listing {
		uint256 price;
		address seller;
	}

	event TokenListed(address indexed seller, address indexed tokenContract, uint256 indexed tokenId, uint256 price);
	event TokenDelisted(address indexed seller, address indexed tokenContract, uint256 indexed tokenId);
	event TokenBought(address indexed buyer, address indexed tokenContract, uint256 indexed tokenId, uint256 price);
	event PaymentsWithdrawn(address indexed payee, uint256 amount);

	mapping(address => mapping(uint256 => Listing)) private _listings;

	modifier isOwner(
		address tokenContract,
		uint256 tokenId,
		address spender
	) {
		IERC721 nft = IERC721(tokenContract);
		address owner = nft.ownerOf(tokenId);
		if (spender != owner) {
			revert SpenderNotAllowed(spender);
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

	function listToken(
		address tokenContract,
		uint256 tokenId,
		uint256 price
	) external isOwner(tokenContract, tokenId, msg.sender) isApproved(tokenContract, tokenId) {
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
		isOwner(tokenContract, tokenId, msg.sender)
	{
		delete _listings[tokenContract][tokenId];
		emit TokenDelisted(msg.sender, tokenContract, tokenId);
	}

	function buyToken(address tokenContract, uint256 tokenId)
		external
		payable
		isListed(tokenContract, tokenId)
		isApproved(tokenContract, tokenId)
	{
		Listing memory listedToken = _listings[tokenContract][tokenId];
		if (listedToken.price != msg.value) {
			revert PriceNotMatched(tokenContract, tokenId, msg.value);
		}

		IERC721 nft = IERC721(tokenContract);
		address owner = nft.ownerOf(tokenId);
		if (msg.sender == owner) {
			revert OwnerNotAllowed(owner);
		}

		super._asyncTransfer(listedToken.seller, msg.value);
		delete _listings[tokenContract][tokenId];

		nft.safeTransferFrom(listedToken.seller, msg.sender, tokenId);
		emit TokenBought(msg.sender, tokenContract, tokenId, listedToken.price);
	}

	function withdrawPayments(address payable payee) public override {
		if (msg.sender != payee) {
			revert WithdrawalNotAllowed(msg.sender);
		}

		uint256 amount = super.payments(payee);
		super.withdrawPayments(payee);
		emit PaymentsWithdrawn(payee, amount);
	}

	function updateListing(
		address tokenContract,
		uint256 tokenId,
		uint256 newPrice
	) external isListed(tokenContract, tokenId) isOwner(tokenContract, tokenId, msg.sender) {
		if (newPrice == 0) {
			revert PriceNotPositive(newPrice);
		}

		_listings[tokenContract][tokenId].price = newPrice;
		emit TokenListed(msg.sender, tokenContract, tokenId, newPrice);
	}

	function getListing(address tokenContract, uint256 tokenId) external view returns (Listing memory) {
		return _listings[tokenContract][tokenId];
	}
}
