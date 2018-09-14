// Offline issuance for S3 securities
// All transactions are made with an ephemeral controller

import { BigNumber } from "bignumber.js";
import EthereumTx = require("ethereumjs-tx");
import {
  addHexPrefix,
  generateAddress,
  privateToAddress
} from "ethereumjs-util";

import { SimplifiedTokenLogic, TokenFront, sigHashes } from "../Contracts";
import {
  BaseSecurity,
  OfflineTranscript,
  OfflineTranscriptEntry
} from "../Types";
import { totalSupply } from "./Util";

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 1: Initialize cap table //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

export function initialize(
  this: void,
  security: BaseSecurity,
  capTablesAddress: string,
  controller: Buffer,
  nonce: number,
  gasPrice: string,
  chainId: number
): OfflineTranscriptEntry {
  const supply = totalSupply(security);
  const controllerAddress = privToAddress(controller);
  const data = hexSmash([
    sigHashes.CapTables.initialize,
    toUInt256(supply),
    padTo32(controllerAddress)
  ]);
  const newCapTable = new EthereumTx({
    data,
    from: privToAddress(controller),
    to: capTablesAddress,
    gas: 5e5,
    gasPrice,
    nonce,
    chainId
  });
  newCapTable.sign(controller);
  return {
    description: "initialize the cap table",
    params: {
      capTablesAddress,
      supply: supply.toString(),
      controllerAddress,
      nonce
    },
    signedTx: toZeroXHex(newCapTable.serialize())
  };
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 2: Configure cap table //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

export function configureNonceOffset(
  this: void,
  security: BaseSecurity
): number {
  return security.investors.length;
}

export function configure(
  this: void,
  security: BaseSecurity,
  securityId: BigNumber,
  capTablesAddress: string,
  controller: Buffer,
  startingNonce: number,
  gasPrice: string,
  chainId: number
): OfflineTranscript {
  const controllerAddress = privToAddress(controller);
  let nonce = startingNonce;
  return security.investors.map(investor => {
    const data = hexSmash([
      sigHashes.CapTables.transfer,
      toUInt256(securityId),
      padTo32(controllerAddress),
      padTo32(investor.address),
      toUInt256(investor.amount)
    ]);
    const setupInvestor = new EthereumTx({
      data,
      from: controllerAddress,
      to: capTablesAddress,
      gasPrice,
      gas: 5e5,
      nonce,
      chainId
    });
    setupInvestor.sign(controller);
    nonce++;
    return {
      description: "distribution to investor",
      params: {
        securityId: securityId.toString(),
        capTablesAddress,
        controllerAddress,
        investor: investor.address,
        amount: investor.amount.toString(),
        nonce
      },
      signedTx: toZeroXHex(setupInvestor.serialize())
    };
  });
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 3: Deploy TokenFront and SimplifiedTokenLogic //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

export const logicAndInterfaceNonceOffset = 5;

export function logicAndInterface(
  this: void,
  security: BaseSecurity,
  securityId: BigNumber,
  capTablesAddress: string,
  resolverAddress: string,
  controller: Buffer,
  startingNonce: number,
  gasPrice: string,
  chainId: number
): OfflineTranscript {
  const transactions: OfflineTranscript = [];
  const controllerAddress = privToAddress(controller);
  let nonce = startingNonce;
  // Create simplified logic
  // ~~~~~~
  const simplifiedTokenLogicAddress = genAddress(controllerAddress, nonce);
  const simplifiedTokenLogicData = hexSmash([
    SimplifiedTokenLogic.bytecode,
    toUInt256(securityId),
    padTo32(capTablesAddress),
    padTo32(controllerAddress),
    padTo32(resolverAddress)
  ]);
  const newSimplifiedTokenLogic = new EthereumTx({
    data: simplifiedTokenLogicData,
    from: controllerAddress,
    gasPrice,
    gas: 1.5e6,
    nonce,
    chainId
  });
  nonce++;
  newSimplifiedTokenLogic.sign(controller);
  transactions.push({
    description: "deploys SimplifiedTokenLogic instance",
    params: {
      securityId: securityId.toString(),
      capTablesAddress,
      controllerAddress,
      resolverAddress,
      nonce
    },
    signedTx: toZeroXHex(newSimplifiedTokenLogic.serialize())
  });
  // Deploy the token front
  // ~~~~~~
  const tokenFrontAddress = genAddress(controllerAddress, nonce);
  const newTokenFrontData = hexSmash([
    TokenFront.bytecode,
    padTo32(simplifiedTokenLogicAddress),
    padTo32(security.admin)
  ]);
  const newTokenFront = new EthereumTx({
    data: newTokenFrontData,
    from: controllerAddress,
    gasPrice,
    gas: 1e6,
    nonce,
    chainId
  });
  nonce++;
  newTokenFront.sign(controller);
  transactions.push({
    description: "deploys TokenFront",
    params: {
      simplifiedTokenLogicAddress,
      admin: security.admin,
      controllerAddress,
      nonce
    },
    signedTx: toZeroXHex(newTokenFront.serialize())
  });
  // Migrate the cap table
  // ~~~~~~~
  const migrateCapTableData = hexSmash([
    sigHashes.CapTables.migrate,
    toUInt256(securityId),
    padTo32(simplifiedTokenLogicAddress)
  ]);
  const migrateCapTable = new EthereumTx({
    data: migrateCapTableData,
    from: controllerAddress,
    to: capTablesAddress,
    gas: 5e5,
    gasPrice,
    nonce,
    chainId
  });
  nonce++;
  migrateCapTable.sign(controller);
  transactions.push({
    description: "migrates the cap table to the SimplifiedTokenLogic instance",
    params: {
      securityId: securityId.toString(),
      simplifiedTokenLogicAddress,
      controllerAddress,
      nonce
    },
    signedTx: toZeroXHex(migrateCapTable.serialize())
  });
  // Set the token front
  // ~~~~~~
  const setFrontData = hexSmash([
    sigHashes.SimplifiedTokenLogic.setFront,
    padTo32(tokenFrontAddress)
  ]);
  const setFront = new EthereumTx({
    from: controllerAddress,
    to: simplifiedTokenLogicAddress,
    data: setFrontData,
    gas: 5e5,
    gasPrice,
    nonce,
    chainId
  });
  nonce++;
  setFront.sign(controller);
  transactions.push({
    description: "sets SimplifiedTokenLogic.front",
    params: {
      tokenFrontAddress,
      simplifiedTokenLogicAddress,
      controllerAddress,
      nonce
    },
    signedTx: toZeroXHex(setFront.serialize())
  });
  // Change the administrator
  // ~~~~~~
  const changeAdministratorData = hexSmash([
    sigHashes.SimplifiedTokenLogic.transferOwnership,
    padTo32(security.admin)
  ]);
  const changeAdministrator = new EthereumTx({
    from: controllerAddress,
    to: simplifiedTokenLogicAddress,
    data: changeAdministratorData,
    gas: 1e5,
    gasPrice,
    nonce,
    chainId
  });
  nonce++;
  changeAdministrator.sign(controller);
  transactions.push({
    description: "changes SimplifiedTokenLogic.admin",
    params: {
      admin: security.admin,
      simplifiedTokenLogicAddress,
      nonce
    },
    signedTx: toZeroXHex(changeAdministrator.serialize())
  });
  return transactions;
}

// HELPERS //

const toZeroXHex = (buf: Buffer) => addHexPrefix(buf.toString("hex"));

const toUInt256 = (n: BigNumber | string | number) =>
  padTo32(new BigNumber(n).toString(16));

const genAddress = (addr: string, n: number) => {
  const addrBuffer = Buffer.from(noHexPrefix(addr), "hex");
  return addHexPrefix(
    (generateAddress(addrBuffer, n as any) as Buffer).toString("hex")
  );
};

const privToAddress = (buf: Buffer) =>
  addHexPrefix((privateToAddress(buf) as Buffer).toString("hex"));

const hexSmash = (hexes: Array<string>) =>
  addHexPrefix(hexes.map(noHexPrefix).join(""));

const noHexPrefix = (hex: string) =>
  hex.startsWith("0x") ? hex.slice(2) : hex;

const padTo32 = (hex: string) => noHexPrefix(hex).padStart(64, "0");
