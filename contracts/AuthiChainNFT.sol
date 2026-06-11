// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AuthiChainNFT is ERC721, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 private _nextTokenId = 1;

    mapping(string => uint256) private _productIdentifierToTokenId;
    mapping(uint256 => ProductInfo) private _productInfo;
    mapping(uint256 => SupplyChainEvent[]) private _supplyChainHistory;
    mapping(uint256 => string) private _tokenURIs;
    mapping(address => bool) private _verifiedManufacturers;

    struct ProductInfo {
        string productIdentifier;
        string manufacturer;
        string model;
        string serialNumber;
        uint64 manufactureBlock;
        string additionalDetails;
        bool isActive;
    }

    struct SupplyChainEvent {
        address actor;
        string eventType;
        string location;
        uint64 blockNumber;
        string notes;
    }

    event ProductMinted(uint256 indexed tokenId, string productIdentifier, address indexed manufacturer, uint64 blockNumber);
    event ProductDetailsUpdated(uint256 indexed tokenId, address indexed updater, uint64 blockNumber);
    event SupplyChainEventAdded(uint256 indexed tokenId, string eventType, address indexed actor, uint64 blockNumber);
    event ProductDeactivated(uint256 indexed tokenId, uint64 blockNumber);
    event ManufacturerVerified(address indexed manufacturer, uint64 blockNumber);
    event ManufacturerRevoked(address indexed manufacturer, uint64 blockNumber);
    event TokenURIUpdated(uint256 indexed tokenId, string uri);

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

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        _productIdentifierToTokenId[productIdentifier] = tokenId;

        uint64 bn = uint64(block.number);
        _productInfo[tokenId] = ProductInfo({
            productIdentifier: productIdentifier,
            manufacturer: manufacturer,
            model: model,
            serialNumber: serialNumber,
            manufactureBlock: bn,
            additionalDetails: additionalDetails,
            isActive: true
        });

        _supplyChainHistory[tokenId].push(SupplyChainEvent({
            actor: msg.sender,
            eventType: "manufactured",
            location: "",
            blockNumber: bn,
            notes: "Product manufactured and registered"
        }));

        emit ProductMinted(tokenId, productIdentifier, msg.sender, bn);
        return tokenId;
    }

    function addSupplyChainEvent(
        uint256 tokenId,
        string memory eventType,
        string memory location,
        string memory notes
    ) public onlyRole(UPDATER_ROLE) whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        if (!_productInfo[tokenId].isActive) revert ProductNotActive(tokenId);

        uint64 bn = uint64(block.number);
        _supplyChainHistory[tokenId].push(SupplyChainEvent({
            actor: msg.sender,
            eventType: eventType,
            location: location,
            blockNumber: bn,
            notes: notes
        }));

        emit SupplyChainEventAdded(tokenId, eventType, msg.sender, bn);
    }

    function updateProductDetails(uint256 tokenId, string memory additionalDetails) public onlyRole(UPDATER_ROLE) whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        _productInfo[tokenId].additionalDetails = additionalDetails;
        emit ProductDetailsUpdated(tokenId, msg.sender, uint64(block.number));
    }

    function deactivateProduct(uint256 tokenId) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        _productInfo[tokenId].isActive = false;
        emit ProductDeactivated(tokenId, uint64(block.number));
    }

    function verifyManufacturer(address manufacturer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _verifiedManufacturers[manufacturer] = true;
        _grantRole(MINTER_ROLE, manufacturer);
        emit ManufacturerVerified(manufacturer, uint64(block.number));
    }

    function revokeManufacturer(address manufacturer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _verifiedManufacturers[manufacturer] = false;
        _revokeRole(MINTER_ROLE, manufacturer);
        emit ManufacturerRevoked(manufacturer, uint64(block.number));
    }

    function getProductInfo(uint256 tokenId) public view returns (ProductInfo memory) {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        return _productInfo[tokenId];
    }

    function getSupplyChainHistory(uint256 tokenId, uint256 start, uint256 limit)
        public
        view
        returns (SupplyChainEvent[] memory events, uint256 nextIndex)
    {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);

        SupplyChainEvent[] storage history = _supplyChainHistory[tokenId];
        uint256 len = history.length;
        if (start >= len) return (new SupplyChainEvent[](0), len);

        uint256 end = start + limit;
        if (end > len) end = len;

        events = new SupplyChainEvent[](end - start);
        for (uint256 i = start; i < end; ++i) {
            events[i - start] = history[i];
        }

        return (events, end);
    }

    function getSupplyChainHistoryCount(uint256 tokenId) public view returns (uint256) {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        return _supplyChainHistory[tokenId].length;
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

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert ProductDoesNotExist(tokenId);
        string memory uri = _tokenURIs[tokenId];
        if (bytes(uri).length == 0) revert InvalidTokenURI();
        return uri;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override whenNotPaused returns (address) {
        address from = _ownerOf(tokenId);
        address result = super._update(to, tokenId, auth);

        if (from != address(0) && to != address(0)) {
            uint64 bn = uint64(block.number);
            _supplyChainHistory[tokenId].push(SupplyChainEvent({
                actor: to,
                eventType: "transferred",
                location: "",
                blockNumber: bn,
                notes: "Ownership transferred"
            }));
        }

        return result;
    }
}
