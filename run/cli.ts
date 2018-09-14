// cli tool for S3

import { BigNumber } from "bignumber.js";
import * as program from "commander";
import { randomBytes } from "crypto";
import { addHexPrefix, privateToAddress } from "ethereumjs-util";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as _ from "lodash";
import * as readline from "readline";
import * as Web3 from "web3";
import * as winston from "winston";

import {
  init,
  issue,
  issueOffline,
  BaseSecurity,
  IndexedSecurity,
  OfflineTranscript,
  OfflineTranscriptEntry,
  Transcript
} from "../src";
import { txReceipt } from "../src/Web3";

// ~~~~~~~~~~ //
// DATA MODEL //
// ~~~~~~~~~~ //

interface GasReport {
  safeLow: number;
}

interface Config {
  /** This is what we use to connect to web3 */
  net: {
    host: string;
    port: number;
  };
  /** A general purpose controller address */
  controller: string;
  /** Path to the gas report, which can be kept current by some other process. */
  gasReportPath: string;
}

interface Spec {
  /**
   * When null, deploy a new captables; otherwise this is the address of the
   * capTables contract to use.
   */
  capTables: string | null;
  /**
   * A designated address to resolve transfers
   */
  resolver: string | null;
  securityPaths: string[];
}

interface S3 {
  name: string;
  capTables: string;
  front: string;
  logic: string;
}

interface OnlineReport {
  transcript: Transcript;
  ethState: {
    capTables: string;
    securities: Array<S3>;
  };
}

interface OfflineReport {
  nonce: number;
  stage1: Array<[string, Array<[number, OfflineTranscriptEntry]>]>;
  stage2: Array<[string, Array<[number, OfflineTranscript]>]>;
}

