pragma solidity ^0.4.18;


interface RegSToken {
  function query(address _from, address _to, uint256 _value) 
    external 
    view 
    returns 
    (uint16 nShareholdersAfter);
}
