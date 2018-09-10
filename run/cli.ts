// cli tool for S3

import * as program from "commander";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as Web3 from "web3";

import { init } from "../src/Init";
import { issue } from "../src/Issue";
import { BaseSecurity, Transcript } from "../src/Types";

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
   * Each security to be issued should be in a separate JSON file, listed in this array.
   */
  securityPaths: string[];
}

interface S3 {
  name: string;
  capTables: string;
  front: string;
  logic: string;
}

interface Report {
  transcript: Transcript;
  ethState: {
    capTables: string;
    securities: Array<S3>;
  };
}

const PWD = process.env["PWD"];
const defaultConfig = `${PWD}/S3-conf.json`;
const defaultSpec = `${PWD}/S3-spec.json`;
const defaultReport = `${PWD}/S3-report.json`;

program
  .option(
    "-c, --config [file]",
    `path the configuration file; default ${defaultConfig}`,
    defaultConfig
  )
  .option(
    "-d, --declaration [file]",
    `path to the declaration file; default: ${defaultSpec}`,
    defaultSpec
  )
  .option(
    "-o, --output [file]",
    `path to the output file, with the action report; default ${defaultReport}`,
    defaultReport
  )
  .parse(process.argv);

async function execute(
  configFile: string,
  declarationFile: string,
  outputFile: string
) {
  // We will never overwrite the output file
  if (existsSync(outputFile)) {
    console.log(
      `The output target ${outputFile} exists already.  Please deal with it.  Aborting!`
    );
    process.exit(1);
  }
  try {
    // Let's read in the configuration
    const config: Config = JSON.parse(readFileSync(configFile, "utf8"));
    // ... and the program that we're supposed to execute
    const spec: Spec = JSON.parse(readFileSync(declarationFile, "utf8"));
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
    for (let path of spec.securityPaths) {
      try {
        const security: BaseSecurity = JSON.parse(readFileSync(path, "utf8"));
        const [{ front, middleware }, issueTranscript] = await issue(
          security,
          capTables,
          config.controller,
          gasPrice(),
          web3.eth
        );
        transcripts.push(issueTranscript);
        deployments.push({
          name: security.metadata.name,
          capTables,
          front,
          logic: middleware
        });
      } catch (err) {
        console.log("There was a problem handling", path);
        console.log(err);
      }
    }
    const report: Report = {
      transcript: transcripts.reduce((result, tr) => result.concat(tr), []),
      ethState: {
        capTables,
        securities: deployments
      }
    };
    writeFileSync(outputFile, JSON.stringify(report), "utf8");
  } catch (err) {
    console.log("Oops there was a problem: ", err);
  }
}

execute(program.config, program.declaration, program.output);
