// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @dev This contract is used to test interaction between any fungible token and relevant methods implemented on the
 * Marketplace contract.
 */
contract DummyFT is ERC20 {
	constructor(uint256 initialSupply) ERC20("Dummy FT", "DFT") {
		_mint(msg.sender, initialSupply);
	}
}
