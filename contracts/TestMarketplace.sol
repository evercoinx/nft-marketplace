// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { CountersUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import { Marketplace } from "./Marketplace.sol";

/**
 * @dev This auxiliary contract is used to run fuzz tests on the Marketplace contract with Echidna.
 */
contract TestMarketplace is Marketplace {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    function echidna_true() public pure returns (bool) {
        return true;
    }
}
