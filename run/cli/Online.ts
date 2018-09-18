import { existsSync, readFileSync, writeFileSync } from "fs";
import * as Web3 from "web3";
import { Logger } from "winston";

import { Config, GasReport, OnlineReport, S3, Spec } from "./Types";
import { BaseSecurity, Transcript, init, issue } from "../../src";

export async function issueOnline(
  this: void,
  configFile: string,
  declarationFile: string,
  outputFile: string,
  log: Logger
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
