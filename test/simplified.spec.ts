import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

import { success, txReceipt } from "@cfxmarkets/web3-utils";

import { ABI } from "../src/Contracts";
import { SimplifiedLogic } from "../src/Simplified/Contracts";
import { init } from "../src/Simplified/Init";
import { issue } from "../src/Simplified/Issue";
import { handleTransfers, TransferRequest } from "../src/Simplified/Monitor";

import { environment } from "./Support";

const prov = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(prov);

const env = environment(web3);
const controller = env.roles.controller;

const test = async (n: number) => {
  const capTables = await init(controller, web3.eth);
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
      assert.equal(tr.src, env.roles.investor1, "src");
      assert.equal(tr.dest, env.roles.investor3, "dest");
      assert(tr.amount.equals(1e2), "amount");
      assert.equal(tr.spender, tr.src, "spender");
      return Promise.resolve(0);
    };
    let finalized = false;
    const finalization = async (txr: TransferRequest, txHash: string) => {
      finalized = true;
    };
    console.log("Attempting the transfer");
    const tokenFront = web3.eth.contract(ABI.TokenFront.abi).at(front);
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
    const nextTxfrIndex = await handleTransfers(
      middleware,
      env.roles.controller,
      new BigNumber(0),
      web3.eth,
      decision,
      finalization
    );
    assert(nextTxfrIndex.equals(1), "next transfer index");
    assert(finalized, "finalized");
    const bal1 = tokenFront.balanceOf.call(env.roles.investor1);
    assert(
      bal1.equals(security.investors[0].amount.sub(1e2)),
      "token balance 1"
    );
    const bal2 = tokenFront.balanceOf.call(env.roles.investor2);
    assert(bal2.equals(security.investors[1].amount), "token balance 2");
    const bal3 = tokenFront.balanceOf.call(env.roles.investor3);
    assert(bal3.equals(1e2), "token balance 3");
  } else if (n == 3) {
    const decision = (tr: TransferRequest) => {
      return Promise.resolve(1);
    };
    const finalization = async (txr: TransferRequest, txHash: string) => {
      const rec = await txReceipt(web3.eth, txHash);
      assert.equal(rec.logs.length, 1, "log length");
      assert(
        new BigNumber(rec.logs[0].data.slice(2), 16).equals(1),
        "error code"
      );
    };
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
    await handleTransfers(
      middleware,
      env.roles.controller,
      new BigNumber(0),
      web3.eth,
      decision,
      finalization
    );
    // Check the balances
    const bal1 = tokenFront.balanceOf.call(env.roles.investor1);
    assert(bal1.equals(security.investors[0].amount), "token balance 1");
    const bal2 = tokenFront.balanceOf.call(env.roles.investor2);
    assert(bal2.equals(security.investors[1].amount), "token balance 2");
    const bal3 = tokenFront.balanceOf.call(env.roles.investor3);
    assert(bal3.equals(0), "token balance 3");
  } else if (n >= 4) {
    const decision = (tr: TransferRequest) => {
      const result = tr.index.equals(1) ? 1 : 0;
      return Promise.resolve(result);
    };
    const finalization = async (txr: TransferRequest, txHash: string) => {
      const rec = await txReceipt(web3.eth, txHash);
      assert.equal(rec.logs.length, 1, "log length");
      const data = rec.logs[0].data;
      const observedIndex = new BigNumber(data.slice(2, 2 + 64), 16);
      assert(txr.index.equals(observedIndex), "indices");
      const errorCode = new BigNumber(data.slice(2 + 64), 16);
      const targetCode = txr.index.equals(1) ? 1 : 0;
      assert.equal(errorCode.toNumber(), targetCode, "error code");
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
    if (n >= 5) {
      console.log("trying migration");
      // Try to migrate
      const oldMiddleware = web3.eth
        .contract(SimplifiedLogic.abi)
        .at(middleware);
      console.log("deploying new middleware");
      const txNewMiddleware = web3.eth
        .contract(SimplifiedLogic.abi)
        .new(securityId, capTables, {
          data: SimplifiedLogic.bytecode,
          from: controller,
          gas: 1.5e6
        });
      const recNewMiddleware = await txReceipt(
        web3.eth,
        txNewMiddleware.transactionHash
      );
      const newMiddlewareAddress = recNewMiddleware.contractAddress as string;
      const newMiddleware = web3.eth
        .contract(SimplifiedLogic.abi)
        .at(newMiddlewareAddress);
      console.log("setting new front");
      const txNewSetFront = newMiddleware.setFront(front, {
        from: controller,
        gas: 5e5
      });
      const recNewSetFront = await txReceipt(web3.eth, txNewSetFront);
      assert(success(recNewSetFront), "set new front");
      console.log("migrating old middleware");
      const txMigrate = oldMiddleware.migrate(newMiddlewareAddress, {
        from: controller,
        gas: 5e5
      });
      const recMigrate = await txReceipt(web3.eth, txMigrate);
      assert(success(recMigrate), "migration");
      console.log("migrating front");
      const txFrontMigrate = tokenFront.migrate(newMiddlewareAddress, {
        from: controller,
        gas: 5e5
      });
      const recFrontMigrate = await txReceipt(web3.eth, txFrontMigrate);
      assert(success(recFrontMigrate), "front migration");
      const observedFront = newMiddleware.front.call();
      assert.equal(front, observedFront, "observed front");
      const observedMW = tokenFront.tokenLogic.call();
      assert.equal(newMiddlewareAddress, observedMW, "middleware address");
      const observedActive = oldMiddleware.contractActive.call();
      assert(!observedActive, "old contract activity");
    }
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
  it("should migrate", async () => {
    await test(5);
  }).timeout(10e3);
});
