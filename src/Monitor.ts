import { SimplifiedLogic } from "./Contracts";
import { Address } from "./Types";
import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";
import { success, txReceipt } from "./Web3";

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

/**
 * This function processes the longest consecutive sequence of active
 * TransferRequests by invoking `decision` on each one, recording the
 * result to the contract at `logicAddress`, then invoking `finalization`.
 */
export async function handleTransfers<A>(
  logicAddress: Address,
  controller: Address,
  startingIndex: BigNumber,
  eth: Web3.EthApi,
  decision: (tr: Transfer) => Promise<[number, A]>,
  finalization: (txHash: string, extraData: A) => Promise<void>
): Promise<BigNumber> {
  const simplifiedLogic = eth.contract(SimplifiedLogic.abi).at(logicAddress);
  let workingIndex = new BigNumber(startingIndex);
  const checkActive = (index: BigNumber) => {
    const [, , , , transferStatus] = simplifiedLogic.transferRequests.call(
      index
    );
    return transferStatus.equals(TransferStatus.Active);
  };
  while (checkActive(workingIndex)) {
    const [src, dest, amount, spender] = simplifiedLogic.transferRequests.call(
      workingIndex
    );
    const txr = { index: workingIndex, src, dest, amount, spender };
    const [code, extraData] = await decision(txr);
    const txResolve = simplifiedLogic.resolve(txr.index, code, {
      from: controller,
      gas: 5e5
    });
    workingIndex = workingIndex.plus(1);
    const recResolve = await txReceipt(eth, txResolve);
    if (!success(recResolve)) {
      throw Error(`Resolution failed for ${txr.index}`);
    }
    await finalization(txResolve, extraData);
  }
  return workingIndex;
}
