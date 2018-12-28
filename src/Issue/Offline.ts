// Offline issuance for S3 securities
// All transactions are made with an ephemeral controller

import { BigNumber } from "bignumber.js";
import EthereumTx = require("ethereumjs-tx");

import { Data } from "../Contracts";
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

  const data = Data.initializeCapTable(supply, controllerAddress);
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
    const data = Data.capTablesTransfer(
      securityId,
      controllerAddress,
      investor.address,
      investor.amount
    );

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
  const chainId = ethParams.chainId;
  let nonce = ethParams.startingNonce;

  // Create simplified logic
  // ~~~~~~
  const simplifiedTokenLogicAddress = U.genAddress(controllerAddress, nonce);
  const simplifiedTokenLogicData = Data.newSimplifiedLogic(
    securityId,
    ethParams.capTablesAddress,
    controllerAddress,
    ethParams.resolverAddress
  );

  const newSimplifiedLogicTxes = ethParams.gasPrices.map(gasPrice => {
    const newSimplifiedTokenLogic = new EthereumTx({
      data: simplifiedTokenLogicData,
      from: controllerAddress,
      gasPrice,
      gas: 1.5e6,
      nonce,
      chainId
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
      simplifiedTokenLogicAddress,
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
  const newTokenFrontData = Data.newTokenFront(
    simplifiedTokenLogicAddress,
    security.admin
  );

  const newTokenFrontTxes = ethParams.gasPrices.map(gasPrice => {
    const newTokenFront = new EthereumTx({
      data: newTokenFrontData,
      from: controllerAddress,
      gasPrice,
      gas: 1e6,
      nonce,
      chainId
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
      tokenFrontAddress,
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
  const migrateCapTableData = Data.capTablesMigrate(
    securityId,
    simplifiedTokenLogicAddress
  );

  const migrateCapTableTxes = ethParams.gasPrices.map(gasPrice => {
    const migrateCapTable = new EthereumTx({
      data: migrateCapTableData,
      from: controllerAddress,
      to: ethParams.capTablesAddress,
      gas: 5e5,
      gasPrice,
      nonce,
      chainId
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
  const setFrontData = Data.setFront(tokenFrontAddress);
  const setFrontTxes = ethParams.gasPrices.map(gasPrice => {
    const setFront = new EthereumTx({
      from: controllerAddress,
      to: simplifiedTokenLogicAddress,
      data: setFrontData,
      gas: 5e5,
      gasPrice,
      nonce,
      chainId
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
  const changeAdministratorData = Data.simplifiedLogicChangeAdmin(
    security.admin
  );
  const changeAdministratorTxes = ethParams.gasPrices.map(gasPrice => {
    const changeAdministrator = new EthereumTx({
      from: controllerAddress,
      to: simplifiedTokenLogicAddress,
      data: changeAdministratorData,
      gas: 1e5,
      gasPrice,
      nonce,
      chainId
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
