pragma solidity ^0.4.24;

import { ICapTables } from "./interfaces/ICapTables.sol";
import { Ownable } from "./zeppelin-solidity/contracts/ownership/Ownable.sol";
import { ERC20 } from "./zeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/** @title Export tokens out of S3 */
contract Exporter is Ownable {

    /* PARAMETERS */

    address public capTables;
    address public destToken;
    uint256 public securityId;

    /* EVENTS */

    event Export(address src, uint256 amount);

    /* CONSTRUCTOR */

    constructor(address capTables_, uint256 securityId_) Ownable() public {
        capTables = capTables_;
        securityId = securityId_;
    }

    /* API */

    /** @dev Transfer value from an S3 security to some other ERC20 token. */
    function export(address src, uint256 amount) public {
        require(destToken != address(0), "MUST have set the destination");
        ICapTables(capTables).transfer(securityId, src, this, amount);
        ERC20(destToken).transfer(src, amount);
        emit Export(src, amount);
    }

    /** @dev Set destination token */
    function setDestinationToken(address destToken_) public onlyOwner {
        require(destToken == address(0), "MUST NOT have set the destination yet");
        destToken = destToken_;
    }

}
