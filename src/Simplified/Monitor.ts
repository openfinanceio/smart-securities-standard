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
  spender: Address;
}

export type TransferRequest = Transfer & { index: BigNumber };

export enum TransferStatus {
  Unused = 0,
  Active,
  Resolved
}

export async function handleTransfers(
  logicAddress: Address,
  controller: Address,
  startingIndex: BigNumber,
  eth: Web3.EthApi,
  decision: (tr: Transfer) => Promise<number>,
  finalization: (txHash: string, index: BigNumber) => Promise<void>
): Promise<BigNumber> {
  const simplifiedLogic = eth.contract(SimplifiedLogic.abi).at(logicAddress);
  let workingIndex = new BigNumber(startingIndex);
  while (
    !simplifiedLogic.resolutionStatus
      .call(workingIndex)
      .equals(TransferStatus.Unused)
  ) {
    const [src, dest, amount, spender] = simplifiedLogic.pending.call(
      workingIndex
    );
    const txr = { index: workingIndex, src, dest, amount, spender };
    const code = await decision(txr);
    const txResolve = simplifiedLogic.resolve(txr.index, code, {
      from: controller,
      gas: 5e5
    });
    const recResolve = await txReceipt(eth, txResolve);
    if (!success(recResolve)) {
      throw Error(`Resolution failed for ${txr.index}`);
    }
    await finalization(txResolve, txr.index);
    workingIndex = workingIndex.plus(1);
  }
  return workingIndex;
}
