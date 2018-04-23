import * as ARegD506cTokenABI from "../build/ARegD506cToken.json";
import * as ARegSTokenABI from "../build/ARegSToken.json";
import * as CapTablesABI from "../build/CapTables.json";
import * as ExporterABI from "../build/Exporter.json";
import * as ImporterABI from "../build/Importer.json";
import * as SimpleUserCheckerABI from "../build/SimpleUserChecker.json";
import * as TheRegD506cABI from "../build/TheRegD506c.json";
import * as TheRegSABI from "../build/TheRegS.json";

import * as ZRX from "@0xproject/types";
import BigNumber from "bignumber.js";

export namespace ABI {
  export const ARegD506cToken = (ARegD506cTokenABI as any) as ZRX.ContractAbi;
  export const ARegSToken = (ARegSTokenABI as any) as ZRX.ContractAbi;
  export const CapTables = (CapTablesABI as any) as ZRX.ContractAbi;
  export const Exporter = (ExporterABI as any) as ZRX.ContractAbi;
  export const Importer = (ImporterABI as any) as ZRX.ContractAbi;
  export const SimpleUserChecker = (SimpleUserCheckerABI as any) as ZRX.ContractAbi;
  export const TheRegD506c = (TheRegD506cABI as any) as ZRX.ContractAbi;
  export const TheRegS = (TheRegSABI as any) as ZRX.ContractAbi;
}

/* INTERFACES */

export interface UserChecker {
  confirm(user: string): boolean;
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
  test(
    from: string,
    to: string,
    amount: BigNumber,
    token: string
  ): Promise<number>;
}

export interface ICapTables {
  balanceOf(sid: BigNumber, user: string): Promise<BigNumber>;
  initialize(supply: BigNumber): Promise<BigNumber>;
  migrate(sid: BigNumber, newAddress: string): Promise<void>;
  transfer(
    sid: BigNumber,
    src: string,
    dest: string,
    amount: BigNumber
  ): Promise<void>;
}
