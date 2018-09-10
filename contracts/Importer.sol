pragma solidity ^0.4.24;

import { ICapTables } from "./interfaces/ICapTables.sol";
import { Ownable } from "./zeppelin-solidity/contracts/ownership/Ownable.sol";
import { ERC20 } from "./zeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/** @title Convert tokens to S3 */
contract Importer is Ownable {

  /* PARAMETERS */

  address public capTables;
  address public sourceToken;
  uint256 public securityId;

  /* EVENTS */

  event Import(address src, uint256 amount);

  /* CONSTRUCTOR */

  constructor(address capTables_, address sourceToken_) Ownable() public {
    capTables = capTables_;
    sourceToken = sourceToken_;
    uint256 supply = ERC20(sourceToken_).totalSupply();
    securityId = ICapTables(capTables_).initialize(supply, this);
  }

  /* API */

  /** 
    * @dev Accept the old token and credit in new tokens.  Note that old tokens
    * can never be spent from this contract. 
    */
  function importToken(address src, uint256 amount) public {
    ERC20(sourceToken).transferFrom(src, this, amount);
    ICapTables(capTables).transfer(securityId, this, src, amount);
    emit Import(src, amount);
  }

  /** 
    * @dev Transfer control over the cap table to the new token contract 
    */
  function migrate(address destToken) public onlyOwner {
    ICapTables(capTables).migrate(securityId, destToken);
  }

}
