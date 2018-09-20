import { BigNumber } from "bignumber.js";
import { randomBytes } from "crypto";
import { addHexPrefix, privateToAddress } from "ethereumjs-util";
import * as _ from "lodash";
import { Logger } from "winston";

import {
  BaseSecurity,
  IndexedSecurity,
  OfflineTranscript,
  OfflineTranscriptEntry,
  issueOffline
} from "../../src";
import { gweiToWei } from "./Util";

export function offlineStage1(
  this: void,
  securities: Array<BaseSecurity>,
  ethParams: {
    capTablesAddress: string;
    /** gas price in gwei */
    startingGasPrice: number;
    chainId: number;
  },
  log: Logger
) {
  const controller = randomBytes(32);
  const controllerAddress = addHexPrefix(
    (privateToAddress(controller) as Buffer).toString("hex")
  );
  const gasPrices: number[] = _.range(
    ethParams.startingGasPrice,
    ethParams.startingGasPrice * 10,
    2
  );
  let nonce = 0;
  const stage1: Array<[string, OfflineTranscriptEntry]> = [];
  securities.forEach(security => {
    const name = security.metadata.name;
    log.debug("handling " + name);
    try {
      const [newNonce, entry] = issueOffline.initialize(security, {
        capTablesAddress: ethParams.capTablesAddress,
        controller,
        startingNonce: nonce,
        gasPrices: gasPrices.map(gweiToWei),
        chainId: ethParams.chainId
      });
      nonce = newNonce;
      stage1.push([name, entry]);
    } catch (err) {
      log.error(err);
    }
  });
  log.info(controllerAddress);
  log.info(controller.toString("base64"));
  return [nonce, stage1];
}

export function offlineStage2(
  this: void,
  securities: Array<IndexedSecurity>,
  ethParams: {
    capTablesAddress: string;
    resolver: string;
    /** gas price in gwei */
    startingGasPrice: number;
    startingNonce: number;
    chainId: number;
    controller: Buffer;
  },
  log: Logger
) {
  try {
    const gasPrices = _.range(
      ethParams.startingGasPrice,
      ethParams.startingGasPrice * 10,
      2
    );
    const stage2: Array<[string, OfflineTranscript]> = [];
    let nonce = ethParams.startingNonce;
    securities.forEach(security => {
      const name = security.metadata.name;
      const securityId = new BigNumber(security.securityId);
      const [nonceA, configureTranscript] = issueOffline.configure(
        security,
        securityId,
        {
          capTablesAddress: ethParams.capTablesAddress,
          controller: ethParams.controller,
          startingNonce: nonce,
          gasPrices: gasPrices.map(gweiToWei),
          chainId: ethParams.chainId
        }
      );
      const [nonceB, deployTranscript] = issueOffline.logicAndInterface(
        security,
        securityId,
        {
          capTablesAddress: ethParams.capTablesAddress,
          resolverAddress: ethParams.resolver,
          controller: ethParams.controller,
          startingNonce: nonceA,
          gasPrices: gasPrices.map(gweiToWei),
          chainId: ethParams.chainId
        }
      );
      nonce = nonceB;
      stage2.push([name, configureTranscript.concat(deployTranscript)]);
    });
    return stage2;
  } catch (err) {
    log.error("There was a problem");
    log.error(err);
    return undefined as any;
  }
}
