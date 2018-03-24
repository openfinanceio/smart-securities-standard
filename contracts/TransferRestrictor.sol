pragma solidity ^0.4.10;


///
/// @title An interface for restricting ERC20 token transfers
interface TransferRestrictor {
  function test(address from, address to, uint256 amount, address token) external returns (bool);
}
