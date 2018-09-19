import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

import { success, txReceipt } from "../src/Web3";

import {
  BaseSecurity,
  SimplifiedTokenLogic,
  TokenFront,
  TransferRequest
} from "../src";
import * as S3 from "../src";
import { roles as getRoles, log } from "./Support";

const prov = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(prov);

const roles = getRoles(web3);
const controller = roles.controller;
const owner = roles.securityOwner;

// ~~~~~~~~~~~~~~~~ //
// REUSABLE ACTIONS //
// ~~~~~~~~~~~~~~~~ //

interface Issued {
  capTables: string;
  middleware: string;
  security: BaseSecurity;
  tokenFront: Web3.ContractInstance;
}

// Initialize a security
const init = () => S3.init(controller, "0", web3.eth);

// Issue a security to some shareholders
const issue: () => Promise<Issued> = async () => {
  const [capTables] = await init();
  const security = {
    investors: [
      { address: roles.investor1, amount: new BigNumber(1e5) },
      { address: roles.investor2, amount: new BigNumber(2e4) }
    ],
    metadata: { name: "TheSecurity" },
    admin: owner
  };
  const [{ front, middleware }] = await S3.issue(
    security,
    capTables,
    roles.controller,
    "0",
    {
      eth: web3.eth,
      log
    }
  );
  const tokenFront = web3.eth.contract(TokenFront.abi).at(front);
  return { security, capTables, tokenFront, middleware };
};

// Transfer some tokens successfully
const transfer = async ({
  security,
  tokenFront,
  middleware,
  capTables
}: Issued) => {
  const decision = (tr: TransferRequest) => {
    assert.equal(tr.src, roles.investor1, "src");
    assert.equal(tr.dest, roles.investor3, "dest");
    assert(tr.amount.equals(1e2), "amount");
    assert.equal(tr.spender, tr.src, "spender");
    return Promise.resolve([0, tr]) as Promise<[number, TransferRequest]>;
  };
  let finalized = false;
  const finalization = async (txHash: string, txr: TransferRequest) => {
    finalized = true;
  };
  console.log("Attempting the transfer");
  const txTransfer = tokenFront.transfer(roles.investor3, new BigNumber(1e2), {
    from: roles.investor1,
    gas: 5e5
  });
  const recTransfer = await txReceipt(web3.eth, txTransfer);
  assert(success(recTransfer), "transfer should succeed");
  const nextTxfrIndex = await S3.handleTransfers(
    middleware,
    controller,
    new BigNumber(0),
    web3.eth,
    decision,
    finalization
  );
  assert(nextTxfrIndex.equals(1), "next transfer index");
  assert(finalized, "finalized");
  const bal1 = tokenFront.balanceOf.call(roles.investor1);
  assert(bal1.equals(security.investors[0].amount.sub(1e2)), "token balance 1");
  const bal2 = tokenFront.balanceOf.call(roles.investor2);
  assert(bal2.equals(security.investors[1].amount), "token balance 2");
  const bal3 = tokenFront.balanceOf.call(roles.investor3);
  assert(bal3.equals(1e2), "token balance 3");
};

// Block a transfer
const block = async ({
  tokenFront,
  capTables,
  middleware,
  security
}: Issued) => {
  const decision = (tr: TransferRequest) => {
    return Promise.resolve([1, tr]) as Promise<[number, TransferRequest]>;
  };
  const finalization = async (txHash: string, txr: TransferRequest) => {
    const rec = await txReceipt(web3.eth, txHash);
    assert.equal(rec.logs.length, 1, "log length");
    assert(
      new BigNumber(rec.logs[0].data.slice(2), 16).equals(1),
      "error code"
    );
  };
  console.log("Attempting the transfer");
  const txTransfer = tokenFront.transfer(roles.investor3, new BigNumber(1e2), {
    from: roles.investor1,
    gas: 5e5
  });
  const recTransfer = await txReceipt(web3.eth, txTransfer);
  assert(success(recTransfer), "transfer should succeed");
  const highestIndex = await S3.handleTransfers(
    middleware,
    controller,
    new BigNumber(0),
    web3.eth,
    decision,
    finalization
  );
  assert(highestIndex.equals(1), "increment index");
  // Check the balances
  const bal1 = tokenFront.balanceOf.call(roles.investor1);
  assert(bal1.equals(security.investors[0].amount), "token balance 1");
  const bal2 = tokenFront.balanceOf.call(roles.investor2);
  assert(bal2.equals(security.investors[1].amount), "token balance 2");
  const bal3 = tokenFront.balanceOf.call(roles.investor3);
  assert(bal3.equals(0), "token balance 3");
};

