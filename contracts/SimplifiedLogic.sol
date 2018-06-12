pragma solidity ^0.4.21;

import { DelegatedTokenLogic } from "./DelegatedTokenLogic.sol";
import { IndexConsumer } from "./IndexConsumer.sol";
import { ICapTables } from "./interfaces/ICapTables.sol";
import { Ownable } from "./zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * One method for implementing a permissioned token is to appoint some
 * authority which must decide whether to approve or refuse trades.  This
 * contract implements this functionality.  
 */
contract SimplifiedLogic is IndexConsumer, DelegatedTokenLogic {
  struct TokenTransfer {
    address src;
    address dest;
    uint256 amount;
    address spender;
  }
  enum TransferStatus {
    Unused,
    Active,
    Resolved
  }
  mapping(uint256 => TokenTransfer) public pending;
  mapping(uint256 => TransferStatus) public resolutionStatus;
  address public controller;
  bool public contractActive = true;
  event TransferRequest(
    uint256 index,
    address src,
    address dest,
    uint256 amount,
    address spender
  );
  event TransferResult(
    uint256 index,
    uint16 code
  );
  modifier onlyActive () {
    require(contractActive);
    _;
  }
  constructor(
    address _controller,
    address _capTables
  ) public Ownable() {
    controller = _controller;
    capTables = _capTables;
  }
  function setController(
    address _controller
  ) public onlyOwner 
  {
    controller = _controller;
  }
  function transfer(
    address _dest,
    uint256 _amount,
    address _sender
  ) public onlyFront onlyActive returns (bool) 
  {
    uint256 txfrIndex = nextIndex();
    pending[txfrIndex] = TokenTransfer(_sender, _dest, _amount, _sender);
    resolutionStatus[txfrIndex] = TransferStatus.Active;
    emit TransferRequest(
      txfrIndex,
      _sender,
      _dest,
      _amount,
      _sender
    );
    return false; // The transfer has not taken place yet
  }
  function transferFrom(
    address _src,
    address _dest,
    uint256 _amount,
    address _sender
  ) public onlyFront onlyActive returns (bool)
  {
    require(_amount <= allowed[_src][_sender]);
    uint txfrIndex = nextIndex();
    pending[txfrIndex] = TokenTransfer(_src, _dest, _amount, _sender);
    resolutionStatus[txfrIndex] = TransferStatus.Active;
    emit TransferRequest(
      txfrIndex,
      _src,
      _dest,
      _amount,
      _sender
    );
    return false; // The transfer has not taken place yet
  }
  function resolve(
    uint256 _txfrIndex,
    uint16 _code 
  ) public onlyOwner returns (bool result)
  {
    require(resolutionStatus[_txfrIndex] == TransferStatus.Active);
    TokenTransfer storage tfr = pending[_txfrIndex];
    result = false;
    if (_code == 0) {
      result = true;
      if (tfr.spender == tfr.src) {
        // Vanilla transfer
        ICapTables(capTables).transfer(index, tfr.src, tfr.dest, tfr.amount);
      } else {
        // Requires an allowance
        ICapTables(capTables).transfer(index, tfr.src, tfr.dest, tfr.amount);
        allowed[tfr.src][tfr.spender] = allowed[tfr.src][tfr.spender].sub(tfr.amount);
      }
    } 
    delete pending[_txfrIndex];
    resolutionStatus[_txfrIndex] = TransferStatus.Resolved;
    emit TransferResult(_txfrIndex, _code);
    return result;
  }
  function migrate(
    address newLogic
  ) public onlyOwner 
  {
    contractActive = false;
    ICapTables(capTables).migrate(index, newLogic);
  }
}
