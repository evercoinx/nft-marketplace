// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { Marketplace } from "../Marketplace.sol";

/**
 * @dev This contract is used to test upgradeability of the base Marketplace contract.
 */
contract MarketplaceUpgraded is Marketplace {
	uint256 public newProperty;

	function setNewProperty(uint256 newProperty_) external {
		newProperty = newProperty_;
	}
}