// Deal with multiple incoming transfers
const multiple = async ({
  tokenFront,
  capTables,
  middleware,
  security
}: Issued) => {
  const decision = (tr: TransferRequest) => {
    const result = tr.index.equals(1) ? 1 : 0;
    return Promise.resolve([result, tr]) as Promise<[number, TransferRequest]>;
  };
  const finalization = async (txHash: string, txr: TransferRequest) => {
    const rec = await txReceipt(web3.eth, txHash);
    assert.equal(rec.logs.length, 1, "log length");
    const observedIndex = new BigNumber(rec.logs[0].topics[1].slice(2), 16);
    assert(txr.index.equals(observedIndex), "indices");
    const errorCode = new BigNumber(rec.logs[0].data.slice(2), 16);
    const targetCode = txr.index.equals(1) ? 1 : 0;
    assert.equal(errorCode.toNumber(), targetCode, "error code");
  };
  console.log("First transfer");
  const txTransfer = tokenFront.transfer(roles.investor3, new BigNumber(1e2), {
    from: roles.investor1,
    gas: 5e5
  });
  await txReceipt(web3.eth, txTransfer);
  console.log("Second transfer");
  const txTransfer2 = tokenFront.transfer(roles.investor2, new BigNumber(10), {
    from: roles.investor1,
    gas: 5e5
  });
  await txReceipt(web3.eth, txTransfer2);
  console.log("Third transfer");
  const txTransfer3 = tokenFront.transfer(roles.investor2, new BigNumber(15), {
    from: roles.investor3,
    gas: 5e5
  });
  await txReceipt(web3.eth, txTransfer3);
  const nextTxfrIndex = await S3.handleTransfers(
    middleware,
    controller,
    new BigNumber(0),
    web3.eth,
    decision,
    finalization
  );
  assert(nextTxfrIndex.equals(3), "next index");
  // Check the balances
  console.log("Checking balances");
  const bal1 = tokenFront.balanceOf.call(roles.investor1);
  assert(bal1.equals(security.investors[0].amount.sub(1e2)), "token balance 1");
  const bal2 = tokenFront.balanceOf.call(roles.investor2);
  assert(bal2.equals(security.investors[1].amount.plus(15)), "token balance 2");
  const bal3 = tokenFront.balanceOf.call(roles.investor3);
  assert(bal3.equals(85), "token balance 3");
};

// Migrate from one token logic contract to another one
const migrate = async ({
  tokenFront,
  middleware,
  security,
  capTables
}: Issued) => {
  const front = tokenFront.address;
  console.log("trying migration");
  // Try to migrate
  const oldMiddleware = web3.eth
    .contract(SimplifiedTokenLogic.abi)
    .at(middleware);
  const securityId = oldMiddleware.index.call();
  console.log("deploying new middleware");
  const txNewMiddleware = web3.eth
    .contract(SimplifiedTokenLogic.abi)
    .new(securityId, capTables, owner, controller, {
      data: SimplifiedTokenLogic.bytecode,
      from: controller,
      gas: 1.5e6
    });
  const recNewMiddleware = await txReceipt(
    web3.eth,
    txNewMiddleware.transactionHash
  );
  const newMiddlewareAddress = recNewMiddleware.contractAddress as string;
  const newMiddleware = web3.eth
    .contract(SimplifiedTokenLogic.abi)
    .at(newMiddlewareAddress);
  console.log("setting the front");
  const txNewSetFront = newMiddleware.setFront(front, {
    from: owner,
    gas: 5e5
  });
  const recNewSetFront = await txReceipt(web3.eth, txNewSetFront);
  assert(success(recNewSetFront), "set new front");
  console.log("migrating old middleware");
  const txMigrate = oldMiddleware.migrate(newMiddlewareAddress, {
    from: owner,
    gas: 5e5
  });
  const recMigrate = await txReceipt(web3.eth, txMigrate);
  assert(success(recMigrate), "migration");
  console.log("migrating front");
  const txFrontMigrate = tokenFront.migrate(newMiddlewareAddress, {
    from: owner,
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
};

// Embed everything in the framework
describe("Simplified s3", () => {
  it("should init s4", async () => {
    await init();
  });
  it("should issue on s4", async () => {
    await issue();
  });
  it("should transfer issued tokens", async () => {
    const bundle = await issue();
    await transfer(bundle);
  });
  it("should block the transfer of issued tokens", async () => {
    const bundle = await issue();
    await block(bundle);
  });
  it("should handle multiple transfers correctly", async () => {
    const bundle = await issue();
    await multiple(bundle);
  });
  it("should migrate", async () => {
    const bundle = await issue();
    await migrate(bundle);
  });
});
