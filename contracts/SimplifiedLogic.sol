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
  mapping(uint256 => TokenTransfer) public pending;
  mapping(uint256 => bool) public resolutionStatus;
  address public controller;
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
  ) public onlyFront returns (bool) 
  {
    uint256 index = nextIndex();
    pending[index] = TokenTransfer(_sender, _dest, _amount, _sender);
    emit TransferRequest(
      index,
      _sender,
      _dest,
      _amount,
      _sender
    );
  }
  function transferFrom(
    address _src,
    address _dest,
    uint256 _amount,
    address _sender
  ) public onlyFront returns (bool)
  {
    uint index = nextIndex();
    pending[index] = TokenTransfer(_src, _dest, _amount, _sender);
    emit TransferRequest(
      index,
      _src,
      _dest,
      _amount,
      _sender
    );
  }
  function resolve(
    uint256 _index,
    uint16 _code 
  ) public onlyOwner returns (bool result)
  {
    require(!resolutionStatus[_index]);
    TokenTransfer storage tfr = pending[_index];
    result = false;
    if (_code == 0) {
      result = true;
      if (tfr.spender == tfr.src) {
        // Vanilla transfer
        ICapTables(capTables).transfer(index, tfr.src, tfr.dest, tfr.amount);
      } else {
        // Requires an allowance
        require(tfr.amount <= allowed[tfr.src][tfr.spender]);
        ICapTables(capTables).transfer(index, tfr.src, tfr.dest, tfr.amount);
        allowed[tfr.src][tfr.spender] = allowed[tfr.src][tfr.spender].sub(tfr.amount);
      }
    } 
    delete pending[_index];
    resolutionStatus[_index] = true;
    emit TransferResult(_index, _code);
    return result;
  }
}
