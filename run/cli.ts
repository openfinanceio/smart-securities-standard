// cli tool for S3

import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import * as program from "commander";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as _ from "lodash";
import * as Web3 from "web3";
import * as winston from "winston";

import {
  Administration,
  BaseSecurity,
  IndexedSecurity,
  OfflineTranscriptEntry,
  adminSpecRT,
  newResolver,
  baseSecurityRT,
  indexedSecurityRT
} from "../src";
import { txReceipt } from "../src/Web3";

import {
  Config,
  GasReport,
  OfflineReport,
  configRT,
  specRT
} from "./cli/Types";
import { initS3 } from "./cli/Init";
import { issueOnline } from "./cli/Online";
import { offlineStage1, offlineStage2 } from "./cli/Offline";
import { publishInteractive } from "./cli/Publish";
import { gweiToWei } from "./cli/Util";

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
const defaultNewResolver = `${PWD}/S3-newResolver.json`;
const defaultAdminSpec = `${PWD}/S3-administration.json`;

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
  .action(async env => {
    checkOutput(env.output);

    const config: Config = JSON.parse(readFileSync(env.config, "utf8"));
    const result = await initS3(config);

    log.info(`CapTables instance @ ${result.capTables}`);

    writeFileSync(env.output, JSON.stringify(result.transcript), "utf8");
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
  .action(async env => {
    checkOutput(env.output);

    // Let's read in the configuration
    const config: Config = JSON.parse(readFileSync(env.config, "utf8"));

    // ... and the program that we're supposed to execute
    const spec = specRT
      .decode(JSON.parse(readFileSync(env.declaration, "utf8")))
      .getOrElseL(errs => {
        throw new Error("Invalid spec.");
      });

    const securities: Array<BaseSecurity> = [];
    spec.securityPaths.forEach(path =>
      baseSecurityRT.decode(JSON.parse(readFileSync(path, "utf8"))).fold(
        errs => {
          log.warning(`${path} contains an invalid spec`);
        },
        security => {
          securities.push(security);
        }
      )
    );

    const web3 = new Web3(
      new Web3.providers.HttpProvider(
        `http://${config.net.host}:${config.net.port}`
      )
    );

    // We'll need to figure out gas prices
    const gasPrice = () => {
      const gasReport: GasReport = JSON.parse(
        readFileSync(config.gasReportPath, "utf8")
      );
      return web3.toWei(gasReport.safeLow, "gwei");
    };

    const result = await issueOnline(
      config,
      spec,
      securities,
      gasPrice,
      web3,
      log
    );

    writeFileSync(env.output, JSON.stringify(result), "utf8");
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
    if (env.stage === 1) {
      checkOutput(outputFile);
    }

    try {
      const spec = specRT
        .decode(JSON.parse(readFileSync(env.declaration, "utf8")))
        .getOrElseL(errs => {
          throw new Error("Invalid specification");
        });

      const gasPrice = env.gasPrice;

      if (env.stage === 1) {
        log.info("Stage 1");

        const securities: Array<BaseSecurity> = [];
        spec.securityPaths.forEach(path =>
          baseSecurityRT.decode(JSON.parse(readFileSync(path, "utf8"))).fold(
            errs => {
              log.warning(`${path} contains an invalid spec`);
            },
            security => {
              // Add the security to the list of specs to process
              securities.push(security);
            }
          )
        );

        const [nonce, stage1] = offlineStage1(
          securities,
          {
            capTablesAddress: spec.capTables,
            startingGasPrice: gasPrice,
            chainId: env.chain
          },
          log
        );

        log.debug(`writing ${outputFile}`);

        writeFileSync(outputFile, JSON.stringify({ nonce, stage1 }), "utf8");
      } else if (env.stage === 2) {
        log.info("Stage 2");

        const securities: Array<IndexedSecurity> = [];
        spec.securityPaths.forEach(path =>
          indexedSecurityRT.decode(JSON.parse(readFileSync(path, "utf8"))).fold(
            errs => {
              log.warning(`${path} contains an invalid spec`);
            },
            security => {
              securities.push(security);
            }
          )
        );

        // We need to read the controller from stdin
        const controller = Buffer.from(
          process.env.controller as string,
          "base64"
        );

        const { nonce, stage1 } = JSON.parse(readFileSync(outputFile, "utf8"));
        const stage2 = offlineStage2(
          securities,
          {
            capTablesAddress: spec.capTables,
            resolver: spec.resolver,
            startingGasPrice: gasPrice,
            chainId: env.chain,
            startingNonce: nonce,
            controller
          },
          log
        );

        writeFileSync(
          outputFile,
          JSON.stringify({
            stage1,
            stage2
          }),
          "utf8"
        );
      } else {
        log.warning("The only valid stages are '1' & '2'");
      }
    } catch (err) {
      log.error("There was a problem:");
      log.error(err);
    }
  });

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// PUBLISH TXS GENERATED IN OFFLINE ISSUANCE MODE //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

program
  .command("publish-issuance")
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
        for (let [securityName, transaction] of report.stage1) {
          log.info(`Initializing ${securityName}`);

          const hash = await publishInteractive(transaction, web3, log);
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

          for (let transaction of transactions) {
            await publishInteractive(transaction, web3, log);
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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// CHANGE THE RESOLVER ON A SIMPLIFIEDTOKENLOGIC INSTANCE //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

// TODO Trezor support
program
  .command("newResolver")
  .option(
    "-s, --simplifiedTokenLogic <address>",
    "the address of the simplified token logic to change"
  )
  .option(
    "-a, --admin <privkey>",
    "the base64 encoded private key in control of the token logic"
  )
  .option("-g, --gasPrice [gasPrice]", "the starting gas price in gwei", 5)
  .option("-c, --chainId [chain]", "which chain to use", 4)
  .option("-n, --nonce <value>", "the current nonce")
  .option(
    "-o, --outputFile [file]",
    "where to write the transcript",
    defaultNewResolver
  )
  .action(async env => {
    const admin = Buffer.from(env.admin);

    const gasPrices = _.range(env.gasPrice, 10 * env.gasPrice, 2);

    const result = newResolver(env.simplifiedTokenLogic, admin, {
      gasPrices: gasPrices.map(gweiToWei),
      nonce: parseInt(env.nonce),
      chainId: parseInt(env.chainId)
    });

    console.log("New resolver address:", result.resolverAddress);
    console.log("New resolver key:", result.resolverKey.toString("base64"));

    writeFileSync(env.outputFile, JSON.stringify(result.transcript), "utf8");
  });

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// PUBLISH NEW RESOLVER TRANSACTION //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

program
  .command("publish-new-resolver")
  .option("-c, --config [file]", "configuration file", defaultConfig)
  .option("-t, --transcript [file]", "transcript file", defaultNewResolver)
  .action(async env => {
    try {
      const config: Config = JSON.parse(readFileSync(env.config, "utf8"));

      const web3 = new Web3(
        new Web3.providers.HttpProvider(
          `http://${config.net.host}:${config.net.port}`
        )
      );

      const entry: OfflineTranscriptEntry = JSON.parse(
        readFileSync(env.trascript, "utf8")
      );

      await publishInteractive(entry, web3, log);

      log.info("done");
    } catch (err) {
      log.error("Oh no!");
      log.error(err);
    }
  });

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// DEPLOY ADMINISTRATION CONTRACT //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

program
  .command("new-administration")
  .option("-c, --config [file]", "configuration file", defaultConfig)
  .option("-s, --spec [file]", "specification file", defaultAdminSpec)
  .option("-t, --transcript [file]", "transcript file", defaultReport)
  .option("-g, --gasPrice [gweiPrice]", "gas price to use in gwei", 5)
  .action(env => {
    configRT.decode(JSON.parse(readFileSync(env.config, "utf8"))).fold(
      errs => {
        log.error("Malformed configuration");
      },
      config => {
        const web3 = new Web3(
          new Web3.providers.HttpProvider(
            `http://${config.net.host}:${config.net.port}`
          )
        );

        adminSpecRT.decode(JSON.parse(readFileSync(env.spec, "utf8"))).fold(
          errs => {
            log.error("Malformed administration spec");
          },
          async spec => {
            checkOutput(env.transcript);

            const hash = web3.eth
              .contract(Administration.abi)
              .new(
                spec.tokenLogic,
                spec.tokenFront,
                spec.cosignerA,
                spec.cosignerB,
                spec.cosignerC,
                { gas: 1.5e6 }
              );

            const adminAddress = (await txReceipt(web3.eth, hash))
              .contractAddress;

            log.info(`Administration deployed to: ${adminAddress}`);

            writeFileSync(
              env.transcript,
              JSON.stringify({ adminAddress }),
              "utf8"
            );
          }
        );
      }
    );
  });

program
  .command("audit-administration")
  .option("-c, --config [file]", "configuration file", defaultConfig)
  .option("-s, --spec [file]", "specification file", defaultAdminSpec)
  .option("-t, --transcript [file]", "transcript file", defaultReport)
  .action(env => {
    configRT.decode(JSON.parse(readFileSync(env.config, "utf8"))).fold(
      errs => {
        log.error("Malformed configuration");
      },
      config => {
        const web3 = new Web3(
          new Web3.providers.HttpProvider(
            `http://${config.net.host}:${config.net.port}`
          )
        );

        adminSpecRT.decode(JSON.parse(readFileSync(env.spec, "utf8"))).fold(
          errs => {
            log.error("Malformed administration spec");
          },
          spec => {
            try {
              const { adminAddress } = JSON.parse(
                readFileSync(env.transcript, "utf8")
              );

              const admin = web3.eth
                .contract(Administration.abi)
                .at(adminAddress);

              assert.equal(
                admin.tokenLogic.call(),
                spec.tokenLogic,
                "tokenLogic"
              );
              assert.equal(
                admin.tokenFront.call(),
                spec.tokenFront,
                "tokenFront"
              );
              assert.equal(admin.cosignerA, spec.cosignerA, "cosignerA");
              assert.equal(admin.cosignerB, spec.cosignerB, "cosignerB");
              assert.equal(admin.cosignerC, spec.cosignerC, "cosignerC");
            } catch (err) {
              log.error("Audit failed: " + err.message);
            }
          }
        );
      }
    );
  });

program.parse(process.argv);

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

function checkOutput(outputFile: string) {
  // We will never overwrite the output file
  if (existsSync(outputFile)) {
    log.error(
      `The output target ${outputFile} exists already.  Please deal with it.  Aborting!`
    );
    process.exitCode = 1;
    return;
  }
}
