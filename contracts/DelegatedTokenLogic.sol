// Variation on `StandardToken` by Open Zeppelin
pragma solidity ^0.4.21;

import { DelegatedERC20 } from "./interfaces/DelegatedERC20.sol";
import { ICapTables } from "./interfaces/ICapTables.sol";
import { SafeMath } from "./zeppelin-solidity/contracts/math/SafeMath.sol";
import { Ownable } from "./zeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title DelegatedTokenLogic empty token
 */
contract DelegatedTokenLogic is Ownable, DelegatedERC20 {
  using SafeMath for uint256;

  address public capTables;
  address public front;

  /**
  * @Dev Index of this security in the global cap table store.
  */
  uint256 public index;

  uint256 public totalSupply_;

  mapping (address => mapping (address => uint256)) internal allowed;

  modifier onlyFront() {
    require(msg.sender == front);
    _;
  }

  /**
    * @dev Set the fronting token.
    */
  function setFront(address _front) public onlyOwner {
    front = _front;
  }

  /**
  * @dev total number of tokens in existence
  */
  function totalSupply() public view returns (uint256) {
    return totalSupply_;
  }

  /**
  * @dev transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(address _to, uint256 _value, address sender) 
    public 
    onlyFront 
    returns (bool) 
  {
    require(_to != address(0));

    ICapTables(capTables).transfer(index, sender, _to, _value);
    return true;
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param _owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address _owner) public view returns (uint256 balance) {
    return ICapTables(capTables).balanceOf(index, _owner);
  }
  /**
   * @dev Transfer tokens from one address to another
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amount of tokens to be transferred
   */
  function transferFrom(address _from, address _to, uint256 _value, address sender) 
    public 
    onlyFront
    returns (bool) 
  {
    require(_to != address(0));
    require(_value <= allowed[_from][sender]);

    ICapTables(capTables).transfer(index, _from, _to, _value);
    allowed[_from][sender] = allowed[_from][sender].sub(_value);
    return true;
  }

  /**
   * @dev Approve the passed address to spend the specified amount of tokens on behalf of sender.
   *
   * Beware that changing an allowance with this method brings the risk that someone may use both the old
   * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
   * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
   * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens to be spent.
   */
  function approve(address _spender, uint256 _value, address sender) 
    public 
    onlyFront
    returns (bool) 
  {
    allowed[sender][_spender] = _value;
    return true;
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param _owner address The address which owns the funds.
   * @param _spender address The address which will spend the funds.
   * @return A uint256 specifying the amount of tokens still available for the spender.
   */
  function allowance(address _owner, address _spender) public view returns (uint256) {
    return allowed[_owner][_spender];
  }

}
