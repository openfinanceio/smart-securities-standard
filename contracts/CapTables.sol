pragma solidity ^0.4.18;

import "./IndexConsumer.sol";

/**
 * The sole purpose of this contract is to store the cap tables of securities
 * created by the OFN system.  We take the position that a security is defined
 * by its cap table and not by its transfer rules.  So a security is
 * represented by a unique integer index.
 */
contract CapTables is IndexConsumer {
  /** `capTable(security, user) == userBalance` */
  mapping(uint256 => mapping(address => uint256)) public capTable;
  /** Address of security */
  mapping(uint256 => address) public addresses;
  /** Set the  balance. */
  function set(uint256 security, address user, uint256 balance) public {
    require(msg.sender == addresses[security]);
    capTable[security][user] = balance;
  }
  /** Add a security to the contract. */
  function initialize(address security, uint256 supply) public returns (uint256) {
    require(msg.sender == security);
    uint256 index = nextIndex();
    addresses[index] = security;
    capTable[index][security] = supply;
  }
  /** Migrate a security to a new address, if its transfer restriction rules change. */
  function migrate(uint256 index, address newAddress) public {
    require(msg.sender == addresses[index]);
    addresses[index] = newAddress;
  }
}
