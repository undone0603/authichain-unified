// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AuthiChainProtocol
 * @dev Core smart contract for the AuthiChain ecosystem.
 * Handles Ed25519 Edge hash anchoring, NFT certification minting, 
 * and autonomous affiliate revenue splitting (80/20).
 */
contract AuthiChainProtocol is ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 private _nextTokenId;
    
    // The master treasury where 80% of revenue is routed
    address public treasuryWallet;

    // Anchor Registry: Maps Anchor ID -> Edge Hash
    mapping(uint256 => bytes32) public anchoredHashes;
    // Maps Anchor ID -> Metadata string (e.g. QRON ID or Telemetry data)
    mapping(uint256 => string) public anchorMetadata;
    
    // State Variables for Anchoring
    uint256 private _nextAnchorId;

    // Events
    event HashAnchored(uint256 indexed anchorId, bytes32 indexed edgeHash, address indexed submitter);
    event CertificateMinted(uint256 indexed tokenId, address indexed recipient, string uri);
    event RevenueSplit(address indexed affiliate, uint256 affiliateAmount, uint256 treasuryAmount);

    constructor(address initialOwner, address _treasuryWallet) 
        ERC721("AuthiChain Certificate", "QRON") 
        Ownable(initialOwner) 
    {
        treasuryWallet = _treasuryWallet;
        _nextTokenId = 1;
        _nextAnchorId = 1;
    }

    /**
     * @dev Anchors a cryptographic Edge hash to the blockchain.
     * @param edgeHash The Ed25519 signature hash to anchor.
     * @param metadata Additional metadata (e.g. QRON ID).
     * @return anchorId The ID of the newly created anchor.
     */
    function anchorHash(bytes32 edgeHash, string memory metadata) external returns (uint256) {
        uint256 anchorId = _nextAnchorId++;
        
        anchoredHashes[anchorId] = edgeHash;
        anchorMetadata[anchorId] = metadata;

        emit HashAnchored(anchorId, edgeHash, msg.sender);
        return anchorId;
    }

    /**
     * @dev Mints an NFT Certificate and handles the 80/20 revenue split.
     * Requires msg.value to be the minting price.
     * @param recipient The address receiving the NFT.
     * @param uri The metadata URI (Supabase storage link).
     * @param affiliate The address of the affiliate (if any) to receive the 20% cut.
     */
    function mintCertificateWithSplit(address recipient, string memory uri, address payable affiliate) 
        external 
        payable 
        nonReentrant 
        returns (uint256) 
    {
        require(msg.value > 0, "Minting requires payment");

        // 1. Process Revenue Split (80% Treasury, 20% Affiliate)
        uint256 amount = msg.value;
        if (affiliate != address(0) && affiliate != treasuryWallet) {
            uint256 affiliateCut = (amount * 20) / 100;
            uint256 treasuryCut = amount - affiliateCut;

            (bool successAffiliate, ) = affiliate.call{value: affiliateCut}("");
            require(successAffiliate, "Affiliate transfer failed");

            (bool successTreasury, ) = payable(treasuryWallet).call{value: treasuryCut}("");
            require(successTreasury, "Treasury transfer failed");

            emit RevenueSplit(affiliate, affiliateCut, treasuryCut);
        } else {
            // No affiliate, 100% to treasury
            (bool successTreasury, ) = payable(treasuryWallet).call{value: amount}("");
            require(successTreasury, "Treasury transfer failed");
            emit RevenueSplit(address(0), 0, amount);
        }

        // 2. Mint the NFT
        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);

        emit CertificateMinted(tokenId, recipient, uri);

        return tokenId;
    }

    /**
     * @dev Update the treasury wallet address.
     */
    function setTreasuryWallet(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid address");
        treasuryWallet = _newTreasury;
    }
}
