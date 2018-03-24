pragma solidity ^0.4.18;

import "./interfaces/ICapTable.sol";

/**
 * This contract handles the creation of Reg D and Reg S securities.
 */
contract SecurityIssuer {
  enum Regulation {
    RegA, // Reg A Tier 2
    RegCF,
    RegD,
    RegDFund,
    RegS
  }

  /** Address of contract that controls the cap table */
  ICapTable public capTables;

  /** Record the regulation covering the contract */
  mapping(address => Regulation) public regulation;

  // EVENTS //

  event LogSecurityDefined();
  event LogSecurityIssued();
  event LogInitialInvestorAdded();

  // CONSTRUCTOR //

  function SecurityIssuer(ICapTable capTables_) {
    capTables = capTables_;
  }

  // API //

  /** 
   * @dev Initiate development for a new security 
   * @param controller address which may allocate and issue this security
   * @param reg the type of regulation covering this security
   * @return the address of the new contract
   */
  function create(address controller, Regulation reg, uint256 supply) public returns (address) {
    emit LogSecurityDefined();
  }

  /** 
   * @dev Configure the initial cap table for the security under development.
   * @param security the address of the security to modify
   * @param investor the address of the investor receiving funds
   * @param amount the amount to allocate to this investor
   */ 
  function allocate(address security, address investor, uint256 amount) public {
    emit LogInitialInvestorAdded();
  }
  
  /**
   * @dev Create the security and set up the starting cap table.
   * @param security The index of the security being issued.
   */
  function issue(address security) public {
    emit LogSecurityIssued();
  }
}
