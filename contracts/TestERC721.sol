// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { ERC721, ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @dev This auxiliary ERC721-compliant contract is used to test interactions with the Marketplace
 *  contract.
 */
contract TestERC721 is Ownable, ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    event TokenMinted(uint256 indexed tokenId);

    constructor() ERC721("Test ERC721", "TERC721") {}

    function mint(address owner, string memory tokenURI) public onlyOwner {
        uint256 newTokenId = _tokenIds.current();
        _safeMint(owner, newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        _tokenIds.increment();
        emit TokenMinted(newTokenId);
    }
}
