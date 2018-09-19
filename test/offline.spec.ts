// TEST: Offline deployment

import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import { randomBytes } from "crypto";
import * as Web3 from "web3";

import { getRoles } from "./Support";
import * as S3 from "../src";
import * as U from "../src/Util";
import { txReceipt } from "../src/Web3";

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const roles = getRoles(web3);
const chainId = parseInt(web3.version.network);

const security = {
  metadata: { name: "TestSecurity" },
  investors: [
    {
      address: roles.investor1,
      amount: new BigNumber(1e5)
    },
    {
      address: roles.investor2,
      amount: new BigNumber(1e7)
    }
  ],
  admin: roles.securityOwner
};

// ~~~~~ //
// TESTS //
// ~~~~~ //

describe("offline deployment", () => {
  it("should initialize the cap table", async () => {
    const [capTables] = await S3.init(roles.controller, "0", web3.eth);
    const [
      ephemeralController,
      ephemeralControllerAddress
    ] = await fundedController(roles.controller);
    // First security
    {
      const [newNonce, entry] = S3.issueOffline.initialize(security, {
        capTablesAddress: capTables,
        controller: ephemeralController,
        startingNonce: 0,
        gasPrices: ["0"],
        chainId
      });
      assert.equal(newNonce, 1, "should only increment the nonce by one");
      assert.equal(entry.signedTxes.length, 1, "should only produce one entry");
      const [, txData] = entry.signedTxes[0];
      const hash = web3.eth.sendRawTransaction(txData);
      const securityId = await getSecurityId(hash);
      assert.equal(securityId.toNumber(), 0, "correct SID");
    }
    // Second security
    {
      const [, entry] = S3.issueOffline.initialize(security, {
        capTablesAddress: capTables,
        controller: ephemeralController,
        startingNonce: 1,
        gasPrices: ["0"],
        chainId
      });
      const [, txData] = entry.signedTxes[0];
      const hash = web3.eth.sendRawTransaction(txData);
      const securityId = await getSecurityId(hash);
      assert.equal(securityId.toNumber(), 1, "correct SID");
    }
  });
  it("should configure the cap table", async () => {
    const [capTable] = await S3.init(roles.controller, "0", web3.eth);
    const [
      ephemeralController,
      ephemeralControllerAddress
    ] = await fundedController(roles.controller);
    const [newNonce, entry] = S3.issueOffline.initialize(security, {
      capTablesAddress: capTable,
      controller: ephemeralController,
      startingNonce: 0,
      gasPrices: ["0"],
      chainId
    });
    const hash = web3.eth.sendRawTransaction(entry.signedTxes[0][1]);
    const securityId = await getSecurityId(hash);
    const [, entries] = S3.issueOffline.configure(security, securityId, {
      capTablesAddress: capTable,
      controller: ephemeralController,
      startingNonce: newNonce,
      gasPrices: ["0"],
      chainId
    });
    assert.equal(entries.length, 2, "should distribute to two investors");
    for (let entry of entries) {
      const hash = web3.eth.sendRawTransaction(entry.signedTxes[0][1]);
      await txReceipt(web3.eth, hash);
    }
    const capTablesInstance = web3.eth.contract(S3.CapTables.abi).at(capTable);
    security.investors.forEach(({ address, amount }) => {
      // Check the balance
      const bal = capTablesInstance.balanceOf.call(securityId, address);
      assert(bal.equals(amount), "balance should be correct");
    });
  });
});

// ~~~~~~~ //
// HELPERS //
// ~~~~~~~ //

const getSecurityId = async (hash: string) => {
  const receipt = await txReceipt(web3.eth, hash);
  return new BigNumber(receipt.logs[0].data.slice(2), 16);
};

const fund = async (src: string, dest: string) => {
  const hash = web3.eth.sendTransaction({ from: src, to: dest, value: 1e15 });
  return txReceipt(web3.eth, hash);
};

const fundedController: (
  src: string
) => Promise<[Buffer, string]> = async src => {
  const ephemeralController = randomBytes(32);
  const ephemeralControllerAddress = U.privToAddress(ephemeralController);
  await fund(roles.controller, ephemeralControllerAddress);
  return [ephemeralController, ephemeralControllerAddress];
};
