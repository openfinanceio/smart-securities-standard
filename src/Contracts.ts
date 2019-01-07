import * as CapTablesJson from "../build/CapTables.json";
import * as OwnableJson from "../build/Ownable.json";
import * as TokenFrontJson from "../build/TokenFront.json";
import * as SimplifiedLogicJson from "../build/SimplifiedLogic.json";

import * as ZRX from "@0xproject/types";
import { BigNumber } from "bignumber.js";
import * as coder from "web3/lib/solidity/coder";

import * as U from "./Util";

export interface Artifact {
  abi: ZRX.ContractAbi;
  bytecode: string;
}

export const CapTables = (CapTablesJson as any) as Artifact;
export const Ownable = (OwnableJson as any) as Artifact;
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
    setResolver: "4e543b26",
    resolve: "ddb34e51"
  },
  Ownable: {
    transferOwnership: "f2fde38b"
  }
};

export namespace Data {
  export const initializeCapTable = (supply: BigNumber, admin: string) =>
    U.hexSmash([
      sigHashes.CapTables.initialize,
      coder.encodeParams(["uint256", "address"], [supply, admin])
    ]);

  export const capTablesTransfer = (
    id: BigNumber,
    src: string,
    dst: string,
    amount: string
  ) =>
    U.hexSmash([
      sigHashes.CapTables.transfer,
      coder.encodeParams(
        ["uint256", "address", "address", "uint256"],
        [id, src, dst, amount]
      )
    ]);

  export const capTablesMigrate = (id: BigNumber, newAdmin: string) =>
    U.hexSmash([
      sigHashes.CapTables.migrate,
      coder.encodeParams(["uint256", "address"], [id, newAdmin])
    ]);

  export const newSimplifiedLogic = (
    id: BigNumber,
    capTables: string,
    admin: string,
    resolver: string
  ) =>
    U.hexSmash([
      SimplifiedTokenLogic.bytecode,
      coder.encodeParams(
        ["uint256", "address", "address", "address"],
        [id, capTables, admin, resolver]
      )
    ]);

  export const simplifiedLogicChangeAdmin = (newAdmin: string) =>
    U.hexSmash([
      sigHashes.Ownable.transferOwnership,
      coder.encodeParam("address", newAdmin)
    ]);

  export const resolve = (index: number, code: number) =>
    U.hexSmash([
      sigHashes.SimplifiedTokenLogic.resolve,
      coder.encodeParams(["uint256", "uint16"], [index, code])
    ]);

  export const setFront = (frontAddress: string) =>
    U.hexSmash([
      sigHashes.SimplifiedTokenLogic.setFront,
      coder.encodeParam("address", frontAddress)
    ]);

  export const newTokenFront = (logicAddress: string, admin: string) =>
    U.hexSmash([
      TokenFront.bytecode,
      coder.encodeParams(["address", "address"], [logicAddress, admin])
    ]);
}
