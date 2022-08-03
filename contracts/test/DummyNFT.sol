// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { ERC721, ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @dev This contract is used to test interaction between any non-fungible token and relevant methods implemented on the
 * Marketplace contract.
 */
contract DummyNFT is ERC721URIStorage, Ownable {
	using Counters for Counters.Counter;
	Counters.Counter private _tokenIds;

	event TokenMinted(uint256 indexed tokenId);

	constructor() ERC721("Dummy NFT", "DNFT") {}

	function mint(address owner, string memory tokenURI) public onlyOwner {
		uint256 newTokenId = _tokenIds.current();
		_safeMint(owner, newTokenId);
		_setTokenURI(newTokenId, tokenURI);

		_tokenIds.increment();
		emit TokenMinted(newTokenId);
	}
}
