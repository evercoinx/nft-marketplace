// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { Marketplace } from "./Marketplace.sol";

/**
 * @dev This auxiliary contract is used to test upgradeability of the Marketplace contract.
 */
contract TestMarketplaceV2 is Marketplace {
    uint256 public newProperty;

    function setNewProperty(uint256 newProperty_) external {
        newProperty = newProperty_;
    }
}
