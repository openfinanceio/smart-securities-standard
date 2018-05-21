pragma solidity ^0.4.10;


import './TransferRestrictor.sol';


///
/// @title Functions that tokens will need to call to configure themselves 
interface RegD506c {
  function startHoldingPeriod() external;
  function registerAmlKycChecker(address _checker, address _token) external;
  function registerAccreditationChecker(address _checker, address _token) external;
}
