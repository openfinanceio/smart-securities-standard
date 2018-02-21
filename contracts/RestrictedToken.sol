pragma solidity ^0.4.17;


import './zeppelin-solidity/contracts/token/ERC20/StandardToken.sol';
import './RuleSet.sol';


///
/// @title RestrictedToken is a token with support for flexible rule-checking
contract RestrictedToken is StandardToken {

  address ruleset;

  ///
  /// @param ruleset_ The address of the contract which specifies the rules
  function RestrictedToken(address ruleset_)
    public
  {
    ruleset = ruleset_;
  }

  ///
  /// Simple implementation of restricted transfers
  function transfer(address to, uint256 value) 
    public
    returns (bool)
  {

    bytes32 callHash = keccak256(msg.data);

    // Attach the data
    RuleSet(ruleset).attachAddress(this, callHash);
    RuleSet(ruleset).attachAddress(msg.sender, callHash);
    RuleSet(ruleset).attachAddress(to, callHash);
    RuleSet(ruleset).attachUint256(balanceOf(msg.sender), callHash);
    RuleSet(ruleset).attachUint256(value, callHash);

    require(RuleSet(ruleset).test(callHash));

    bool res = super.transfer(to, value);
    return res;

  }

  ///
  /// Simple implementation of restricted delegated transfers
  function transferFrom(address from, address to, uint256 value)
    public
    returns (bool)
  {

    bytes32 callHash = keccak256(msg.data);

    // Attach the data
    RuleSet(ruleset).attachAddress(this, callHash);
    RuleSet(ruleset).attachAddress(from, callHash);
    RuleSet(ruleset).attachAddress(to, callHash);
    RuleSet(ruleset).attachUint256(balanceOf(from), callHash);
    RuleSet(ruleset).attachUint256(value, callHash);

    require(RuleSet(ruleset).test(callHash));

    bool res = super.transferFrom(from, to, value);
    return res;

  }
  
}
