pragma solidity ^0.4.17;


import './zeppelin-solidity/contracts/token/ERC20/StandardToken.sol';
import './TransferRestrictor.sol';


///
/// @title RestrictedToken is a token with support for flexible rule-checking
contract RestrictedToken is StandardToken {

  address restrictor;

  ///
  /// @param restrictor_ The address of the contract which specifies the rules
  function RestrictedToken(address restrictor_)
    public
  {
    restrictor = restrictor_;
  }

  ///
  /// Simple implementation of restricted transfers
  function transfer(address to, uint256 value) 
    public
    returns (bool)
  {

    require(TransferRestrictor(restrictor).test(msg.sender, to, value, this));
    bool res = super.transfer(to, value);
    return res;

  }

  ///
  /// Simple implementation of restricted delegated transfers
  function transferFrom(address from, address to, uint256 value)
    public
    returns (bool)
  {

    require(TransferRestrictor(restrictor).test(from, to, value, this));
    bool res = super.transferFrom(from, to, value);
    return res;

  }
  
}
