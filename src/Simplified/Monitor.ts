import { SimplifiedLogic } from "./Contracts";
import { Address } from "../Types";
import { BigNumber } from "bignumber.js";
import Heap = require("heap");
import * as Web3 from "web3";
import { success, txReceipt } from "@cfxmarkets/web3-utils";

export interface Transfer {
  src: Address;
  dest: Address;
  amount: BigNumber;
  sender: Address;
}

export type TransferRequest = Transfer & { index: BigNumber };

export function handleTransfers(
  logicAddress: Address,
  controller: Address,
  startingIndex: BigNumber,
  eth: Web3.EthApi,
  decision: (tr: Transfer) => Promise<number>,
  finalization: (txHash: string) => Promise<void>
) {
  let workingIndex = new BigNumber(startingIndex);
  const transferQueue: Heap<TransferRequest> = new Heap(
    (a: TransferRequest, b: TransferRequest) => {
      return a.index.comparedTo(b.index);
    }
  );
  const simplifiedLogic = eth.contract(SimplifiedLogic.abi).at(logicAddress);
  const filter = simplifiedLogic.TransferRequest(
    async (err: Error, log: { args: TransferRequest }) => {
      if (err !== null) {
        // Log error or something
        logError(err.message);
        return;
      }
      if (log.args.index.lessThan(workingIndex)) {
        // Presumably this is a replay of an old message
        return;
      }
      transferQueue.push(log.args);
      const resolve = async (txr: TransferRequest) => {
        const code = await decision(txr);
        const txResolve = simplifiedLogic.resolve(txr.index, code, {
          from: controller,
          gas: 5e5
        });
        const recResolve = await txReceipt(eth, txResolve);
        if (!success(recResolve)) {
          throw Error(`Resolution failed for ${txr.index}`);
        }
        await finalization(txResolve);
      };
      while (
        transferQueue.size() > 0 &&
        transferQueue.peek().index.equals(workingIndex)
      ) {
        workingIndex = workingIndex.plus(1);
        const txr = transferQueue.pop();
        logInfo(`Handling ${txr.index.toString()}`);
        await resolve(txr);
      }
    }
  );
  return filter;
}

function logError(msg: string) {
  console.log(msg);
}

function logInfo(msg: string) {
  console.log(msg);
}
