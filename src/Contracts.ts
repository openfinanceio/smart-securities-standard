import * as CapTablesJson from "../build/CapTables.json";
import * as ExporterJson from "../build/Exporter.json";
import * as ImporterJson from "../build/Importer.json";
import * as TokenFrontJson from "../build/TokenFront.json";
import * as SimplifiedLogicJson from "../../build/SimplifiedLogic.json";

import * as ZRX from "@0xproject/types";
import BigNumber from "bignumber.js";

export interface Artifact {
  abi: ZRX.ContractAbi;
  bytecode: string;
}

export const CapTables = (CapTablesJson as any) as Artifact;
export const SimplifiedLogic = (SimplifiedLogicJson as any) as Artifact;
export const TokenFront = (TokenFrontJson as any) as Artifact;
export const Exporter = (ExporterJson as any) as Artifact;
export const Importer = (ImporterJson as any) as Artifact;

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
