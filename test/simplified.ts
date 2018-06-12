import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

import { success, txReceipt } from "@cfxmarkets/web3-utils";

import { ABI } from "../src/Contracts";
import { init } from "../src/Simplified/Init";
import { issue } from "../src/Simplified/Issue";
import { handleTransfers, TransferRequest } from "../src/Simplified/Monitor";

import { environment } from "./Support";

const prov = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(prov);

const env = environment(web3);

const test = async (n: number) => {
  const capTables = await init(env.roles.controller, web3.eth);
  if (n < 1) {
    return;
  }
  const security = {
    investors: [
      { address: env.roles.investor1, amount: new BigNumber(1e5) },
      { address: env.roles.investor2, amount: new BigNumber(2e4) }
    ],
    issuer: env.roles.issuer,
    metadata: { name: "TheSecurity" },
    owner: env.roles.securityOwner
  };
  const { front, middleware, securityId } = await issue(
    security,
    capTables,
    env.roles.controller,
    web3.eth
  );
  if (n == 2) {
    const decision = (tr: TransferRequest) => {
      console.log("decision");
      assert.equal(tr.src, env.roles.investor1, "src");
      assert.equal(tr.dest, env.roles.investor3, "dest");
      assert(tr.amount.equals(1e2), "amount");
      assert.equal(tr.spender, tr.src, "spender");
      return Promise.resolve(0);
    };
    let filter: any;
    const finalization = async (txHash: string, index: BigNumber) => {
      console.log("finalize", txHash, index.toString());
      // Check the balances
      const tokenFront = web3.eth.contract(ABI.TokenFront.abi).at(front);
      const bal1 = tokenFront.balanceOf.call(env.roles.investor1);
      assert(
        bal1.equals(security.investors[0].amount.sub(1e2)),
        "token balance 1"
      );
      const bal2 = tokenFront.balanceOf.call(env.roles.investor2);
      assert(bal2.equals(security.investors[1].amount), "token balance 2");
      const bal3 = tokenFront.balanceOf.call(env.roles.investor3);
      assert(bal3.equals(1e2), "token balance 3");
      return;
    };
    console.log("Setting up transfer handler");
    filter = handleTransfers(
      middleware,
      env.roles.controller,
      new BigNumber(0),
      web3.eth,
      decision,
      finalization
    );
    const tokenFront = web3.eth.contract(ABI.TokenFront.abi).at(front);
    console.log("Attempting the transfer");
    const txTransfer = tokenFront.transfer(
      env.roles.investor3,
      new BigNumber(1e2),
      {
        from: env.roles.investor1,
        gas: 5e5
      }
    );
    const recTransfer = await txReceipt(web3.eth, txTransfer);
    assert(success(recTransfer), "transfer should succeed");
    setTimeout(() => {
      filter.stopWatching();
    }, 1e3);
  } else if (n == 3) {
    const decision = (tr: TransferRequest) => {
      console.log("decision");
      return Promise.resolve(1);
    };
    let filter: any;
    const finalization = async (txHash: string, index: BigNumber) => {
      console.log("finalize", txHash, index.toString());
      const rec = await txReceipt(web3.eth, txHash);
      assert.equal(rec.logs.length, 1, "log length");
      assert(
        new BigNumber(rec.logs[0].data.slice(2), 16).equals(1),
        "error code"
      );
      // Check the balances
      const tokenFront = web3.eth.contract(ABI.TokenFront.abi).at(front);
      const bal1 = tokenFront.balanceOf.call(env.roles.investor1);
      assert(bal1.equals(security.investors[0].amount), "token balance 1");
      const bal2 = tokenFront.balanceOf.call(env.roles.investor2);
      assert(bal2.equals(security.investors[1].amount), "token balance 2");
      const bal3 = tokenFront.balanceOf.call(env.roles.investor3);
      assert(bal3.equals(0), "token balance 3");
      filter.stopWatching();
      return;
    };
    console.log("Setting up transfer handler");
    filter = handleTransfers(
      middleware,
      env.roles.controller,
      new BigNumber(0),
      web3.eth,
      decision,
      finalization
    );
    const tokenFront = web3.eth.contract(ABI.TokenFront.abi).at(front);
    console.log("Attempting the transfer");
    const txTransfer = tokenFront.transfer(
      env.roles.investor3,
      new BigNumber(1e2),
      {
        from: env.roles.investor1,
        gas: 5e5
      }
    );
    const recTransfer = await txReceipt(web3.eth, txTransfer);
    assert(success(recTransfer), "transfer should succeed");
  } else if (n == 4) {
    const decision = (tr: TransferRequest) => {
      console.log("decision");
      const result = tr.index.equals(1) ? 1 : 0;
      return Promise.resolve(result);
    };
    const finalization = async (txHash: string, index: BigNumber) => {
      console.log("finalize", txHash, index.toString());
      const rec = await txReceipt(web3.eth, txHash);
      assert.equal(rec.logs.length, 1, "log length");
      const errorCode = new BigNumber(rec.logs[0].data.slice(2), 16);
      return;
    };
    console.log("Setting up transfer handler");
    const tokenFront = web3.eth.contract(ABI.TokenFront.abi).at(front);
    console.log("First transfer");
    const txTransfer = tokenFront.transfer(
      env.roles.investor3,
      new BigNumber(1e2),
      {
        from: env.roles.investor1,
        gas: 5e5
      }
    );
    await txReceipt(web3.eth, txTransfer);
    console.log("Second transfer");
    const txTransfer2 = tokenFront.transfer(
      env.roles.investor2,
      new BigNumber(10),
      {
        from: env.roles.investor1,
        gas: 5e5
      }
    );
    await txReceipt(web3.eth, txTransfer2);
    console.log("Third transfer");
    const txTransfer3 = tokenFront.transfer(
      env.roles.investor2,
      new BigNumber(15),
      {
        from: env.roles.investor3,
        gas: 5e5
      }
    );
    await txReceipt(web3.eth, txTransfer3);
    const nextTxfrIndex = await handleTransfers(
      middleware,
      env.roles.controller,
      new BigNumber(0),
      web3.eth,
      decision,
      finalization
    );
    assert(nextTxfrIndex.equals(3), "next index");
    // Check the balances
    console.log("Checking balances");
    const bal1 = tokenFront.balanceOf.call(env.roles.investor1);
    assert(
      bal1.equals(security.investors[0].amount.sub(1e2)),
      "token balance 1"
    );
    const bal2 = tokenFront.balanceOf.call(env.roles.investor2);
    assert(
      bal2.equals(security.investors[1].amount.plus(15)),
      "token balance 2"
    );
    const bal3 = tokenFront.balanceOf.call(env.roles.investor3);
    assert(bal3.equals(85), "token balance 3");
    console.log("Done!");
  }
};

describe("Simplified s3", () => {
  it("should init s4", async () => {
    await test(0);
  });
  it("should issue on s4", async () => {
    await test(1);
  });
  it("should transfer issued tokens", async () => {
    await test(2);
  }).timeout(10e3);
  it("should block the transfer of issued tokens", async () => {
    await test(3);
  }).timeout(10e3);
  it("should handle multiple transfers correctly", async () => {
    await test(4);
  }).timeout(10e3);
});
