// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AuthiChainNFT is 
    ERC721URIStorage, 
    ERC721Enumerable, 
    AccessControl, 
    Pausable,
    ReentrancyGuard 
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 private _tokenIdCounter;
    
    mapping(string => uint256) private _productIdentifierToTokenId;
    mapping(uint256 => ProductInfo) private _productInfo;
    mapping(uint256 => SupplyChainEvent[]) private _supplyChainHistory;
    mapping(address => bool) private _verifiedManufacturers;
    
    struct ProductInfo {
        string productIdentifier;
        string manufacturer;
        string model;
        string serialNumber;
        uint256 manufactureDate;
        string additionalDetails;
        bool isActive;
    }
    
    struct SupplyChainEvent {
        address actor;
        string eventType;
        string location;
        uint256 timestamp;
        string notes;
    }
    
    event ProductMinted(uint256 indexed tokenId, string productIdentifier, address indexed manufacturer, uint256 timestamp);
    event ProductDetailsUpdated(uint256 indexed tokenId, address indexed updater, uint256 timestamp);
    event SupplyChainEventAdded(uint256 indexed tokenId, string eventType, address indexed actor, uint256 timestamp);
    event ProductDeactivated(uint256 indexed tokenId, uint256 timestamp);
    event ManufacturerVerified(address indexed manufacturer, uint256 timestamp);
    event ManufacturerRevoked(address indexed manufacturer, uint256 timestamp);
    
    error ProductAlreadyExists(string productIdentifier);
    error ProductDoesNotExist(uint256 tokenId);
    error EmptyProductIdentifier();
    error UnauthorizedManufacturer(address manufacturer);
    error ProductNotActive(uint256 tokenId);
    error InvalidTokenURI();
    
    constructor() ERC721("AuthiChainProduct", "ACPT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _verifiedManufacturers[msg.sender] = true;
    }
    
    function mintProduct(
        address to,
        string memory productIdentifier,
        string memory manufacturer,
        string memory model,
        string memory serialNumber,
        string memory additionalDetails,
        string memory uri
    ) public onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        if (bytes(productIdentifier).length == 0) revert EmptyProductIdentifier();
        if (_productIdentifierToTokenId[productIdentifier] != 0) revert ProductAlreadyExists(productIdentifier);
        if (!_verifiedManufacturers[msg.sender] && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert UnauthorizedManufacturer(msg.sender);
        if (bytes(uri).length == 0) revert InvalidTokenURI();
        
        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;
        
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, uri);
        _productIdentifierToTokenId[productIdentifier] = newTokenId;
        
        _productInfo[newTokenId] = ProductInfo({
            productIdentifier: productIdentifier,
            manufacturer: manufacturer,
            model: model,
            serialNumber: serialNumber,
            manufactureDate: block.timestamp,
            additionalDetails: additionalDetails,
            isActive: true
        });
        
        _supplyChainHistory[newTokenId].push(SupplyChainEvent({
            actor: msg.sender,
            eventType: "manufactured",
            location: "",
            timestamp: block.timestamp,
            notes: "Product manufactured and registered"
        }));
        
        emit ProductMinted(newTokenId, productIdentifier, msg.sender, block.timestamp);
        return newTokenId;
    }
    
    function addSupplyChainEvent(uint256 tokenId, string memory eventType, string memory location, string memory notes) 
        public onlyRole(UPDATER_ROLE) whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        if (!_productInfo[tokenId].isActive) revert ProductNotActive(tokenId);
        
        _supplyChainHistory[tokenId].push(SupplyChainEvent({
            actor: msg.sender,
            eventType: eventType,
            location: location,
            timestamp: block.timestamp,
            notes: notes
        }));
        
        emit SupplyChainEventAdded(tokenId, eventType, msg.sender, block.timestamp);
    }
    
    function updateProductDetails(uint256 tokenId, string memory additionalDetails) 
        public onlyRole(UPDATER_ROLE) whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        _productInfo[tokenId].additionalDetails = additionalDetails;
        emit ProductDetailsUpdated(tokenId, msg.sender, block.timestamp);
    }
    
    function deactivateProduct(uint256 tokenId) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        _productInfo[tokenId].isActive = false;
        emit ProductDeactivated(tokenId, block.timestamp);
    }
    
    function verifyManufacturer(address manufacturer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _verifiedManufacturers[manufacturer] = true;
        _grantRole(MINTER_ROLE, manufacturer);
        emit ManufacturerVerified(manufacturer, block.timestamp);
    }
    
    function revokeManufacturer(address manufacturer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _verifiedManufacturers[manufacturer] = false;
        _revokeRole(MINTER_ROLE, manufacturer);
        emit ManufacturerRevoked(manufacturer, block.timestamp);
    }
    
    function getProductInfo(uint256 tokenId) public view returns (ProductInfo memory) {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        return _productInfo[tokenId];
    }
    
    function getSupplyChainHistory(uint256 tokenId) public view returns (SupplyChainEvent[] memory) {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        return _supplyChainHistory[tokenId];
    }
    
    function getTokenIdByProductIdentifier(string memory productIdentifier) public view returns (uint256) {
        return _productIdentifierToTokenId[productIdentifier];
    }
    
    function isManufacturerVerified(address manufacturer) public view returns (bool) {
        return _verifiedManufacturers[manufacturer];
    }
    
    function isProductActive(uint256 tokenId) public view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        return _productInfo[tokenId].isActive;
    }
    
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) whenNotPaused returns (address) {
        address from = _ownerOf(tokenId);
        address result = super._update(to, tokenId, auth);
        
        if (from != address(0) && to != address(0)) {
            _supplyChainHistory[tokenId].push(SupplyChainEvent({
                actor: to,
                eventType: "transferred",
                location: "",
                timestamp: block.timestamp,
                notes: "Ownership transferred"
            }));
        }
        return result;
    }
    
    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) 
        public view override(ERC721URIStorage, ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}