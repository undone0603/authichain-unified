// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CounterfeitBounty
 * @dev Finanically incentivised trust layer for AuthiChain.
 * Brands lock a bounty for their products. Consumers can claim it if they prove a counterfeit.
 */
contract CounterfeitBounty is Ownable {
    
    struct Bounty {
        address brand;
        uint256 amount;
        address token; // USDC or $QRON
        bool claimed;
        bool released;
        uint256 expiry;
    }

    mapping(string => Bounty) public productBounties; // certificateNumber => Bounty
    
    event BountyLocked(string certificateNumber, address brand, uint256 amount, address token);
    event BountyClaimed(string certificateNumber, address claimant, uint256 amount);
    event BountyReleased(string certificateNumber, address brand, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Lock a bounty for a certificate.
     */
    function lockBounty(
        string memory _certificateNumber, 
        address _token, 
        uint256 _amount, 
        uint256 _durationDays
    ) external {
        require(productBounties[_certificateNumber].amount == 0, "Bounty already exists");
        require(_amount > 0, "Amount must be > 0");

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);

        productBounties[_certificateNumber] = Bounty({
            brand: msg.sender,
            amount: _amount,
            token: _token,
            claimed: false,
            released: false,
            expiry: block.timestamp + (_durationDays * 1 days)
        });

        emit BountyLocked(_certificateNumber, msg.sender, _amount, _token);
    }

    /**
     * @dev Claim bounty. Requires 5-agent AI consensus or Admin proof of counterfeit.
     * In a production environment, this would be triggered by an Oracle or the AuthiChain Admin.
     */
    function claimBounty(string memory _certificateNumber, address _claimant) external onlyOwner {
        Bounty storage bounty = productBounties[_certificateNumber];
        require(bounty.amount > 0, "No bounty");
        require(!bounty.claimed && !bounty.released, "Already settled");

        bounty.claimed = true;
        IERC20(bounty.token).transfer(_claimant, bounty.amount);

        emit BountyClaimed(_certificateNumber, _claimant, bounty.amount);
    }

    /**
     * @dev Release bounty back to brand after expiry.
     */
    function releaseBounty(string memory _certificateNumber) external {
        Bounty storage bounty = productBounties[_certificateNumber];
        require(bounty.amount > 0, "No bounty");
        require(!bounty.claimed && !bounty.released, "Already settled");
        require(block.timestamp >= bounty.expiry, "Not expired yet");

        bounty.released = true;
        IERC20(bounty.token).transfer(bounty.brand, bounty.amount);

        emit BountyReleased(_certificateNumber, bounty.brand, bounty.amount);
    }
}
