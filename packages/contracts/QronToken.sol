// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QRON Utility Token
 * @dev Native utility token for the AuthiChain Protocol ecosystem.
 * Used for:
 * - Authentication rewards (Autoflow)
 * - TrueMark certification fees
 * - Staking for protocol governance
 * - Community Hub access
 */
contract QronToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    
    // Roles for automated protocol actions
    mapping(address => bool) public protocolMinter;

    event MinterUpdated(address indexed minter, bool status);

    constructor(address initialOwner) 
        ERC20("QRON Utility Token", "QRON") 
        ERC20Permit("QRON Utility Token")
        Ownable(initialOwner)
    {}

    /**
     * @dev Authorize a protocol worker (e.g. character-service) to mint rewards.
     */
    function setProtocolMinter(address minter, bool status) external onlyOwner {
        protocolMinter[minter] = status;
        emit MinterUpdated(minter, status);
    }

    /**
     * @dev Mint utility rewards for verified authentications.
     */
    function mintReward(address to, uint256 amount) external {
        require(protocolMinter[msg.sender] || owner() == msg.sender, "Caller is not an authorized protocol minter");
        _mint(to, amount);
    }

    /**
     * @dev Initial supply for ecosystem liquidity and treasury.
     */
    function initialMint(address treasury, uint256 amount) external onlyOwner {
        _mint(treasury, amount);
    }
}
