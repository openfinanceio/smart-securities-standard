import * as readline from "readline";
import * as Web3 from "web3";
import { Logger } from "winston";

import { OfflineTranscriptEntry } from "../../src";

export async function publishInteractive(
  choices: Map<number, OfflineTranscriptEntry>,
  web3: Web3,
  log: Logger
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
