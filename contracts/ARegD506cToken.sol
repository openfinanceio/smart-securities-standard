pragma solidity ^0.4.10;


import './interfaces/RegD506c.sol';
import './interfaces/RegD506cToken.sol';
import './RestrictedTokenLogic.sol';

///
/// @title A token that tracks data relevant for Reg D 506 c status
contract ARegD506cToken is RegD506cToken, RestrictedTokenLogic {

  ///
  /// Is the token being used to raise capital for a fund?
  bool public isFund = false;

  ///
  /// Total number of shareholders
  uint16 public shareholderCount = 0;

  ///
  /// The contract is initialized to have zero shareholders with the entire
  /// supply under the control of the contract creator
  constructor(
    uint256 supply,
    uint16 initialShareholderCount,
    bool isFund_, 
    address restrictor_,
    address capTables_
  )
    public
  {
    totalSupply_ = supply; 
    shareholderCount = initialShareholderCount;
    isFund = isFund_;

    restrictor = restrictor_;
    capTables = capTables_;
    owner = msg.sender;

    // Create the cap table
    index = ICapTables(capTables).initialize(supply, msg.sender);
  }

  ///
  /// Officially issue the security, beginning the holding period
  function issue() public onlyOwner {
    RegD506c(restrictor).startHoldingPeriod();
  }

  ///
  /// Migrate by changing the owner of the security id in CapTables to the new address
  function migrate(address newRules) public onlyOwner {
    ICapTables(capTables).migrate(index, newRules);
  }

  function query(address _from, address _to, uint256 _value) 
    public
    view
    returns (uint16 nShareholdersAfter, bool _isFund)
  {
    bool newShareholder = this.balanceOf(_to) == 0;
    bool loseShareholder = this.balanceOf(_from) == _value;

    if (newShareholder && !loseShareholder) 
      return (shareholderCount + 1, isFund);

    if (!newShareholder && loseShareholder)
      return (shareholderCount - 1, isFund);

    return (shareholderCount, isFund);
   
  }
  
  ///
  /// Manage shareholder count after transfer
  function transfer(address _to, uint256 _value, address sender) 
    public 
    returns (bool) 
  {
    (uint16 newCount,) = query(msg.sender, _to, _value);
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
    (uint16 newCount,) = query(_from, _to, _value);
    bool transferResult = super.transferFrom(_from, _to, _value, sender);
    if (transferResult && shareholderCount != newCount)
      shareholderCount = newCount;
    return transferResult;
  }

}
