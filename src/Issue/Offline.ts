// Offline issuance for S3 securities
// All transactions are made with an ephemeral controller

import { BigNumber } from "bignumber.js";
import EthereumTx = require("ethereumjs-tx");

import { SimplifiedTokenLogic, TokenFront, sigHashes } from "../Contracts";
import {
  BaseSecurity,
  OfflineTranscript,
  OfflineTranscriptEntry
} from "../Types";
import * as U from "../Util";

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 1: Initialize cap table //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

export function initialize(
  this: void,
  security: BaseSecurity,
  ethParams: {
    capTablesAddress: string;
    controller: Buffer;
    startingNonce: number;
    gasPrices: string[];
    chainId: number;
  }
): [number, OfflineTranscriptEntry] {
  const supply = U.totalSupply(security);
  const controllerAddress = U.privToAddress(ethParams.controller);
  const data = U.hexSmash([
    sigHashes.CapTables.initialize,
    U.toUInt256(supply),
    U.padTo32(controllerAddress)
  ]);
  const signedTxes: Array<[string, string]> = ethParams.gasPrices.map(
    gasPrice => {
      const newCapTable = new EthereumTx({
        data,
        from: controllerAddress,
        to: ethParams.capTablesAddress,
        gas: 5e5,
        gasPrice,
        nonce: ethParams.startingNonce,
        chainId: ethParams.chainId
      });
      newCapTable.sign(ethParams.controller);
      const result: [string, string] = [
        gasPrice,
        U.toZeroXHex(newCapTable.serialize())
      ];
      return result;
    }
  );
  const result: [number, OfflineTranscriptEntry] = [
    ethParams.startingNonce + 1,
    {
      description: "initialize the cap table",
      params: {
        capTablesAddress: ethParams.capTablesAddress,
        supply: supply.toString(),
        controllerAddress,
        nonce: ethParams.startingNonce
      },
      signedTxes
    }
  ];
  return result;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 2: Configure cap table //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

export function configure(
  this: void,
  security: BaseSecurity,
  securityId: BigNumber,
  ethParams: {
    capTablesAddress: string;
    controller: Buffer;
    startingNonce: number;
    gasPrices: string[];
    chainId: number;
  }
): [number, OfflineTranscript] {
  const controllerAddress = U.privToAddress(ethParams.controller);
  let nonce = ethParams.startingNonce;
  const transcript = security.investors.map(investor => {
    const data = U.hexSmash([
      sigHashes.CapTables.transfer,
      U.toUInt256(securityId),
      U.padTo32(controllerAddress),
      U.padTo32(investor.address),
      U.toUInt256(investor.amount)
    ]);
    const signedTxes = ethParams.gasPrices.map(gasPrice => {
      const setupInvestor = new EthereumTx({
        data,
        from: controllerAddress,
        to: ethParams.capTablesAddress,
        gasPrice,
        gas: 5e5,
        nonce,
        chainId: ethParams.chainId
      });
      setupInvestor.sign(ethParams.controller);
      const result: [string, string] = [
        gasPrice,
        U.toZeroXHex(setupInvestor.serialize())
      ];
      return result;
    });
    const entry = {
      description: "distribution to investor",
      params: {
        securityId: securityId.toString(),
        capTablesAddress: ethParams.capTablesAddress,
        controllerAddress,
        investor: investor.address,
        amount: investor.amount.toString(),
        nonce
      },
      signedTxes
    };
    nonce++;
    return entry;
  });
  return [nonce, transcript];
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// STAGE 3: Deploy TokenFront and SimplifiedTokenLogic //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

export function logicAndInterface(
  this: void,
  security: BaseSecurity,
  securityId: BigNumber,
  ethParams: {
    capTablesAddress: string;
    resolverAddress: string;
    controller: Buffer;
    startingNonce: number;
    gasPrices: string[];
    chainId: number;
  }
): [number, OfflineTranscript] {
  const transactions: OfflineTranscript = [];
  const controllerAddress = U.privToAddress(ethParams.controller);
  let nonce = ethParams.startingNonce;
  // Create simplified logic
  // ~~~~~~
  const simplifiedTokenLogicAddress = U.genAddress(controllerAddress, nonce);
  const simplifiedTokenLogicData = U.hexSmash([
    SimplifiedTokenLogic.bytecode,
    U.toUInt256(securityId),
    U.padTo32(ethParams.capTablesAddress),
    U.padTo32(controllerAddress),
    U.padTo32(ethParams.resolverAddress)
  ]);
  const newSimplifiedLogicTxes = ethParams.gasPrices.map(gasPrice => {
    const newSimplifiedTokenLogic = new EthereumTx({
      data: simplifiedTokenLogicData,
      from: controllerAddress,
      gasPrice,
      gas: 1.5e6,
      nonce,
      chainId: ethParams.chainId
    });
    newSimplifiedTokenLogic.sign(ethParams.controller);
    const result: [string, string] = [
      gasPrice,
      U.toZeroXHex(newSimplifiedTokenLogic.serialize())
    ];
    return result;
  });
  transactions.push({
    description: "deploys SimplifiedTokenLogic instance",
    params: {
      securityId: securityId.toString(),
      capTablesAddress: ethParams.capTablesAddress,
      controllerAddress,
      resolverAddress: ethParams.resolverAddress,
      nonce
    },
    signedTxes: newSimplifiedLogicTxes
  });
  nonce++;
  // Deploy the token front
  // ~~~~~~
  const tokenFrontAddress = U.genAddress(controllerAddress, nonce);
  const newTokenFrontData = U.hexSmash([
    TokenFront.bytecode,
    U.padTo32(simplifiedTokenLogicAddress),
    U.padTo32(security.admin)
  ]);
  const newTokenFrontTxes = ethParams.gasPrices.map(gasPrice => {
    const newTokenFront = new EthereumTx({
      data: newTokenFrontData,
      from: controllerAddress,
      gasPrice,
      gas: 1e6,
      nonce,
      chainId: ethParams.chainId
    });
    newTokenFront.sign(ethParams.controller);
    const result: [string, string] = [
      gasPrice,
      U.toZeroXHex(newTokenFront.serialize())
    ];
    return result;
  });
  transactions.push({
    description: "deploys TokenFront",
    params: {
      simplifiedTokenLogicAddress,
      admin: security.admin,
      controllerAddress,
      nonce
    },
    signedTxes: newTokenFrontTxes
  });
  nonce++;
  // Migrate the cap table
  // ~~~~~~~
  const migrateCapTableData = U.hexSmash([
    sigHashes.CapTables.migrate,
    U.toUInt256(securityId),
    U.padTo32(simplifiedTokenLogicAddress)
  ]);
  const migrateCapTableTxes = ethParams.gasPrices.map(gasPrice => {
    const migrateCapTable = new EthereumTx({
      data: migrateCapTableData,
      from: controllerAddress,
      to: ethParams.capTablesAddress,
      gas: 5e5,
      gasPrice,
      nonce,
      chainId: ethParams.chainId
    });
    migrateCapTable.sign(ethParams.controller);
    const result: [string, string] = [
      gasPrice,
      U.toZeroXHex(migrateCapTable.serialize())
    ];
    return result;
  });
  transactions.push({
    description: "migrates the cap table to the SimplifiedTokenLogic instance",
    params: {
      securityId: securityId.toString(),
      simplifiedTokenLogicAddress,
      controllerAddress,
      nonce
    },
    signedTxes: migrateCapTableTxes
  });
  nonce++;
  // Set the token front
  // ~~~~~~
  const setFrontData = U.hexSmash([
    sigHashes.SimplifiedTokenLogic.setFront,
    U.padTo32(tokenFrontAddress)
  ]);
  const setFrontTxes = ethParams.gasPrices.map(gasPrice => {
    const setFront = new EthereumTx({
      from: controllerAddress,
      to: simplifiedTokenLogicAddress,
      data: setFrontData,
      gas: 5e5,
      gasPrice,
      nonce,
      chainId: ethParams.chainId
    });
    setFront.sign(ethParams.controller);
    const result: [string, string] = [
      gasPrice,
      U.toZeroXHex(setFront.serialize())
    ];
    return result;
  });
  transactions.push({
    description: "sets SimplifiedTokenLogic.front",
    params: {
      tokenFrontAddress,
      simplifiedTokenLogicAddress,
      controllerAddress,
      nonce
    },
    signedTxes: setFrontTxes
  });
  nonce++;
  // Change the administrator
  // ~~~~~~
  const changeAdministratorData = U.hexSmash([
    sigHashes.SimplifiedTokenLogic.transferOwnership,
    U.padTo32(security.admin)
  ]);
  const changeAdministratorTxes = ethParams.gasPrices.map(gasPrice => {
    const changeAdministrator = new EthereumTx({
      from: controllerAddress,
      to: simplifiedTokenLogicAddress,
      data: changeAdministratorData,
      gas: 1e5,
      gasPrice,
      nonce,
      chainId: ethParams.chainId
    });
    changeAdministrator.sign(ethParams.controller);
    const result: [string, string] = [
      gasPrice,
      U.toZeroXHex(changeAdministrator.serialize())
    ];
    return result;
  });
  transactions.push({
    description: "changes SimplifiedTokenLogic.admin",
    params: {
      admin: security.admin,
      simplifiedTokenLogicAddress,
      nonce
    },
    signedTxes: changeAdministratorTxes
  });
  nonce++;
  return [nonce, transactions];
}
