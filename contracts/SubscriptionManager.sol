
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SubscriptionManager
 * @dev Manages AuthiChain subscription tiers and billing on Polygon
 * @notice Handles manufacturer subscriptions, usage tracking, and billing periods
 */
contract SubscriptionManager is Ownable, Pausable, ReentrancyGuard {
    
    // Subscription Tiers
    enum SubscriptionTier {
        FREE,      // 100 products trial
        STARTER,   // $299/month - 1,000 products
        PROFESSIONAL, // $999/month - 10,000 products
        BUSINESS,  // $1,999/month - 50,000 products
        ENTERPRISE, // Custom - Unlimited
        ULTIMATE   // $4,999/month - Unlimited + premium features
    }
    
    // Subscription Status
    enum SubscriptionStatus {
        INACTIVE,
        ACTIVE,
        SUSPENDED,
        CANCELLED,
        TRIAL
    }
    
    // Subscription Data Structure
    struct Subscription {
        address manufacturer;
        SubscriptionTier tier;
        SubscriptionStatus status;
        uint256 startDate;
        uint256 expiryDate;
        uint256 productsAllowed;
        uint256 productsUsed;
        uint256 billingPeriod; // Monthly period number
        bool autoRenew;
        string stripeSubscriptionId;
    }
    
    // Pricing in USD cents (to avoid decimals)
    mapping(SubscriptionTier => uint256) public tierPricing;
    
    // Product limits per tier
    mapping(SubscriptionTier => uint256) public tierLimits;
    
    // Manufacturer subscriptions
    mapping(address => Subscription) public subscriptions;
    
    // Usage tracking per billing period
    mapping(address => mapping(uint256 => uint256)) public periodUsage;
    
    // Events
    event SubscriptionCreated(address indexed manufacturer, SubscriptionTier tier, uint256 expiryDate);
    event SubscriptionRenewed(address indexed manufacturer, SubscriptionTier tier, uint256 newExpiryDate);
    event SubscriptionUpgraded(address indexed manufacturer, SubscriptionTier fromTier, SubscriptionTier toTier);
    event SubscriptionCancelled(address indexed manufacturer);
    event UsageRecorded(address indexed manufacturer, uint256 count, uint256 period);
    event OverageCharged(address indexed manufacturer, uint256 amount, uint256 period);
    
    /**
     * @dev Constructor - Initialize subscription tiers and pricing
     */
    constructor() {
        // Set tier pricing (in USD cents)
        tierPricing[SubscriptionTier.FREE] = 0;
        tierPricing[SubscriptionTier.STARTER] = 29900;      // $299
        tierPricing[SubscriptionTier.PROFESSIONAL] = 99900; // $999
        tierPricing[SubscriptionTier.BUSINESS] = 199900;    // $1,999
        tierPricing[SubscriptionTier.ENTERPRISE] = 0;       // Custom pricing
        tierPricing[SubscriptionTier.ULTIMATE] = 499900;    // $4,999
        
        // Set product limits
        tierLimits[SubscriptionTier.FREE] = 100;
        tierLimits[SubscriptionTier.STARTER] = 1000;
        tierLimits[SubscriptionTier.PROFESSIONAL] = 10000;
        tierLimits[SubscriptionTier.BUSINESS] = 50000;
        tierLimits[SubscriptionTier.ENTERPRISE] = type(uint256).max;
        tierLimits[SubscriptionTier.ULTIMATE] = type(uint256).max;
    }
    
    /**
     * @dev Create a new subscription
     */
    function createSubscription(
        address _manufacturer,
        SubscriptionTier _tier,
        string memory _stripeSubscriptionId
    ) external onlyOwner whenNotPaused {
        require(subscriptions[_manufacturer].status == SubscriptionStatus.INACTIVE, "Subscription already exists");
        
        uint256 duration = 30 days;
        uint256 expiryDate = block.timestamp + duration;
        
        subscriptions[_manufacturer] = Subscription({
            manufacturer: _manufacturer,
            tier: _tier,
            status: _tier == SubscriptionTier.FREE ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
            startDate: block.timestamp,
            expiryDate: expiryDate,
            productsAllowed: tierLimits[_tier],
            productsUsed: 0,
            billingPeriod: getCurrentBillingPeriod(),
            autoRenew: true,
            stripeSubscriptionId: _stripeSubscriptionId
        });
        
        emit SubscriptionCreated(_manufacturer, _tier, expiryDate);
    }
    
    /**
     * @dev Renew an existing subscription
     */
    function renewSubscription(address _manufacturer) external onlyOwner whenNotPaused {
        Subscription storage sub = subscriptions[_manufacturer];
        require(sub.status != SubscriptionStatus.INACTIVE, "No active subscription");
        require(sub.autoRenew, "Auto-renew disabled");
        
        uint256 newExpiryDate = sub.expiryDate + 30 days;
        sub.expiryDate = newExpiryDate;
        sub.productsUsed = 0; // Reset usage for new period
        sub.billingPeriod = getCurrentBillingPeriod();
        
        emit SubscriptionRenewed(_manufacturer, sub.tier, newExpiryDate);
    }
    
    /**
     * @dev Upgrade subscription tier
     */
    function upgradeSubscription(
        address _manufacturer,
        SubscriptionTier _newTier
    ) external onlyOwner whenNotPaused {
        Subscription storage sub = subscriptions[_manufacturer];
        require(sub.status != SubscriptionStatus.INACTIVE, "No active subscription");
        require(_newTier > sub.tier, "Can only upgrade to higher tier");
        
        SubscriptionTier oldTier = sub.tier;
        sub.tier = _newTier;
        sub.productsAllowed = tierLimits[_newTier];
        sub.status = SubscriptionStatus.ACTIVE;
        
        emit SubscriptionUpgraded(_manufacturer, oldTier, _newTier);
    }
    
    /**
     * @dev Record product minting usage
     */
    function recordUsage(address _manufacturer, uint256 _count) external onlyOwner returns (bool) {
        Subscription storage sub = subscriptions[_manufacturer];
        require(sub.status == SubscriptionStatus.ACTIVE || sub.status == SubscriptionStatus.TRIAL, "Subscription not active");
        require(block.timestamp <= sub.expiryDate, "Subscription expired");
        
        uint256 currentPeriod = getCurrentBillingPeriod();
        
        // Check if within limit
        if (sub.productsUsed + _count > sub.productsAllowed) {
            // Calculate overage
            uint256 overage = (sub.productsUsed + _count) - sub.productsAllowed;
            emit OverageCharged(_manufacturer, overage, currentPeriod);
            // In production, this would trigger Stripe billing
        }
        
        sub.productsUsed += _count;
        periodUsage[_manufacturer][currentPeriod] += _count;
        
        emit UsageRecorded(_manufacturer, _count, currentPeriod);
        return true;
    }
    
    /**
     * @dev Cancel subscription
     */
    function cancelSubscription(address _manufacturer) external {
        require(msg.sender == _manufacturer || msg.sender == owner(), "Not authorized");
        
        Subscription storage sub = subscriptions[_manufacturer];
        sub.status = SubscriptionStatus.CANCELLED;
        sub.autoRenew = false;
        
        emit SubscriptionCancelled(_manufacturer);
    }
    
    /**
     * @dev Check if manufacturer can mint products
     */
    function canMint(address _manufacturer, uint256 _count) external view returns (bool) {
        Subscription memory sub = subscriptions[_manufacturer];
        
        if (sub.status != SubscriptionStatus.ACTIVE && sub.status != SubscriptionStatus.TRIAL) {
            return false;
        }
        
        if (block.timestamp > sub.expiryDate) {
            return false;
        }
        
        // Unlimited tiers
        if (sub.tier == SubscriptionTier.ENTERPRISE || sub.tier == SubscriptionTier.ULTIMATE) {
            return true;
        }
        
        return (sub.productsUsed + _count) <= sub.productsAllowed;
    }
    
    /**
     * @dev Get current billing period (months since epoch)
     */
    function getCurrentBillingPeriod() public view returns (uint256) {
        return block.timestamp / 30 days;
    }
    
    /**
     * @dev Get subscription details
     */
    function getSubscription(address _manufacturer) external view returns (Subscription memory) {
        return subscriptions[_manufacturer];
    }
    
    /**
     * @dev Get usage for specific period
     */
    function getPeriodUsage(address _manufacturer, uint256 _period) external view returns (uint256) {
        return periodUsage[_manufacturer][_period];
    }
    
    /**
     * @dev Update tier pricing (owner only)
     */
    function updateTierPricing(SubscriptionTier _tier, uint256 _price) external onlyOwner {
        tierPricing[_tier] = _price;
    }
    
    /**
     * @dev Update tier limits (owner only)
     */
    function updateTierLimit(SubscriptionTier _tier, uint256 _limit) external onlyOwner {
        tierLimits[_tier] = _limit;
    }
    
    /**
     * @dev Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
