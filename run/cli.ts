// cli tool for S3

import { BigNumber } from "bignumber.js";
import * as program from "commander";
import { existsSync, readFileSync } from "fs";
import * as _ from "lodash";
import * as Web3 from "web3";
import * as winston from "winston";

import {
  BaseSecurity,
  IndexedSecurity,
  OfflineTranscript,
  OfflineTranscriptEntry
} from "../src";
import { txReceipt } from "../src/Web3";
import { Config, Spec, OfflineReport } from "./cli/Types";
import { initS3 } from "./cli/Init";
import { issueOnline } from "./cli/Online";
import { offlineStage1, offlineStage2 } from "./cli/Offline";
import { publishInteractive } from "./cli/Publish";

// ~~~~~~~~~~~~~ //
// CONFIGURATION //
// ~~~~~~~~~~~~~ //

const log = winston.createLogger({
  level: "info",
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

process.stdin.setEncoding("utf8");

const PWD = process.env["PWD"];
const defaultConfig = `${PWD}/S3-conf.json`;
const defaultSpec = `${PWD}/S3-spec.json`;
const defaultReport = `${PWD}/S3-report.json`;
const defaultInit = `${PWD}/S3-CapTables.json`;

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// INITIALIZE S3 WITH A CAP TABLE //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

program
  .command("init")
  .option("-c, --config [file]", "path the configuration file", defaultConfig)
  .option(
    "-o, --output [file]",
    "path to the output file, with the action report",
    defaultInit
  )
  .action(env => {
    const config: Config = JSON.parse(readFileSync(env.config, "utf8"));
    initS3(config, env.output);
  });

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// ISSUE SECURITIES IN ONLINE MODE //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

program
  .command("issueOnline")
  .option("-c, --config [file]", "path the configuration file", defaultConfig)
  .option(
    "-d, --declaration [file]",
    "path to the declaration file",
    defaultSpec
  )
  .option(
    "-o, --output [file]",
    "path to the output file, with the action report",
    defaultReport
  )
  .action(env => {
    issueOnline(env.config, env.declaration, env.output, log);
  });

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// ISSUE SECURITIES IN OFFLINE MODE //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

program
  .command("issueOffline")
  .option(
    "-d, --declaration [file]",
    "path to the declaration file",
    defaultSpec
  )
  .option(
    "-o, --output [file]",
    "path to the output file, with the action report",
    defaultReport
  )
  .option("-s, --stage <stage>", "issuance stage", parseInt)
  .option(
    "-n, --chain <chainId>",
    "chain id (defaults to Rinkeby)",
    parseInt,
    4
  )
  .option("-g, --gasPrice <gasPrice>", "starting gas price", parseInt, 5)
  .action(env => {
    const outputFile = env.output;
    // We will never overwrite the output file
    if (existsSync(outputFile) && env.stage === 1) {
      log.error(
        `The output target ${outputFile} exists already.  Please deal with it.  Aborting!`
      );
      process.exitCode = 1;
      return;
    }
    try {
      const spec: Spec = JSON.parse(readFileSync(env.declaration, "utf8"));
      const gasPrice = env.gasPrice;
      if (spec.capTables === null) {
        log.error("CapTables address must be set");
        process.exitCode = 1;
      } else if (env.stage === 1) {
        log.debug("Stage 1");
        const securities: Array<BaseSecurity> = spec.securityPaths.map(path =>
          JSON.parse(readFileSync(path, "utf8"))
        );
        offlineStage1(
          securities,
          {
            capTablesAddress: spec.capTables,
            startingGasPrice: gasPrice,
            chainId: env.chain
          },
          outputFile,
          log
        );
      } else if (env.stage === 2 && spec.resolver !== null) {
        log.debug("Stage 2");
        const securities: Array<IndexedSecurity> = spec.securityPaths.map(
          path => JSON.parse(readFileSync(path, "utf8"))
        );
        // We need to read the controller from stdin
        const controller = Buffer.from(
          process.env.controller as string,
          "base64"
        );
        offlineStage2(
          securities,
          {
            capTablesAddress: spec.capTables,
            resolver: spec.resolver,
            startingGasPrice: gasPrice,
            chainId: env.chain,
            controller
          },
          outputFile,
          log
        );
      } else {
        log.debug("Unable to proceed");
      }
    } catch (err) {
      log.error("There was a problem:");
      log.error(err);
    }
  });

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// PUBLISH TXS GENERATED IN OFFLINE MODE //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

program
  .command("publish")
  .option("-c, --config [file]", "path the configuration file", defaultConfig)
  .option("-r, --report [file]", "path to the report", defaultReport)
  .option("-s, --stage <stage>", "the stage of issuance", parseInt)
  .action(async env => {
    try {
      const config: Config = JSON.parse(readFileSync(env.config, "utf8"));
      const web3 = new Web3(
        new Web3.providers.HttpProvider(
          `http://${config.net.host}:${config.net.port}`
        )
      );
      const report: OfflineReport = JSON.parse(
        readFileSync(env.report, "utf8")
      );
      if (env.stage === 1) {
        for (let [securityName, transactions] of report.stage1) {
          log.info(`Initializing ${securityName}`);
          const hash = await publishInteractive(
            new Map(transactions),
            web3,
            log
          );
          const rec = await txReceipt(web3.eth, hash);
          const securityId = new BigNumber(
            rec.logs[0].data.slice(2),
            16
          ).toString();
          log.info(`securityId = ${securityId}`);
        }
      } else if (env.stage === 2) {
        for (let [securityName, transactions] of report.stage2) {
          log.info(`Finishing ${securityName}`);
          for (let choices of repackTranscripts(transactions)) {
            await publishInteractive(choices, web3, log);
          }
        }
      } else {
        log.error("Unknown stage");
      }
    } catch (err) {
      log.error("Oops; problem!");
      log.error(err);
    }
  });

program.parse(process.argv);

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

function repackTranscripts(
  stage2: Array<[number, OfflineTranscript]>
): Array<Map<number, OfflineTranscriptEntry>> {
  const sequence: Array<Map<number, OfflineTranscriptEntry>> = [];
  const n = stage2.reduce((n, [, t]) => Math.max(n, t.length), 0);
  for (let i = 0; i < n; i++) {
    sequence[i] = new Map();
    for (let x of stage2) {
      sequence[i].set(x[0], x[1][i]);
    }
  }
  return sequence;
}
