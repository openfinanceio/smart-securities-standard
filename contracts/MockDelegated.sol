pragma solidity ^0.4.21;

import { DelegatedTokenLogic } from "./DelegatedTokenLogic.sol";

contract MockDelegated is DelegatedTokenLogic {
  constructor(address _capTables, uint256 _index) public {
    capTables = _capTables;
    index = _index;
  }
}