const log = winston.createLogger({
  level: "info",
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// ~~~~~~~~~~~~~ //
// CONFIGURATION //
// ~~~~~~~~~~~~~ //

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
    issueOnline(env.config, env.declaration, env.output);
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
          spec.capTables,
          securities,
          gasPrice,
          env.chain,
          outputFile
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
          spec.capTables,
          securities,
          spec.resolver,
          gasPrice,
          env.chain,
          controller,
          outputFile
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
          const hash = await publishInteractive(new Map(transactions), web3);
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
            await publishInteractive(choices, web3);
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

async function initS3(this: void, config: Config, outputFile: string) {
  // We'll need to figure out gas prices
  const gasPrice = () => {
    const gasReport: GasReport = JSON.parse(
      readFileSync(config.gasReportPath, "utf8")
    );
    return web3.toWei(gasReport.safeLow, "gwei");
  };
  const web3 = new Web3(
    new Web3.providers.HttpProvider(
      `http://${config.net.host}:${config.net.port}`
    )
  );
  // deploy the new cap tables instance
  const [capTables, transcript] = await init(
    config.controller,
    gasPrice(),
    web3.eth
  );
  writeFileSync(
    outputFile,
    JSON.stringify({
      capTables,
      transcript
    }),
    "utf8"
  );
}

async function issueOnline(
  this: void,
  configFile: string,
  declarationFile: string,
  outputFile: string
) {
  // We will never overwrite the output file
  if (existsSync(outputFile)) {
    log.error(
      `The output target ${outputFile} exists already.  Please deal with it.  Aborting!`
    );
    process.exitCode = 1;
    return;
  }
  try {
    // Let's read in the configuration
    const config: Config = JSON.parse(readFileSync(configFile, "utf8"));
    // ... and the program that we're supposed to execute
    const spec: Spec = JSON.parse(readFileSync(declarationFile, "utf8"));
    const securities: Array<BaseSecurity> = spec.securityPaths.map(path =>
      JSON.parse(readFileSync(path, "utf8"))
    );
    // We'll need to figure out gas prices
    const gasPrice = () => {
      const gasReport: GasReport = JSON.parse(
        readFileSync(config.gasReportPath, "utf8")
      );
      return web3.toWei(gasReport.safeLow, "gwei");
    };
    const web3 = new Web3(
      new Web3.providers.HttpProvider(
        `http://${config.net.host}:${config.net.port}`
      )
    );
    let transcripts: Transcript[] = [];
    const getCapTables = async () => {
      if (spec.capTables === null) {
        // deploy the new cap tables instance
        const [capTables, initTranscript] = await init(
          config.controller,
          gasPrice(),
          web3.eth
        );
        transcripts.push(initTranscript);
        return capTables;
      } else {
        return spec.capTables;
      }
    };
    const capTables = await getCapTables();
    const deployments: Array<S3> = [];
    for (let security of securities) {
      try {
        const [{ front, middleware }, issueTranscript] = await issue(
          security,
          capTables,
          config.controller,
          gasPrice(),
          {
            eth: web3.eth,
            log
          }
        );
        transcripts.push(issueTranscript);
        deployments.push({
          name: security.metadata.name,
          capTables,
          front,
          logic: middleware
        });
      } catch (err) {
        log.error(`There was a problem handling ${security.metadata.name}`);
        log.error(err);
      }
    }
    const report: OnlineReport = {
      transcript: transcripts.reduce((result, tr) => result.concat(tr), []),
      ethState: {
        capTables,
        securities: deployments
      }
    };
    writeFileSync(outputFile, JSON.stringify(report), "utf8");
  } catch (err) {
    log.error(`Oops there was a problem: ${err}`);
    process.exitCode = 1;
    return;
  }
}

function offlineStage1(
  this: void,
  capTablesAddress: string,
  securities: Array<BaseSecurity>,
  /** gas price in gwei */
  startingGasPrice: number,
  chainId: number,
  outputFile: string
) {
  const controller = randomBytes(32);
  const controllerAddress = addHexPrefix(
    (privateToAddress(controller) as Buffer).toString("hex")
  );
  const gasPrices: number[] = _.range(
    startingGasPrice,
    startingGasPrice * 10,
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
            capTablesAddress,
            controller,
            nonce,
            gasPrice,
            chainId
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

function offlineStage2(
  this: void,
  capTableAddress: string,
  securities: Array<IndexedSecurity>,
  resolver: string,
  /** gas price in gwei */
  startingGasPrice: number,
  chainId: number,
  controller: Buffer,
  outputFile: string
) {
  try {
    const report: OfflineReport = JSON.parse(readFileSync(outputFile, "utf8"));
    const gasPrices = _.range(startingGasPrice, startingGasPrice * 10, 2);
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
          capTableAddress,
          controller,
          nonce,
          weiPrice,
          chainId
        );
        const deployTranscript = issueOffline.logicAndInterface(
          security,
          securityId,
          capTableAddress,
          resolver,
          controller,
          nonce + configureOffset,
          weiPrice,
          chainId
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

async function publishInteractive(
  choices: Map<number, OfflineTranscriptEntry>,
  web3: Web3
): Promise<string> {
  return new Promise(resolve => {
    const gasPrices = Array.from(choices.keys());
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const attempt = () =>
      rl.question(
        `Choose the gas price you would like to use: \x0a${gasPrices.join(
          " "
        )}\x0a`,
        answer => {
          try {
            const gasChoice = parseInt(answer);
            if (choices.has(gasChoice)) {
              const entry = choices.get(gasChoice);
              log.info(entry!.description);
              const hash = web3.eth.sendRawTransaction(entry!.signedTx);
              log.info(`sent: ${hash}`);
              rl.question(
                "type retry if you would like to try with more gas\x0a",
                reply => {
                  if (reply === "retry") {
                    attempt();
                  } else {
                    rl.close();
                    resolve(hash);
                  }
                }
              );
            } else {
              log.error(`bad choice: ${gasChoice}`);
              attempt();
            }
          } catch (err) {
            log.error("Uh oh!");
            log.error(err);
            attempt();
          }
        }
      );
    attempt();
  }) as Promise<string>;
}

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

function gweiToWei(gwei: number) {
  return addHexPrefix(new BigNumber(gwei).mul(1e9).toString(16));
}
