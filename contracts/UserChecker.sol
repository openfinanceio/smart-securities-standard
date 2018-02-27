pragma solidity ^0.4.10;


interface UserChecker {
  function confirm(address _user) public returns (bool);
}
