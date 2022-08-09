// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { CountersUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import { Marketplace } from "./Marketplace.sol";

/**
 * @dev This auxiliary contract is used to run fuzz tests with the Echidna fuzzer.
 */
contract TestMarketplace is Marketplace {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    constructor() {}

    function echidna_true() public view returns (bool) {
        return true;
    }
}
