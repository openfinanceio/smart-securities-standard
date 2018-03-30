pragma solidity ^0.4.18;

import './RegS.sol';
import './RegSToken.sol';
import './UserChecker.sol';
import './zeppelin-solidity/contracts/ownership/Ownable.sol';

/// @title Implementation of RegS
contract TheRegS is RegS, Ownable {

  /// Table of AML-KYC checking contracts
  mapping(address => address) amlkycChecker;

  ///
  /// Table of accredited investor status checking contracts
  mapping(address => address) accreditationChecker;

  ///
  /// Issuance dates for securities restricted by this contract
  mapping(address => uint256) issuanceDate;

  /// Table of residency status checking contracts
  mapping(address => address) residencyChecker;
  
  ///
  /// Error codes
  enum ErrorCode {
    Ok,
    BuyerAMLKYC,
    BuyerResidency,
    SellerAMLKYC,
    SellerResidency,
    Accreditation
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

  /// Register residency checker
  function registerResidencyChecker(address _checker, address _token)
    public
  {
    require(Ownable(_token).owner() == msg.sender);
    residencyChecker[_token] = _checker;
  }

  function test(address _from, address _to, uint256 _value, address _token)
    external
    returns (uint16)
  {

    // Enforce AML KYC
    if (!amlkyc(_from, _token))
      return uint16(ErrorCode.SellerAMLKYC);
    if (!amlkyc(_to, _token))
      return uint16(ErrorCode.BuyerAMLKYC);

    // Enforce accreditation
    if (!accreditation(_to, _token))
      return uint16(ErrorCode.Accreditation);

    //enforce Residency
    if (!residency(_from, _token))
      return uint16(ErrorCode.SellerResidency);
    if (!residency(_to, _token))
      return uint16(ErrorCode.BuyerResidency);

    return uint16(ErrorCode.Ok);

  }

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

  function residency(address _user, address _token)
    internal
    returns (bool)
  {
    return UserChecker(residencyChecker[_token]).confirm(_user);
  }

}
