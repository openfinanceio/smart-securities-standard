pragma solidity ^0.4.10;

interface DelegatedERC20 {
  function allowance(address owner, address spender, address sender) external view returns (uint256); 
  function transferFrom(address from, address to, uint256 value, address sender) external returns (bool); 
  function approve(address spender, uint256 value, address sender) external returns (bool);
  function totalSupply() external view returns (uint256);
  function balanceOf(address who) external view returns (uint256);
  function transfer(address to, uint256 value, address sender) external returns (bool);
}
