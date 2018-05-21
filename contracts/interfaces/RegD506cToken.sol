pragma solidity ^0.4.10;


interface RegD506cToken {
  function query(address _from, address _to, uint256 _value) 
    external 
    view 
    returns 
    (uint16 shareholdersAfter, bool isFund);
}
