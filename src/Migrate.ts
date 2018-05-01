import { Address, SecurityId } from "./Types";

import { SolidityFunction } from "web3/lib/web3/function";
import * as Web3 from "web3";

export async function setupExporter(
  this: void,
  id: SecurityId,
  configureToken: (exporter: Address) => Promise<Address>,
  controller: Address,
  web3: Web3
): Promise<Address> {
  throw Error("Not implemented!");
}

export async function setupImporter(
  this: void,
  srcToken: Address,
  configureToken: () => Promise<Address>,
  controller: Address,
  web3: Web3
): Promise<{ securityId: SecurityId; token: Address }> {
  throw Error("Not implemented!");
}

// function migrate(address newAddress);
const migrateABI = {
  name: "migrate",
  payable: false,
  constant: false,
  type: "function",
  inputs: [
    {
      name: "newAddress",
      type: "address"
    }
  ],
  outputs: [],
  stateMutability: "nonpayable"
};

export async function migrate(
  this: void,
  sid: SecurityId,
  newLogic: string,
  administrator: string,
  capTables: Web3.ContractInstance,
  web3: Web3
): Promise<void> {
  const tokenAddress = await capTables.addresses.call(sid);
  const mgrt = new SolidityFunction(web3.eth, migrateABI, tokenAddress);
  await mgrt.sendTransaction(newLogic, {
    from: administrator
  });
}
