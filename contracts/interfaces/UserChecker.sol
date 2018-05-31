pragma solidity ^0.4.10;


interface UserChecker {
  function confirmed(address _user) external view returns (bool);
}
