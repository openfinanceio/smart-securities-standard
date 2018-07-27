// Standard helper functions for Web3

import { TransactionReceipt } from "ethereum-types";
import * as Web3 from "web3";

export function txReceipt(eth: Web3.EthApi, txHash: string): Promise<TransactionReceipt> {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      eth.getTransactionReceipt(txHash, (err: Error, receipt: TransactionReceipt) => {
        if (err !== null) {
          reject(err);
        } else if (receipt !== null) {
          resolve(receipt);
        } else {
          setTimeout(attempt, 1e3);
        }
      });
    };
    attempt();
  });
}

export function success(txr: TransactionReceipt): boolean {
  return txr.status === 1 || txr.status === "0x1" || txr.status === "0x01";
}
