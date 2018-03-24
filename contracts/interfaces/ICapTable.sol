pragma solidity ^0.4.18;

interface CapTables {
  function initialize(uint256 supply) public returns (uint256);
  function migrate(uint256 security, address newAddress) public;
  function transfer(uint256 security, address src, address dest, uint256 amount) public;
}
