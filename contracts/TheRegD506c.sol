pragma solidity ^0.4.10;


import './interfaces/RegD506c.sol';
import './interfaces/RegD506cToken.sol';
import './interfaces/UserChecker.sol';
import './zeppelin-solidity/contracts/ownership/Ownable.sol';


///
/// @title Implementation of RegD506c
contract TheRegD506c is RegD506c, TransferRestrictor, Ownable() {

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
  /// Error codes
  enum ErrorCode {
    Ok,
    HoldingPeriod,
    ShareholderMaximum,
    BuyerAMLKYC,
    SellerAMLKYC,
    Accreditation
  }

  ///
  /// At deployment time the holding period can be set
  constructor(uint256 holdingPeriod_) public {
    holdingPeriod = holdingPeriod_;
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

  function checkInvariants(
    address _from,
    address _to,
    uint256 _value,
    address _token
  ) internal view returns (uint16) 
  {
    // The security cannot be transfered until after its holding period 
    if (issuanceDate[_token] != 0 && now < issuanceDate[_token] + holdingPeriod)
      return uint16(ErrorCode.HoldingPeriod);
    // Shareholder limits
    // 99 if the security is raising money for a fund and 2000 otherwise
    (uint16 newShareholderCount, bool isFund) = RegD506cToken(_token).query(_from, _to, _value);
    if ((isFund && newShareholderCount > 99) 
      || newShareholderCount > 2000)
      return uint16(ErrorCode.ShareholderMaximum);
    return uint16(ErrorCode.Ok);
  }

  function checkBuyer(
    address _to,
    address _token
  ) internal view returns (uint16)
  {
    // The buyer must pass AMLKYC
    if (!amlkyc(_to, _token))
      return uint16(ErrorCode.BuyerAMLKYC);
    // The buyer must be an accredited investor 
    if (!UserChecker(accreditationChecker[_token]).confirmed(_to))
      return uint16(ErrorCode.Accreditation);
    return uint16(ErrorCode.Ok);
  }

  ///
  /// Test whether or not a token transfer is compliant
  function test(address _from, address _to, uint256 _value, address _token) 
    external 
    returns (uint16) 
  {
    uint16 buyer = checkBuyer(_to, _token); 
    if (buyer != uint16(ErrorCode.Ok))
      return buyer;

    // The seller must pass AMLKYC 
    if (!amlkyc(_from, _token))
      return uint16(ErrorCode.SellerAMLKYC);

    uint16 invariants = checkInvariants(_from, _to, _value, _token);
    if (invariants != uint16(ErrorCode.Ok))
      return invariants;

    // All checks passed
    return uint16(ErrorCode.Ok);
  }

  /// 
  /// Confirm AML-KYC status with the registered checker
  function amlkyc(address _user, address _token) 
    internal
    view
    returns (bool) 
  {
    return UserChecker(amlkycChecker[_token]).confirmed(_user);
  }

}
