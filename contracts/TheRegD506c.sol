pragma solidity ^0.4.10;


import './RegD506c.sol';
import './RegD506cToken.sol';
import './UserChecker.sol';
import './zeppelin-solidity/contracts/ownership/Ownable.sol';


///
/// @title Implementation of RegD506c
contract TheRegD506c is RegD506c, Ownable {

  ///
  /// Table of AML-KYC checking contracts
  mapping(address => address) amlkycChecker;

  ///
  /// Table of accredited investor status checking contracts
  mapping(address => address) accreditationChecker;

  ///
  /// Issuance dates for securities restricted by this contract
  mapping(address => uint256) issuanceDate;

  ///
  /// Amount of time investors must hold the token before trading
  uint256 holdingPeriod;

  ///
  /// At deployment time the holding period can be set
  function TheRegD506c(uint256 holdingPeriod_) public {
    holdingPeriod = holdingPeriod_;
    super();
  }


  ///
  /// Register a contract to confirm AML-KYC status
  function registerAmlKycChecker(address _checker, address _token)
    public
  {
    require(Ownable(_token).owner() == msg.sender);
    amlkycChecker[_token] = _checker;
  }

  ///
  /// Register a contract to confirm accreditation status
  function registerAccreditationChecker(address _checker, address _token)
    public
  {
    require(Ownable(_token).owner() == msg.sender);
    accreditationChecker[_token] = _checker;
  }

  ///
  /// Set the start date for the holding period 
  function startHoldingPeriod() public {
    if (issuanceDate[msg.sender] == 0)
      issuanceDate[msg.sender] = now;
  }

  ///
  /// Test whether or not a token transfer is compliant
  function test(address _from, address _to, uint256 _value, address _token) 
    external 
    returns (bool) 
  {

    // Enforce holding period
    if (issuanceDate[_token] != 0) 
      require(now <= issuanceDate[_token] + holdingPeriod);

    // Enforce shareholder limits
    if (RegD506cToken(_token).isFund())
      require(RegD506cToken(_token).shareholderCountAfter(_from, _to, _value) <= 99);
    else
      require(RegD506cToken(_token).shareholderCountAfter(_from, _to, _value) <= 2000);

    // Enforce AML KYC
    require(amlkyc(_from, _token));
    require(amlkyc(_to, _token));

    // Enforce accreditation
    require(accreditation(_to, _token));

  }

  /// 
  /// Confirm AML-KYC status with the registered checker
  function amlkyc(address _user, address _token) 
    internal
    returns (bool) 
  {
    return UserChecker(amlkycChecker[_token]).confirm(_user);
  }

  ///
  /// Confirm accredited investor status with the associated checker
  function accreditation(address _user, address _token)
    internal
    returns (bool)
  {
    return UserChecker(accreditationChecker[_token]).confirm(_user);
  }

}
