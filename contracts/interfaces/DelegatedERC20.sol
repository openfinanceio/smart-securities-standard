pragma solidity ^0.4.24;

interface DelegatedERC20 {
  function allowance(address _owner, address _spender) external view returns (uint256); 
  function transferFrom(address from, address to, uint256 value, address sender) external returns (bool); 
  function approve(address _spender, uint256 _value, address sender) external returns (bool);
  function totalSupply() external view returns (uint256);
  function balanceOf(address _owner) external view returns (uint256);
  function transfer(address _to, uint256 _value, address sender) external returns (bool);
}
