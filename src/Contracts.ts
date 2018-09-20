import * as CapTablesJson from "../build/CapTables.json";
import * as TokenFrontJson from "../build/TokenFront.json";
import * as SimplifiedLogicJson from "../build/SimplifiedLogic.json";

import * as ZRX from "@0xproject/types";

export interface Artifact {
  abi: ZRX.ContractAbi;
  bytecode: string;
}

export const CapTables = (CapTablesJson as any) as Artifact;
export const SimplifiedTokenLogic = (SimplifiedLogicJson as any) as Artifact;
export const TokenFront = (TokenFrontJson as any) as Artifact;

export const sigHashes = {
  CapTables: {
    initialize: "da35a26f",
    migrate: "405b84fa",
    transfer: "36cd52a6"
  },
  SimplifiedTokenLogic: {
    setFront: "ef82f95c",
    transferOwnership: "f2fde38b"
  }
};
