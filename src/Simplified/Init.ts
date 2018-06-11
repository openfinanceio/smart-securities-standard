import { ABI } from "../Contracts";
import { Address } from "../Types";

import { txReceipt } from "@cfxmarkets/web3-utils";
import * as Web3 from "web3";

export async function init(
  controller: Address,
  eth: Web3.EthApi
): Promise<Address> {
  const { transactionHash } = eth.contract(ABI.CapTables.abi).new({
    from: controller,
    data: ABI.CapTables.bytecode,
    gas: 1e6
  });
  const { contractAddress } = await txReceipt(eth, transactionHash);
  return contractAddress as Address;
}
