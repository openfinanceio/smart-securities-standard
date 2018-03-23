pragma solidity ^0.4.18;

/**
 * This contract handles the creation of Reg D and Reg S securities.
 */
contract SecurityIssuer {
  enum Regulation {
    RegD99,
    RegD2K,
    RegS
  }

  /** Records the initial investors in the security */
  mapping(address => mapping(address => uint256)) public initialInvestors;

  /** Record the regulation covering the contract */
  mapping(address => Regulation) public regulation;

  // EVENTS //

  event LogSecurityDefined();
  event LogSecurityIssued();
  event LogInitialInvestorAdded();

  /** 
   * @dev Initiate development for a new security 
   * @param controller address which may allocate and issue this security
   * @param reg the type of regulation covering this security
   * @return the address of the new contract
   */
  function define(address controller, Regulation reg) public returns (address) {
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
   * @param securityIndex The index of the security being issued.
   */
  function issue(address security) public {
    emit LogSecurityIssued();
  }
}
