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
  if (n < 2) {
    return;
  }
  const decision = (tr: TransferRequest) => {
    console.log("decision");
    return Promise.resolve(0);
  };
  let filter: any;
  const finalization = async (txHash: string) => {
    console.log("finalize", txHash);
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
};

describe("Simplified s3", () => {
  describe("megatest", () => {
    it("should init s4", async () => {
      await test(0);
    });
    it("should issue on s4", async () => {
      await test(1);
    });
    it("should transfer issued tokens", async () => {
      await test(2);
    });
  });
});
