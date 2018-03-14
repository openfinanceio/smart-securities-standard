pragma solidity ^0.4.18;

import './RegS.sol';
import './RestrictedToken.sol';
import './zeppelin-solidity/contracts/ownership/Ownable.sol';

/// @title A token that tracks data relevant for Reg S status;
contract ARegSToken is RegS, RestrictedToken, Ownable {

}
