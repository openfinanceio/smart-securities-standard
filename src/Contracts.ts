import * as CapTablesJson from "../build/CapTables.json";
import * as TokenFrontJson from "../build/TokenFront.json";
import * as SimplifiedLogicJson from "../build/SimplifiedLogic.json";

import * as ZRX from "@0xproject/types";
import { BigNumber } from "bignumber.js";

import * as U from "./Util";

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
      U.toUInt256(supply),
      U.padTo32(admin)
    ]);

  export const capTablesTransfer = (
    id: BigNumber,
    src: string,
    dst: string,
    amount: BigNumber
  ) =>
    U.hexSmash([
      sigHashes.CapTables.transfer,
      U.toUInt256(id),
      U.padTo32(src),
      U.padTo32(dst),
      U.toUInt256(amount)
    ]);

  export const capTablesMigrate = (id: BigNumber, newAdmin: string) =>
    U.hexSmash([
      sigHashes.CapTables.migrate,
      U.toUInt256(id),
      U.padTo32(newAdmin)
    ]);

  export const newSimplifiedLogic = (
    id: BigNumber,
    capTables: string,
    admin: string,
    resolver: string
  ) =>
    U.hexSmash([
      SimplifiedTokenLogic.bytecode,
      U.toUInt256(id),
      U.padTo32(capTables),
      U.padTo32(admin),
      U.padTo32(resolver)
    ]);

  export const simplifiedLogicChangeAdmin = (newAdmin: string) =>
    U.hexSmash([sigHashes.Ownable.transferOwnership, U.padTo32(newAdmin)]);

  export const resolve = (index: number, code: number) =>
    U.hexSmash([
      sigHashes.SimplifiedTokenLogic.resolve,
      U.toUInt256(index),
      U.toUInt256(code)
    ]);

  export const setFront = (frontAddress: string) =>
    U.hexSmash([
      sigHashes.SimplifiedTokenLogic.setFront,
      U.padTo32(frontAddress)
    ]);

  export const newTokenFront = (logicAddress: string, admin: string) =>
    U.hexSmash([
      TokenFront.bytecode,
      U.padTo32(logicAddress),
      U.padTo32(admin)
    ]);
}
