// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CounterfeitBounty
 * @dev Brands escrow a bounty against one of their certificates. The arbiter
 * (owner) pays it to a claimant who proved a counterfeit, inside the bounty
 * window; after the window the brand gets it back.
 *
 * What this contract does NOT establish: that a counterfeit was proven. The
 * arbiter still decides. A claim must commit to an evidence digest (e.g. the
 * sha256 of the AuthiChain verification record), which is emitted so the
 * decision is auditable, but nothing here verifies it on-chain. Binding claims
 * to a verifiable AuthiChain decision needs an on-chain verifier or oracle.
 *
 * Hardening (test/CounterfeitBounty.test.ts pins each one):
 * - Bounties are namespaced by brand: nobody can squat another brand's certificate.
 * - SafeERC20 everywhere; a token that returns false cannot fake a lock or a payout.
 * - The amount recorded is what actually arrived (fee-on-transfer stays solvent).
 * - Windows are 7..3650 days, so a bounty is a real commitment.
 * - Claims only inside the window, never to the arbiter or the brand, never without evidence.
 * - Two-step ownership transfer; renouncing is disabled because escrows need an arbiter.
 * - A settled certificate can be locked again.
 */
contract CounterfeitBounty is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_DURATION_DAYS = 7;
    uint256 public constant MAX_DURATION_DAYS = 3650;

    struct Bounty {
        address brand;
        address token;
        uint256 amount;
        uint64 expiry;
        bool claimed;
        bool released;
    }

    /// bountyKey(brand, certificateNumber) => Bounty
    mapping(bytes32 => Bounty) public bounties;

    event BountyLocked(
        string certificateNumber,
        address indexed brand,
        address indexed token,
        uint256 amount,
        uint64 expiry
    );
    event BountyClaimed(
        string certificateNumber,
        address indexed brand,
        address indexed claimant,
        uint256 amount,
        bytes32 evidenceDigest
    );
    event BountyReleased(string certificateNumber, address indexed brand, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function bountyKey(address brand, string calldata certificateNumber) public pure returns (bytes32) {
        return keccak256(abi.encode(brand, certificateNumber));
    }

    function getBounty(address brand, string calldata certificateNumber) external view returns (Bounty memory) {
        return bounties[bountyKey(brand, certificateNumber)];
    }

    /**
     * @dev Lock a bounty for one of the caller's certificates.
     */
    function lockBounty(
        string calldata certificateNumber,
        address token,
        uint256 amount,
        uint256 durationDays
    ) external nonReentrant {
        require(bytes(certificateNumber).length > 0, "Certificate required");
        require(amount > 0, "Amount must be > 0");
        require(
            durationDays >= MIN_DURATION_DAYS && durationDays <= MAX_DURATION_DAYS,
            "Duration out of range"
        );
        bytes32 key = bountyKey(msg.sender, certificateNumber);
        Bounty storage existing = bounties[key];
        require(existing.amount == 0 || existing.claimed || existing.released, "Bounty already exists");

        IERC20 erc20 = IERC20(token);
        uint256 before = erc20.balanceOf(address(this));
        erc20.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = erc20.balanceOf(address(this)) - before;
        require(received > 0, "Nothing received");

        uint64 expiry = uint64(block.timestamp + durationDays * 1 days);
        bounties[key] = Bounty({
            brand: msg.sender,
            token: token,
            amount: received,
            expiry: expiry,
            claimed: false,
            released: false
        });

        emit BountyLocked(certificateNumber, msg.sender, token, received, expiry);
    }

    /**
     * @dev Arbiter pays the bounty to a claimant who proved a counterfeit.
     * `evidenceDigest` commits to the evidence the decision rests on.
     */
    function claimBounty(
        address brand,
        string calldata certificateNumber,
        address claimant,
        bytes32 evidenceDigest
    ) external onlyOwner nonReentrant {
        Bounty storage bounty = bounties[bountyKey(brand, certificateNumber)];
        require(bounty.amount > 0, "No bounty");
        require(!bounty.claimed && !bounty.released, "Already settled");
        require(block.timestamp < bounty.expiry, "Bounty expired");
        require(evidenceDigest != bytes32(0), "Evidence required");
        require(
            claimant != address(0) && claimant != owner() && claimant != bounty.brand,
            "Invalid claimant"
        );

        bounty.claimed = true;
        IERC20(bounty.token).safeTransfer(claimant, bounty.amount);

        emit BountyClaimed(certificateNumber, brand, claimant, bounty.amount, evidenceDigest);
    }

    /**
     * @dev Return the bounty to its brand once the window has closed. Anyone may trigger it.
     */
    function releaseBounty(address brand, string calldata certificateNumber) external nonReentrant {
        Bounty storage bounty = bounties[bountyKey(brand, certificateNumber)];
        require(bounty.amount > 0, "No bounty");
        require(!bounty.claimed && !bounty.released, "Already settled");
        require(block.timestamp >= bounty.expiry, "Not expired yet");

        bounty.released = true;
        IERC20(bounty.token).safeTransfer(bounty.brand, bounty.amount);

        emit BountyReleased(certificateNumber, bounty.brand, bounty.amount);
    }

    /// Escrows always need an arbiter, so ownership can be handed over (two-step) but never dropped.
    function renounceOwnership() public view override onlyOwner {
        revert("Renounce disabled");
    }
}
