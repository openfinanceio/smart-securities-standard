pragma solidity ^0.4.18;

import './interfaces/RegS.sol';
import './interfaces/RegSToken.sol';
import './RestrictedTokenLogic.sol';

///
/// @title A token that tracks data relevant for Reg S status;
contract ARegSToken is RegSToken, RestrictedTokenLogic {


  ///
  /// Total number of shareholders
  uint16 public shareholderCount = 0;


  constructor(
    uint256 supply,
    address restrictor_, 
    address capTables_
  )
    public
  {
    totalSupply_ = supply; 
    restrictor = restrictor_;
    owner = msg.sender;

    capTables = capTables_;
    index = ICapTables(capTables).initialize(supply, msg.sender);
  }

  ///
  /// Migrate by changing the owner of the security id in CapTables to the new address
  function migrate(address newRules) public onlyOwner {
    ICapTables(capTables).migrate(index, newRules);
  }

  /// After 12 months a RegS security may be converted to a Reg D security if
  //it meets the requirements, so we track the number of shareholders.
  function query(address _from, address _to, uint256 _value)
    public
    view
    returns (uint16 nShareholdersAfter)
  {
    bool newShareholder = balanceOf(_to) == 0;
    bool loseShareholder = balanceOf(_from) == _value;

    if (newShareholder && !loseShareholder)
      return shareholderCount + 1;

    if (!newShareholder && loseShareholder)
      return shareholderCount - 1;

    return shareholderCount;
  }

  /// Manage shareholder count after transfer
  function transfer(address _to, uint256 _value, address sender) 
    public 
    returns 
    (bool) 
  {
    uint16 newCount = query(msg.sender, _to, _value);
    bool transferResult = super.transfer(_to, _value, sender);
    if (transferResult && shareholderCount != newCount)
        shareholderCount = newCount;
    return transferResult;
  }

  ///
  /// Manage shareholder count after delegated transfer
  function transferFrom(address _from, address _to, uint256 _value, address sender)
    public
    returns (bool)
  {
    uint16 newCount = query(_from, _to, _value);
    bool transferResult = super.transferFrom(_from, _to, _value, sender);
    if (transferResult && shareholderCount != newCount)
        shareholderCount = newCount;
    return transferResult;
  }

}
