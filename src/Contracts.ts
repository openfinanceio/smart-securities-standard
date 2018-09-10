import * as CapTablesJson from "../build/CapTables.json";
import * as TokenFrontJson from "../build/TokenFront.json";
import * as SimplifiedLogicJson from "../build/SimplifiedLogic.json";

import * as ZRX from "@0xproject/types";

export interface Artifact {
  abi: ZRX.ContractAbi;
  bytecode: string;
}

export const CapTables = (CapTablesJson as any) as Artifact;
export const SimplifiedLogic = (SimplifiedLogicJson as any) as Artifact;
export const TokenFront = (TokenFrontJson as any) as Artifact;
