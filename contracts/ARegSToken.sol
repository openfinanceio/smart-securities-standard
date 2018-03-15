pragma solidity ^0.4.18;

import './RegS.sol';
import './RestrictedToken.sol';
import './zeppelin-solidity/contracts/ownership/Ownable.sol';

/// @title A token that tracks data relevant for Reg S status;
contract ARegSToken is RegS, RegSToken, RestrictedToken, Ownable {


  bool public isInternational = true;

  ///
  /// Total number of shareholders
  uint16 public shareholderCount = 0;


  function ARegSToken(uint256 supply, address restrictor_, address issuer)
    public
    {
      totalSupply_ = supply;
      restrictor = restrictor_;
      owner = issuer;
      balances[issuer] = supply;
      isInternational = isInternational_;
    }

    function issue() public onlyOwner {
      RegS(restrictor).startTrading();
    }
  /// not sure if this is entirely necessary. there is no regulation around shareholder limits, however it might be nice to keep track of.
  function shareholderCountAfter(address _from, address _to, uint256 _value)
    public
    view
    returns (uint16)
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
  function transfer(address _to, uint256 _value) public returns (bool) {

    uint16 newCount = shareholderCountAfter(msg.sender, _to, _value);

    super.transfer(_to, _value);

    if (shareholderCount != newCount)
      shareholderCount = newCount;

    return true;

  }

  ///
  /// Manage shareholder count after delegated transfer
  function transferFrom(address _from, address _to, uint256 _value)
    public
    returns (bool)
  {

    uint16 newCount = shareholderCountAfter(_from, _to, _value);

    super.transferFrom(_from, _to, _value);

    if (shareholderCount != newCount)
      shareholderCount = newCount;

    return true;

  }

}
