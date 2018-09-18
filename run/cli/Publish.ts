import { BigNumber } from "bignumber.js";
import * as readline from "readline";
import * as Web3 from "web3";
import { Logger } from "winston";

import { OfflineTranscriptEntry } from "../../src";
import { gweiToWei } from "./Util";

export async function publishInteractive(
  entry: OfflineTranscriptEntry,
  web3: Web3,
  log: Logger
): Promise<string> {
  return new Promise(resolve => {
    const choices = new Map(entry.signedTxes);
    const gasPrices = entry.signedTxes.map(([weiPrice]) =>
      new BigNumber(weiPrice, 16).dividedBy(1e9).toString()
    );
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const attempt = () =>
      rl.question(
        `Now: ${
          entry.description
        }\x0aChoose the gas price you would like to use: \x0a${gasPrices.join(
          " "
        )}\x0a`,
        answer => {
          try {
            const gasChoice = gweiToWei(parseInt(answer));
            if (choices.has(gasChoice)) {
              const signedData = choices.get(gasChoice) as string;
              const hash = web3.eth.sendRawTransaction(signedData);
              log.info(`sent: ${hash}`);
              rl.question(
                "Type retry if you would like to try with more gas; and return to continue.\x0a",
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
