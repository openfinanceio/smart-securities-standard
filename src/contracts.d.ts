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

interface RegD506cToken extends ERC20 {
  isFund(): Promise<boolean>;
}

interface RegD506c {
  startHoldingPeriod(): void;
  registerAmlKycChecker(checker: string, token: string): void;
  registerAccreditationChecker(checker: string, token: string): void;
}
