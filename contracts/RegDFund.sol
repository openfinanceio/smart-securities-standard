pragma solidity ^0.4.17;


import './RuleSet.sol';


///
/// @title RegDFund encodes the rules for a RegD (fund) token transfer
contract RegDFund is RuleSet {

  struct TestArguments {
    address token;
    address from;
    address to;
    uint256 spenderBalance;
    uint256 value;
  }

  // Set of token holders
  mapping(address => mapping(address => bool)) tokenHolders;

  // Number of token holders
  mapping(address => uint256) holderCount;

  // Stuff we need to compute 
  mapping(bytes32 => TestArguments) testArguments;

  function attachAddress(address a, bytes32 callHash) 
    public
  {

    bytes32 callKey = keccak256(callHash, msg.sender);

    if (testArguments[callKey].token == address(0)) {
      testArguments[callKey].token = a;
      return;
    }

    if (testArguments[callKey].from == address(0)) {
      testArguments[callKey].from = a;
      return;
    }

    if (testArguments[callKey].to == address(0)) {
      testArguments[callKey].to = a;
      return;
    }

  }

  function attachUint256(uint256 x, bytes32 callHash)
    public
  {

    bytes32 callKey = keccak256(callHash, msg.sender);

    if (testArguments[callKey].spenderBalance == 0) {
      testArguments[callKey].spenderBalance = x;
      return;
    }

    testArguments[callKey].value = x;

  }
  
  function test(bytes32 callHash) 
    public
    returns (bool)
  {
    
    bytes32 callKey = keccak256(callHash, msg.sender);
    require(testArguments[callKey].token != address(0));

    TestArguments storage args = testArguments[callKey];

    // Number of shareholders does not increase
    if (tokenHolders[args.token][args.to]
       || holderCount[args.token] < 99) {
    
      // Add the recipient if need be
      if (!tokenHolders[args.token][args.to]) {
         tokenHolders[args.token][args.to] = true;
         holderCount[args.token] += 1;
      }

      if (args.spenderBalance == args.value) {
        // Remove the spender
        tokenHolders[args.token][args.from] = false;
      }

      return true;

    }

    return false;
    
  }

}
