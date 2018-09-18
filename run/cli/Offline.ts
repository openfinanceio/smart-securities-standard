import { BigNumber } from "bignumber.js";
import { randomBytes } from "crypto";
import { addHexPrefix, privateToAddress } from "ethereumjs-util";
import { readFileSync, writeFileSync } from "fs";
import * as _ from "lodash";
import { Logger } from "winston";

import {
  BaseSecurity,
  IndexedSecurity,
  OfflineTranscript,
  OfflineTranscriptEntry,
  issueOffline
} from "../../src";
import { OfflineReport } from "./Types";

export function offlineStage1(
  this: void,
  securities: Array<BaseSecurity>,
  ethParams: {
    capTablesAddress: string;
    /** gas price in gwei */
    startingGasPrice: number;
    chainId: number;
  },
  outputFile: string,
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
  const stage1: Array<[string, Array<[number, OfflineTranscriptEntry]>]> = [];
  securities.forEach(security => {
    const name = security.metadata.name;
    log.debug("handling " + name);
    const items: Array<[number, OfflineTranscriptEntry]> = [];
    gasPrices.forEach(price => {
      try {
        const gasPrice = gweiToWei(price);
        log.debug("Pushing security", name, "at gas price", price);
        items.push([
          price,
          issueOffline.initialize(
            security,
            ethParams.capTablesAddress,
            controller,
            nonce,
            gasPrice,
            ethParams.chainId
          )
        ]);
      } catch (err) {
        log.error(err);
      }
    });
    nonce++; // Note that we only plan to publish one transaction per security here
    stage1.push([name, items]);
  });
  log.debug(`writing ${outputFile}`);
  writeFileSync(
    outputFile,
    JSON.stringify({ nonce, stage1, stage2: {} }),
    "utf8"
  );
  log.info(controllerAddress);
  log.info(controller.toString("base64"));
}

export function offlineStage2(
  this: void,
  securities: Array<IndexedSecurity>,
  ethParams: {
    capTablesAddress: string;
    resolver: string;
    /** gas price in gwei */
    startingGasPrice: number;
    chainId: number;
    controller: Buffer;
  },
  outputFile: string,
  log: Logger
) {
  try {
    const report: OfflineReport = JSON.parse(readFileSync(outputFile, "utf8"));
    const gasPrices = _.range(
      ethParams.startingGasPrice,
      ethParams.startingGasPrice * 10,
      2
    );
    const stage2: Array<[string, Array<[number, OfflineTranscript]>]> = [];
    let nonce = report.nonce;
    securities.forEach(security => {
      const name = security.metadata.name;
      const securityId = new BigNumber(security.securityId);
      const items: Array<[number, OfflineTranscript]> = [];
      const configureOffset = issueOffline.configureNonceOffset(security);
      gasPrices.forEach(gasPrice => {
        const weiPrice = gweiToWei(gasPrice);
        const configureTranscript = issueOffline.configure(
          security,
          securityId,
          ethParams.capTablesAddress,
          ethParams.controller,
          nonce,
          weiPrice,
          ethParams.chainId
        );
        const deployTranscript = issueOffline.logicAndInterface(
          security,
          securityId,
          ethParams.capTablesAddress,
          ethParams.resolver,
          ethParams.controller,
          nonce + configureOffset,
          weiPrice,
          ethParams.chainId
        );
        items.push([gasPrice, configureTranscript.concat(deployTranscript)]);
      });
      // Update the nonce by the number of txs that we are going to send for this security
      nonce += configureOffset + issueOffline.logicAndInterfaceNonceOffset;
      stage2.push([name, items]);
    });
    writeFileSync(
      outputFile,
      JSON.stringify({
        nonce,
        stage1: report.stage1,
        stage2
      }),
      "utf8"
    );
  } catch (err) {
    log.error("There was a problem");
    log.error(err);
  }
}

function gweiToWei(gwei: number) {
  return addHexPrefix(new BigNumber(gwei).mul(1e9).toString(16));
}
