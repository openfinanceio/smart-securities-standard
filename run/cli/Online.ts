import * as Web3 from "web3";
import { Logger } from "winston";

import { Config, OnlineReport, S3, Spec } from "./Types";
import { BaseSecurity, Transcript, init, issue } from "../../src";

export async function issueOnline(
  this: void,
  config: Config,
  spec: Spec,
  securities: Array<BaseSecurity>,
  gasPrice: () => string,
  web3: Web3,
  log: Logger
) {
  try {
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
        const [
          { securityId, front, middleware },
          issueTranscript
        ] = await issue(security, capTables, config.controller, gasPrice(), {
          eth: web3.eth,
          log
        });
        transcripts.push(issueTranscript);
        deployments.push({
          name: security.metadata.name,
          securityId: securityId.toString(),
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
    return report;
  } catch (err) {
    log.error(`Oops there was a problem: ${err}`);
    process.exitCode = 1;
    return;
  }
}
