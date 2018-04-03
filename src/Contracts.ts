import * as CapTablesABI from "../build/CapTables.abi";
import * as TheRegD506cABI from "../build/TheRegD506c.abi";
import * as ARegD506cTokenABI from "../build/ARegD506cToken.abi";
import * as TheRegSABI from "../build/TheRegS.abi";
import * as ARegSTokenABI from "../build/ARegSToken.abi";

import BigNumber from "bignumber.js";
import * as Web3 from "web3";

/* INTERFACES */

interface UserChecker {
  confirm(user : string): boolean;
}

interface ERC20 {
  allowance(owner: string, spender: string): Promise<BigNumber>;
  approve(spender: string, value: BigNumber): Promise<boolean>;
  balanceOf(user: string): Promise<BigNumber>;
  totalSupply(): Promise<BigNumber>;
  transfer(to: string, value: BigNumber): Promise<boolean>; 
  transferFrom(from: string, to: string, value: BigNumber): Promise<boolean>;
}

interface TransferRestrictor {
  test(from: string, to: string, amount: BigNumber, token: string): Promise<number>;
}

interface ICapTables {
  balanceOf(sid: BigNumber, user: string): Promise<BigNumber>;
  initialize(supply: BigNumber): Promise<BigNumber>;
  migrate(sid: BigNumber, newAddress: string): Promise<void>;
  transfer(sid: BigNumber, src: string, dest: string, amount: BigNumber): Promise<void>;
}

/* CONVENIENCE */

export function CapTables(web3: Web3, address: string): Web3.ContractInstance & ICapTables {
  return web3.eth.contract(CapTablesABI).at(address);
}

export function ARegD506cToken(web3: Web3, address: string): Web3.ContractInstance & ERC20 {
  return web3.eth.contract(ARegD506cTokenABI).at(address);
}

export function ARegSToken(web3: Web3, address: string): Web3.ContractInstance & ERC20 {
  return web3.eth.contract(ARegSTokenABI).at(address);
}
