import * as CapTablesABI from "../build/CapTables.abi";
import * as ARegD506cTokenABI from "../build/ARegD506cToken.abi";
import * as ARegSTokenABI from "../build/ARegSToken.abi";

import * as ZRX from "@0xproject/types";
import BigNumber from "bignumber.js";
import * as Web3 from "web3";

export namespace ABI {
  export const CapTables = (CapTablesABI as any) as ZRX.ContractAbi;
  export const ARegD506cToken = (ARegD506cTokenABI as any) as ZRX.ContractAbi;
  export const ARegSToken = (ARegSTokenABI as any) as ZRX.ContractAbi;
}

/* INTERFACES */

export interface UserChecker {
  confirm(user : string): boolean;
}

export interface ERC20 {
  allowance(owner: string, spender: string): Promise<BigNumber>;
  approve(spender: string, value: BigNumber): Promise<boolean>;
  balanceOf(user: string): Promise<BigNumber>;
  totalSupply(): Promise<BigNumber>;
  transfer(to: string, value: BigNumber): Promise<boolean>; 
  transferFrom(from: string, to: string, value: BigNumber): Promise<boolean>;
}

export interface TransferRestrictor {
  test(from: string, to: string, amount: BigNumber, token: string): Promise<number>;
}

export interface ICapTables {
  balanceOf(sid: BigNumber, user: string): Promise<BigNumber>;
  initialize(supply: BigNumber): Promise<BigNumber>;
  migrate(sid: BigNumber, newAddress: string): Promise<void>;
  transfer(sid: BigNumber, src: string, dest: string, amount: BigNumber): Promise<void>;
}

/* CONVENIENCE */

export function CapTables(web3: Web3, address: string): Web3.ContractInstance & ICapTables {
  return web3.eth.contract(ABI.CapTables).at(address);
}

export function ARegD506cToken(web3: Web3, address: string): Web3.ContractInstance & ERC20 {
  return web3.eth.contract(ABI.ARegD506cToken).at(address);
}

export function ARegSToken(web3: Web3, address: string): Web3.ContractInstance & ERC20 {
  return web3.eth.contract(ABI.ARegSToken).at(address);
}
