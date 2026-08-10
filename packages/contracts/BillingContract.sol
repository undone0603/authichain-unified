
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title BillingContract
 * @dev Handles usage tracking and billing calculations for AuthiChain
 * @notice Tracks per-product minting fees and calculates charges
 */
contract BillingContract is Ownable, Pausable {
    
    // Billing Tier for per-product fees
    enum BillingTier {
        BASIC,      // $0.50 per product
        PREMIUM,    // $2.00 per product
        ENTERPRISE  // $0.25 per product (volume discount)
    }
    
    // Billing Record
    struct BillingRecord {
        address manufacturer;
        uint256 productCount;
        BillingTier tier;
        uint256 amount; // in USD cents
        uint256 timestamp;
        uint256 billingPeriod;
        bool paid;
        string stripePaymentIntentId;
    }
    
    // Fee structure (in USD cents)
    mapping(BillingTier => uint256) public perProductFees;
    
    // Manufacturer billing records
    mapping(address => BillingRecord[]) public manufacturerBillings;
    
    // Manufacturer total minting count
    mapping(address => uint256) public manufacturerMintCount;
    
    // Manufacturer current billing tier
    mapping(address => BillingTier) public manufacturerTier;
    
    // Period billing totals
    mapping(address => mapping(uint256 => uint256)) public periodBillingTotal;
    
    // Events
    event MintingFeeCalculated(address indexed manufacturer, uint256 productCount, uint256 amount, BillingTier tier);
    event PaymentRecorded(address indexed manufacturer, uint256 amount, string stripePaymentIntentId);
    event TierUpdated(address indexed manufacturer, BillingTier newTier);
    event BillingCompleted(address indexed manufacturer, uint256 period, uint256 totalAmount);
    
    /**
     * @dev Constructor - Initialize fee structure
     */
    constructor() {
        // Set per-product fees (in USD cents)
        perProductFees[BillingTier.BASIC] = 50;       // $0.50
        perProductFees[BillingTier.PREMIUM] = 200;    // $2.00
        perProductFees[BillingTier.ENTERPRISE] = 25;  // $0.25
    }
    
    /**
     * @dev Calculate minting fee for products
     */
    function calculateMintingFee(
        address _manufacturer,
        uint256 _productCount
    ) public view returns (uint256) {
        BillingTier tier = manufacturerTier[_manufacturer];
        uint256 feePerProduct = perProductFees[tier];
        return _productCount * feePerProduct;
    }
    
    /**
     * @dev Record minting and create billing record
     */
    function recordMinting(
        address _manufacturer,
        uint256 _productCount,
        string memory _stripePaymentIntentId
    ) external onlyOwner whenNotPaused returns (uint256) {
        uint256 amount = calculateMintingFee(_manufacturer, _productCount);
        uint256 currentPeriod = getCurrentBillingPeriod();
        
        BillingRecord memory record = BillingRecord({
            manufacturer: _manufacturer,
            productCount: _productCount,
            tier: manufacturerTier[_manufacturer],
            amount: amount,
            timestamp: block.timestamp,
            billingPeriod: currentPeriod,
            paid: false,
            stripePaymentIntentId: _stripePaymentIntentId
        });
        
        manufacturerBillings[_manufacturer].push(record);
        manufacturerMintCount[_manufacturer] += _productCount;
        periodBillingTotal[_manufacturer][currentPeriod] += amount;
        
        emit MintingFeeCalculated(_manufacturer, _productCount, amount, manufacturerTier[_manufacturer]);
        
        return amount;
    }
    
    /**
     * @dev Mark billing record as paid
     */
    function markBillingPaid(
        address _manufacturer,
        uint256 _recordIndex,
        string memory _stripePaymentIntentId
    ) external onlyOwner {
        require(_recordIndex < manufacturerBillings[_manufacturer].length, "Invalid record index");
        
        BillingRecord storage record = manufacturerBillings[_manufacturer][_recordIndex];
        record.paid = true;
        record.stripePaymentIntentId = _stripePaymentIntentId;
        
        emit PaymentRecorded(_manufacturer, record.amount, _stripePaymentIntentId);
    }
    
    /**
     * @dev Update manufacturer billing tier
     */
    function updateManufacturerTier(
        address _manufacturer,
        BillingTier _newTier
    ) external onlyOwner {
        // Auto-upgrade to enterprise tier if volume > 10,000 products
        if (manufacturerMintCount[_manufacturer] >= 10000) {
            _newTier = BillingTier.ENTERPRISE;
        }
        
        manufacturerTier[_manufacturer] = _newTier;
        emit TierUpdated(_manufacturer, _newTier);
    }
    
    /**
     * @dev Get total billing for manufacturer in period
     */
    function getPeriodBilling(
        address _manufacturer,
        uint256 _period
    ) external view returns (uint256) {
        return periodBillingTotal[_manufacturer][_period];
    }
    
    /**
     * @dev Get all billing records for manufacturer
     */
    function getManufacturerBillings(
        address _manufacturer
    ) external view returns (BillingRecord[] memory) {
        return manufacturerBillings[_manufacturer];
    }
    
    /**
     * @dev Get manufacturer's total minting count
     */
    function getManufacturerMintCount(
        address _manufacturer
    ) external view returns (uint256) {
        return manufacturerMintCount[_manufacturer];
    }
    
    /**
     * @dev Calculate total unpaid billing for manufacturer
     */
    function getUnpaidBilling(address _manufacturer) external view returns (uint256) {
        uint256 unpaid = 0;
        BillingRecord[] memory records = manufacturerBillings[_manufacturer];
        
        for (uint256 i = 0; i < records.length; i++) {
            if (!records[i].paid) {
                unpaid += records[i].amount;
            }
        }
        
        return unpaid;
    }
    
    /**
     * @dev Get current billing period (months since epoch)
     */
    function getCurrentBillingPeriod() public view returns (uint256) {
        return block.timestamp / 30 days;
    }
    
    /**
     * @dev Update per-product fee (owner only)
     */
    function updatePerProductFee(BillingTier _tier, uint256 _fee) external onlyOwner {
        perProductFees[_tier] = _fee;
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
