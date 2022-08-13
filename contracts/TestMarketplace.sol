// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { Marketplace } from "./Marketplace.sol";
import { TestERC721 } from "./TestERC721.sol";

/**
 * @dev This auxiliary contract is used to run fuzz tests on the Marketplace contract with Echidna.
 */
contract TestMarketplace is Marketplace {
    TestERC721 private _testERC721;
    address private _tokenOwner = 0x0000000000000000000000000000000000010000;

    constructor() {
        _testERC721 = new TestERC721();

        _testERC721.mint(
            _tokenOwner,
            "https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu"
        );
    }
}
