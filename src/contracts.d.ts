/* Contract interfaces */

import BigNumber from "bignumber.js";

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
