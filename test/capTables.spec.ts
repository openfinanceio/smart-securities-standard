import { ABI } from "../src/Contracts";
import { environment } from "./fixtures";

import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import { txReceipt } from "@cfxmarkets/web3-utils";
import * as Web3 from "web3";

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const env = environment(web3);

describe("CapTables", () => {
  describe("deploy", () => {});
  describe("initialize", () => {
    it("should initialize a security");
  });
  describe("migrate", () => {
    it("should migrate a security");
  });
  describe("transfer", function() {
    this.timeout(10e3);
    let CT: Web3.ContractInstance;
    let securityId: BigNumber;
    before(done => {
      web3.eth.contract(ABI.CapTables.abi).new(
        {
          data: ABI.CapTables.bytecode,
          from: env.roles.controller,
          gas: 5e5
        },
        async (err: Error, instance: Web3.ContractInstance) => {
          assert(err === null, "new contract");
          if (instance.address === undefined) {
            return;
          }
          CT = instance;
          const tx0 = CT.initialize(1e5, env.roles.issuer, {
            from: env.roles.controller
          });
          const rec0 = await txReceipt(web3.eth, tx0);
          securityId = new BigNumber(rec0.logs[0].data.slice(2), 16);
          done();
        }
      );
    });
    it("should transfer funds", async () => {
      const tx1 = CT.transfer(
        securityId,
        env.roles.issuer,
        env.roles.investor1,
        1e3,
        { from: env.roles.issuer }
      );
      const rec1 = await txReceipt(web3.eth, tx1);
      assert(rec1.status === "0x1", "the transaction should succed");
    }).timeout(10e3);
  });
});
