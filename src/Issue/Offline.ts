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
import { BaseSecurity } from "../Types";
import { totalSupply } from "./Util";

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 1: Initialize cap table //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

export function initialize(
  this: void,
  security: BaseSecurity,
  controller: Buffer,
  nonce: number,
  gasPrice: string,
  chainId: number
) {
  const supply = totalSupply(security);
  const data = hexSmash([
    sigHashes.CapTables.initialize,
    toUInt256(supply),
    privToAddress(controller)
  ]);
  const newCapTable = new EthereumTx({
    data,
    from: privToAddress(controller),
    gasPrice,
    nonce,
    chainId
  });
  newCapTable.sign(controller);
  return toZeroXHex(newCapTable.serialize());
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 2: Configure cap table //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

export function configure(
  this: void,
  security: BaseSecurity,
  index: BigNumber,
  controller: Buffer,
  startingNonce: number,
  gasPrice: string,
  chainId: number
) {
  const controllerAddress = privToAddress(controller);
  let nonce = startingNonce;
  return security.investors.map(investor => {
    const data = hexSmash([
      sigHashes.CapTables.transfer,
      toUInt256(index),
      controllerAddress,
      investor.address,
      toUInt256(investor.amount)
    ]);
    const setupInvestor = new EthereumTx({
      data,
      from: controllerAddress,
      gasPrice,
      nonce,
      chainId
    });
    setupInvestor.sign(controller);
    nonce++;
    return toZeroXHex(setupInvestor.serialize());
  });
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 3: Deploy TokenFront and SimplifiedTokenLogic //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

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
) {
  const transactions: Array<string> = [];
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
    nonce,
    chainId
  });
  nonce++;
  newSimplifiedTokenLogic.sign(controller);
  transactions.push(toZeroXHex(newSimplifiedTokenLogic.serialize()));
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
    nonce,
    chainId
  });
  nonce++;
  newTokenFront.sign(controller);
  transactions.push(toZeroXHex(newTokenFront.serialize()));
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
    gasPrice,
    nonce,
    chainId
  });
  nonce++;
  migrateCapTable.sign(controller);
  transactions.push(toZeroXHex(migrateCapTable.serialize()));
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
    gasPrice,
    nonce,
    chainId
  });
  nonce++;
  setFront.sign(controller);
  transactions.push(toZeroXHex(setFront.serialize()));
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
    gasPrice,
    nonce,
    chainId
  });
  nonce++;
  changeAdministrator.sign(controller);
  transactions.push(toZeroXHex(changeAdministrator.serialize()));
  return transactions;
}

// HELPERS //

const toZeroXHex = (buf: Buffer) => addHexPrefix(buf.toString("hex"));

const toUInt256 = (n: BigNumber) => padTo32(n.toString(16));

const genAddress = (addr: string, n: number) => {
  const addrBuffer = Buffer.from(noHexPrefix(addr), "hex");
  const nonceBuffer = Buffer.from(n.toString(16), "hex");
  return (generateAddress(addrBuffer, nonceBuffer) as Buffer).toString("hex");
};

const privToAddress = (buf: Buffer) =>
  addHexPrefix((privateToAddress(buf) as Buffer).toString("hex"));

const hexSmash = (hexes: Array<string>) =>
  addHexPrefix(hexes.map(noHexPrefix).join(""));

const noHexPrefix = (hex: string) =>
  hex.startsWith("0x") ? hex.slice(2) : hex;

const padTo32 = (hex: string) => noHexPrefix(hex).padStart(64, "0");
