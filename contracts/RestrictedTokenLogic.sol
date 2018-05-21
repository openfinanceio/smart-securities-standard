pragma solidity ^0.4.17;


import './DelegatedTokenLogic.sol';
import './TransferRestrictor.sol';


///
/// @title RestrictedToken is a token with support for flexible rule-checking
contract RestrictedTokenLogic is DelegatedTokenLogic {

  address restrictor;

  event TransferError(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 value,
    uint16 errorCode
  );

  ///
  /// Contracts which extend this must provided some way to migrate to a new set of rules.
  function migrate(address newRules) public;

  ///
  /// Simple implementation of restricted transfers
  function transfer(address to, uint256 value, address sender) 
    public
    returns (bool)
  {

    uint16 res = TransferRestrictor(restrictor).test(sender, to, value, this);
    if (res == 0) {
      return super.transfer(to, value, sender);
    } else {
      emit TransferError(this, sender, to, value, res);
      return false;
    }

  }

  ///
  /// Simple implementation of restricted delegated transfers
  function transferFrom(address from, address to, uint256 value, address sender)
    public
    returns (bool)
  {

    uint16 res = TransferRestrictor(restrictor).test(from, to, value, this);
    if (res == 0) {
      return super.transferFrom(from, to, value, sender);
    } else {
      emit TransferError(this, from, to, value, res);
      return false;
    }

  }
  
}
