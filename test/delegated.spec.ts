import { assertSuccess, environment } from "./Support";
import { MockDelegated } from "./Mocks";
import { ABI } from "../src/Contracts";

import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

const prov = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(prov);
const env = environment(web3);
const controller = env.roles.controller;
const seconds = 1e3;

import * as assert from "assert";
import { txReceipt } from "@cfxmarkets/web3-utils";

describe("DelegatedTokenLogic", () => {
  describe("Megatest", () => {
    it("should deploy the mock and make a transfer", async () => {
      // CapTables
      const ctTx = web3.eth.contract(ABI.CapTables.abi).new({
        from: controller,
        gas: 1e6,
        data: ABI.CapTables.bytecode
      });
      const ctReceipt = await txReceipt(web3.eth, ctTx.transactionHash);
      assertSuccess(ctReceipt);
      const ctAddr = ctReceipt.contractAddress as string;
      const CT = web3.eth.contract(ABI.CapTables.abi).at(ctAddr);
      const supply = new BigNumber(1e6);
      const initTx = CT.initialize(supply, controller, {
        from: controller,
        gas: 5e5
      });
      const initReceipt = await txReceipt(web3.eth, initTx);
      assertSuccess(initReceipt);
      // Token
      const tkTx = web3.eth.contract(MockDelegated.abi).new(ctAddr, 0, {
        from: controller,
        gas: 1e6,
        data: MockDelegated.bytecode
      });
      const tkReceipt = await txReceipt(web3.eth, tkTx.transactionHash);
      assertSuccess(tkReceipt);
      const tkAddr = tkReceipt.contractAddress as string;
      const Token = web3.eth.contract(MockDelegated.abi).at(tkAddr);
      const txMigrate = CT.migrate(new BigNumber(0), tkAddr, {
        from: controller,
        gas: 5e5
      });
      const migrateReceipt = await txReceipt(web3.eth, txMigrate);
      assertSuccess(migrateReceipt);
      // Front
      const frTx = web3.eth.contract(ABI.TokenFront.abi).new(tkAddr, {
        from: controller,
        gas: 1e6,
        data: ABI.TokenFront.bytecode
      });
      const frReceipt = await txReceipt(web3.eth, frTx.transactionHash);
      assertSuccess(frReceipt);
      const frAddr = frReceipt.contractAddress as string;
      const Front = web3.eth.contract(ABI.TokenFront.abi).at(frAddr);
      const txSetF = Token.setFront(frAddr, {
        from: controller,
        gas: 5e5
      });
      const setFReceipt = await txReceipt(web3.eth, txSetF);
      assertSuccess(setFReceipt);
      // Usage
      // Balance
      const balController = Front.balanceOf.call(controller);
      assert(balController.equals(supply), "distribution");
      const amountInv1 = new BigNumber(1e2);
      const txTransfer = Front.transfer(env.roles.investor1, amountInv1, {
        from: controller,
        gal: 5e5
      });
      await txReceipt(web3.eth, txTransfer);
      const balControllerAfter = Front.balanceOf.call(controller);
      const balInvestor1 = Front.balanceOf.call(env.roles.investor1);
      assert(
        balControllerAfter.equals(supply.minus(amountInv1)),
        "controller after transfer"
      );
      assert(balInvestor1.equals(amountInv1), "investor after transfer");
    }).timeout(12 * seconds);
  });
});
