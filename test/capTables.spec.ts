import { CapTables } from "../src/Contracts";
import { txReceipt } from "../src/Web3";
import { assertSuccess, roles as getRoles } from "./Support";

import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
const roles = getRoles(web3);
const controller = roles.controller;

describe("CapTables", () => {
  describe("initialize", () => {
    it("should initialize a security", async () => {
      const { transactionHash } = web3.eth.contract(CapTables.abi).new({
        data: CapTables.bytecode,
        from: controller,
        gas: 5e5
      });
      const { contractAddress } = await txReceipt(web3.eth, transactionHash);
      const CT = web3.eth.contract(CapTables.abi).at(contractAddress as string);
      const amount1 = new BigNumber(1e5);
      const tx1 = CT.initialize(amount1, roles.issuer, {
        from: controller,
        gas: 5e5
      });
      const rec0 = await txReceipt(web3.eth, tx1);
      assertSuccess(rec0);
      assert(rec0.logs.length === 1, "log length");
      const id0 = new BigNumber(rec0.logs[0].data.slice(2), 16);
      assert(id0.equals(0), "id 1");
      const bal = CT.balanceOf.call(id0, roles.issuer);
      assert(bal.equals(amount1), "balance");
      const tx2 = CT.initialize(1e20, roles.investor1, {
        from: controller,
        gas: 5e5
      });
      const rec1 = await txReceipt(web3.eth, tx2);
      const id1 = new BigNumber(rec1.logs[0].data.slice(2), 16);
      assert(id1.equals(1), "id 2: " + id1.toString());
    }).timeout(10e3);
  });
  describe("migrate", () => {
    it("should migrate a security", async () => {
      const { transactionHash } = web3.eth.contract(CapTables.abi).new({
        data: CapTables.bytecode,
        from: controller,
        gas: 5e5
      });
      const { contractAddress } = await txReceipt(web3.eth, transactionHash);
      const CT = web3.eth.contract(CapTables.abi).at(contractAddress as string);
      const amount1 = new BigNumber(1e5);
      const tx1 = CT.initialize(amount1, roles.issuer, {
        from: controller,
        gas: 5e5
      });
      const rec0 = await txReceipt(web3.eth, tx1);
      assertSuccess(rec0);
      const newManager = web3.eth.accounts[9];
      const tx2 = CT.migrate(0, newManager, {
        from: roles.issuer,
        gas: 5e5
      });
      const rec2 = await txReceipt(web3.eth, tx2);
      assertSuccess(rec2);
      const observedManager = CT.addresses.call(0);
      assert.equal(observedManager, newManager, "manager");
    });
  });
  describe("transfer", function() {
    this.timeout(15e3);
    let CT: Web3.ContractInstance;
    let securityId: BigNumber;
    before(async () => {
      const { transactionHash } = web3.eth.contract(CapTables.abi).new({
        data: CapTables.bytecode,
        from: controller,
        gas: 1e6
      });
      const { contractAddress } = await txReceipt(web3.eth, transactionHash);
      CT = web3.eth.contract(CapTables.abi).at(contractAddress as string);
      const tx0 = CT.initialize(1e5, roles.issuer, {
        from: controller,
        gas: 5e5
      });
      const rec0 = await txReceipt(web3.eth, tx0);
      securityId = new BigNumber(rec0.logs[0].data.slice(2), 16);
    });
    it("should transfer funds", async () => {
      const tx1 = CT.transfer(securityId, roles.issuer, roles.investor1, 1e3, {
        from: roles.issuer
      });
      const rec1 = await txReceipt(web3.eth, tx1);
      assertSuccess(rec1);
    }).timeout(10e3);
  });
});
