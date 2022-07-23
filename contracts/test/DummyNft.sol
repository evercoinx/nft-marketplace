// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { ERC721, ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

contract DummyNft is ERC721URIStorage, Ownable {
	using Counters for Counters.Counter;
	Counters.Counter private _tokenIds;

	constructor() ERC721("Dummy NFT", "DNFT") {}

	function mint(address owner, string memory tokenURI) public onlyOwner {
		uint256 newTokenId = _tokenIds.current();
		_mint(owner, newTokenId);
		_setTokenURI(newTokenId, tokenURI);

		_tokenIds.increment();
	}
}
