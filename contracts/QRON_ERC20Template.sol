// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/*

                                                                                                    
                    &&&&&& &&&&&                                        &%                          
                     &&&&&&&&&&&&&&&                               && &&&&&&&&&&%                   
                     &&&&&&&      &&&&&                          #&&&&&&&&&&&&&                     
                     &&&&&  &&&&&&&   &&                      &&&&    &%  &&&&&&&                   
                        &&. &&&&&&&&&&                        &  %&&&&&&&  &&&&                     
                        &&&&  *&&&&&&&&&                       &&&&&&&&&  &&&&                      
                           .&&&   &&&&&&&&                   &&&&&&&&   &&&                         
                                    .&&&&&&&               &&&&&&&   &&&%                           
                                       &&&&&&             &&&&&&                                    
                                         &&&&&          /&&&&.                                      
                                           &&&&  %&&&  #&&&,                                        
                                   &&&&(     &&&&&&&&&&&&&                                          
                               &&&&&&&&&&&&&&&&&&&&&&&&&&&&   &&&&&&&&&&                            
                             &&&%        &&&&&&&&&&&&&&&&&&&&&&&&&     &&&                          
                            &&&    &&&*    &&&&&&&&&&&&&&&&&&&&&         &&*                        
                           &&&   .&&&&&&   &&&&&&&&&&&&&&&&&&&&   &&&&&   &&                        
                           &&&   #&&&&&&   &&&&&&&&&&&&&&&&&&&&&  &&&&&   &&                        
                            &&&    &&&&    &&&&&&&&&&&&&&&&&&&&&&  #&&   &&&                        
                             &&&         &&&&&&&&&&&&&&&&&&&&&&&&,     *&&&                         
                              (&&&&&&&&&&&&&&&&&&&&          &&&&&&&&&&&%                           
                                  &&&&&&&&&&&&&&&&&          &&&&&                                  
                                    &&&&&&&&&&&&&&&&&&    %&&&&&&&                                  
                                    &&&&&&&&&&&&&&&&&&&&&&&&&&&&&&#                                 
                                      &&&&&&&&&&&&&&&&&&&&&&&&&&&&                                  
                                           &&&&&&&&&&&&&&&&&&&&                                     

*/
/**
 * ERC20Template contract
 */

/// @author Smithii

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Secured} from "../../utils/Secured.sol";
import {Shallowed} from "../../utils/Shallowed.sol";

contract ERC20Template is
    ERC20,
    ERC20Burnable,
    Pausable,
    Ownable,
    Secured,
    Shallowed
{
    uint256 public constant DECIMALS = 1 * 10 ** 18;
    uint256 public initialSupply = 0;
    uint256 public taxFee = 0; // 0 - 100 % tax fee
    address public taxAddress = address(0);
    bool public isAirdrop = false;

    mapping(address => bool) public blackList;
    mapping(address => bool) public noTaxable;

    /// Errors

    error InvalidInitialSupply();
    error InvalidTaxFee();
    error BlacklistedAddress(address _address);

    constructor(
        string memory name,
        string memory symbol,
        address _owner,
        address _taxAddress,
        address _antiBot,
        address _antiWhale,
        uint256 _initialSupply,
        uint256 _taxFee,
        bool _isAirdrop,
        address[] memory globalExemptions,
        address[] memory globalSenderExemptions 
    )
        ERC20(name, symbol)
        Ownable(_owner)
        Secured(_antiBot)
        Shallowed(_antiWhale)
    {
        if (_initialSupply <= 0) revert InvalidInitialSupply();
        if (_taxFee > 20) revert InvalidTaxFee();

        initialSupply = _initialSupply * DECIMALS;
        taxFee = _taxFee;
        taxAddress = _taxAddress;
        noTaxable[_owner] = true;
        noTaxable[address(0)] = true;
        if (_isAirdrop) isAirdrop = true;
        ///@dev contracts from smithii that need to be removed from the tax,Antibot and Antiwhale
        for(uint i = 0; i < globalExemptions.length; i++) {
            noTaxable[globalExemptions[i]] = true;
        }
        _setAntiBotExemptions(globalExemptions);
        _setAntiWhaleExemptions(globalExemptions);
        _setAntiWhaleSenderExemptions(globalSenderExemptions);
        _mint(_owner, initialSupply);
    }
    /// Exclude the address from the tax
    /// @param _address the target address
    /// @param _taxable is the address not taxable
    function setNotTaxable(address _address, bool _taxable) external onlyOwner {
        noTaxable[_address] = _taxable;
    }
    /// BLacklist the address
    /// @param _address the target address
    /// @param _blackList is in the black list
    function setBlackList(
        address _address,
        bool _blackList
    ) external onlyOwner {
        blackList[_address] = _blackList;
    }
    /// Address to receive the tax
    /// @param _taxAddress the address to receive the tax
    function setTaxAddress(address _taxAddress) external onlyOwner {
        taxAddress = _taxAddress;
        noTaxable[_taxAddress] = true;
    }
    /// relesae the airdrop mode
    /// @dev set the airdrop mode to false only once
    function releaseAirdropMode() external onlyOwner {
        isAirdrop = false;
    }
    /// release the global exemption
    /// @param _address the address to set as global exemption
    function releaseAntibotGlobalExemption(address _address) external onlyOwner {
        antiBotExemptions[_address] = false;
    }
    /// release the global exemption
    /// @param _address the address to set as global exemption
    function releaseAntiwhaleGlobalExemption(address _address) external onlyOwner {
        antiWhaleExemptions[_address] = false;
    }
    /// get the global exemption status
    /// @param _address the address to check
    function isAntibotGlobalExemption(address _address) external view returns(bool) {
        return antiBotExemptions[_address];
    }
    /// get the global exemption status
    /// @param _address the address to check
    function isAntiwhaleGlobalExemption(address _address) external view returns(bool) {
        return antiWhaleExemptions[_address];
    }
    /// @inheritdoc ERC20
    function _update(
        address sender,
        address recipient,
        uint256 amount
    )
        internal
        virtual
        override
        whenNotPaused
        noBots(sender)
        noWhales(recipient, amount)
    {
        registerBlock(recipient);
        registerBlockTimeStamp(sender);
        if (isAirdrop) {
            if (!noTaxable[sender]) revert("Airdrop mode is enabled");
        }
        /// @dev the tx is charged based on the sender
        if (blackList[sender]) revert BlacklistedAddress(sender);
        if (blackList[recipient]) revert BlacklistedAddress(recipient);
        uint tax = 0;
        if (!noTaxable[sender]) {
            tax = (amount / 100) * taxFee; // % tax
            super._update(sender, taxAddress, tax);
        }
        super._update(sender, recipient, amount - tax);
    }
    /// BEP compatible
    function getOwner() external view returns (address) {
        return owner();
    }
}
