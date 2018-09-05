import { CapTables } from "./Contracts";
import { Address } from "./Types";
import { txReceipt } from "./Web3";

import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

/**
 * Create a new CapTables contract, the linchpin of the S3 ecosystem.  
 * @param controller this address owns the contract in the sense of zeppelin-solidity/Ownable
 * @param gasPrice in Wei
 * @returns the deployed address of the contract
 */
export async function init(
  controller: Address,
  gasPrice: BigNumber,
  eth: Web3.EthApi
): Promise<Address> {
  const { transactionHash } = eth.contract(CapTables.abi).new({
    from: controller,
    data: CapTables.bytecode,
    gas: 1e6,
    gasPrice
  });
  const { contractAddress } = await txReceipt(eth, transactionHash);
  return contractAddress as Address;
}
