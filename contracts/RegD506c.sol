pragma solidity ^0.4.10;


import './TransferRestrictor.sol';


///
/// @title An implementation of restrictions under regulation D exemption 506 (c)
contract RegD506c is TransferRestrictor {
  function startHoldingPeriod() public;
  function registerAmlKycChecker(address _checker, address _token) public;
  function registerAccreditationChecker(address _checker, address _token) public;
}
