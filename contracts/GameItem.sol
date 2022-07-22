// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { ERC721, ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

contract GameItem is ERC721URIStorage, Ownable {
	using Counters for Counters.Counter;
	Counters.Counter private _tokenIds;

	constructor() ERC721("GameItem", "ITM") {}

	function mint(address player, string memory tokenURI) public onlyOwner returns (uint256) {
		uint256 newItemId = _tokenIds.current();
		_mint(player, newItemId);
		_setTokenURI(newItemId, tokenURI);

		_tokenIds.increment();
		return newItemId;
	}
}
