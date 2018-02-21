pragma solidity ^0.4.17;


interface RuleSet {
  function attachAddress(address a, bytes32 callHash) public;
  function attachUint256(uint256 x, bytes32 callHash) public;
  function test(bytes32 callHash) public returns (bool);
}
