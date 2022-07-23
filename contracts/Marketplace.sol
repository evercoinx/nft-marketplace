// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

error NotApprovedOperator();
error NotOwner();
error PriceMustBeAboveZero();
error AlreadyListed(address tokenContract, uint256 tokenId);
error NotListed(address tokenContract, uint256 tokenId);

// error PriceNotMet(address tokenContract, uint256 tokenId, uint256 price);
// error ItemNotForSale(address tokenContract, uint256 tokenId);
// error NoProceeds();

contract Marketplace is ReentrancyGuard {
	struct Listing {
		uint256 price;
		address seller;
	}

	event ItemListed(address indexed seller, address indexed tokenContract, uint256 indexed tokenId, uint256 price);
	event TokenDelisted(address indexed seller, address indexed tokenContract, uint256 indexed tokenId);
	// event ItemBought(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 price);

	mapping(address => mapping(uint256 => Listing)) private _listings;
	// mapping(address => uint256) private _proceeds;

	modifier notListed(address tokenContract, uint256 tokenId) {
		Listing memory listing = _listings[tokenContract][tokenId];
		if (listing.price > 0) {
			revert AlreadyListed(tokenContract, tokenId);
		}
		_;
	}

	modifier isListed(address tokenContract, uint256 tokenId) {
		Listing memory listing = _listings[tokenContract][tokenId];
		if (listing.price <= 0) {
			revert NotListed(tokenContract, tokenId);
		}
		_;
	}

	modifier isOwner(
		address tokenContract,
		uint256 tokenId,
		address spender
	) {
		IERC721 nft = IERC721(tokenContract);
		address owner = nft.ownerOf(tokenId);
		if (spender != owner) {
			revert NotOwner();
		}
		_;
	}

	function listItem(
		address tokenContract,
		uint256 tokenId,
		uint256 price
	) external isOwner(tokenContract, tokenId, msg.sender) notListed(tokenContract, tokenId) {
		if (price <= 0) {
			revert PriceMustBeAboveZero();
		}

		IERC721 nft = IERC721(tokenContract);
		if (nft.getApproved(tokenId) != address(this)) {
			revert NotApprovedOperator();
		}

		_listings[tokenContract][tokenId] = Listing(price, msg.sender);
		emit ItemListed(msg.sender, tokenContract, tokenId, price);
	}

	function delistToken(address tokenContract, uint256 tokenId)
		external
		isOwner(tokenContract, tokenId, msg.sender)
		isListed(tokenContract, tokenId)
	{
		delete (_listings[tokenContract][tokenId]);
		emit TokenDelisted(msg.sender, tokenContract, tokenId);
	}

	function getListing(address tokenContract, uint256 tokenId) external view returns (Listing memory) {
		return _listings[tokenContract][tokenId];
	}
}
