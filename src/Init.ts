import { CapTables } from "./Contracts";
import { Address, Transcript, TranscriptEntry } from "./Types";
import { txReceipt } from "./Web3";

import * as Web3 from "web3";

/**
 * Create a new CapTables contract, the linchpin of the S3 ecosystem.
 * @param controller this address owns the contract in the sense of zeppelin-solidity/Ownable
 * @param gasPrice in Wei
 * @returns Promise<Address> the deployed address of the contract
 */
export async function init(
  controller: Address,
  gasPrice: string,
  eth: Web3.EthApi
): Promise<[Address, Transcript]> {
  const { transactionHash } = eth.contract(CapTables.abi).new({
    from: controller,
    data: CapTables.bytecode,
    gas: 1e6,
    gasPrice
  });
  const { contractAddress, gasUsed } = await txReceipt(eth, transactionHash);
  const capTables = contractAddress as string;
  const thisEntry: TranscriptEntry = {
    type: "send",
    description: "Deployed a new CapTables instance",
    hash: transactionHash,
    gasUsed,
    data: {
      capTables
    }
  };
  return [capTables, [thisEntry]];
}
