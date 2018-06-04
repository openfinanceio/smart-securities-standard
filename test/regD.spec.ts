import * as fixtures from "./fixtures";
import { ABI } from "../src/Contracts";
import { Client } from "../src/S3";
import { Errors } from "../src/Types";

import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";
import { txReceipt } from "@cfxmarkets/web3-utils";
import * as sha3 from "web3/lib/utils/sha3";

const provider = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(provider);
const txSuccess = "0x1";

const env = fixtures.environment(web3);
const controller = env.roles.controller;

const setup = async () => {
  const s3 = new Client(controller, null, provider);
  // Set up S3, etc.
  await s3.initS3();
  // We need some user checkers too
  const amlKycAddr = await s3.initUserChecker([env.roles.checkers.amlKyc]);
  const accreditationAddr = await s3.initUserChecker([
    env.roles.checkers.accreditation
  ]);
  return {
    amlKycAddr,
    accreditationAddr,
    s3
  };
};

const transferErrorSig = sha3(
  "TransferError(address,address,address,uint256,uint16)"
);
const transferSig = sha3("Transfer(address,address,uint256)");

const configure = async () => {
  console.log("Setting up S3");
  const ecosystem = await setup();
  // Issue a security
  const security = env.security(
    env.roles.checkers.amlKyc,
    env.roles.checkers.accreditation,
    [
      {
        address: env.roles.investor1,
        amount: new BigNumber(1e5)
      }
    ]
  );
  console.log("Issuing");
  const result = await ecosystem.s3.issue(security);
  const front = result.front;
  const { contracts } = ecosystem.s3.state();
  if (contracts === null) {
    throw Error("no contracts!");
  }
  // KYC
  console.log("Setting up KYC");
  await ecosystem.s3.registerForKyc([env.roles.checkers.amlKyc]);
  const KYC = web3.eth.contract(ABI.SimpleUserChecker.abi).at(contracts.kyc);
  const confirmKYC = async (addr: string) => {
    const tx = KYC.confirmUser(addr, 0x01, {
      from: env.roles.checkers.amlKyc
    });
    await txReceipt(web3.eth, tx);
  };
  // Accreditation
  console.log("Setting up accreditation");
  await ecosystem.s3.registerForAccreditation([
    env.roles.checkers.accreditation
  ]);
  const Acc = web3.eth
    .contract(ABI.SimpleUserChecker.abi)
    .at(contracts.accreditation);
  const confirmAccreditation = async (addr: string) => {
    const tx = Acc.confirmUser(addr, 0x02, {
      from: env.roles.checkers.accreditation
    });
    await txReceipt(web3.eth, tx);
  };
  return { front, confirmKYC, confirmAccreditation };
};

const transferError = async (
  src: string,
  dest: string,
  front: string,
  target: Errors.RegD
) => {
  const T = web3.eth.contract(ABI.TokenFront.abi).at(front);
  const txHash = T.transfer(dest, 1e2, { from: src, gas: 5e5 });
  const receipt = await txReceipt(web3.eth, txHash);
  // FIXME: Make this less ad hoc
  assert(receipt.logs.length === 1, "should generate 1 log message");
  assert(
    receipt.logs[0].topics[0].slice(2) === transferErrorSig,
    "should generate the correct type of log message"
  );
  const errorCode = new BigNumber(receipt.logs[0].data.slice(2 + 64), 16);
  assert(
    errorCode.toNumber() === target,
    "wrong reason " + errorCode.toString()
  );
};

describe("Regulation D", () => {
  describe("user status", function() {
    this.timeout(35e3);
    let deployment: any;
    before(async () => {
      deployment = await configure();
    });
    it("should prevent unverified (KYC) investors from selling", async () => {
      await transferError(
        env.roles.investor1,
        env.roles.investor2,
        deployment.front,
        Errors.RegD.SellerAMLKYC
      );
    }).timeout(15e3);
    it("should prevent unverified (KYC) investors from buying", async () => {
      await deployment.confirmKYC(env.roles.investor1);
      await transferError(
        env.roles.investor1,
        env.roles.investor2,
        deployment.front,
        Errors.RegD.BuyerAMLKYC
      );
    }).timeout(15e3);
    it("should prevent unaccredited buying", async () => {
      await deployment.confirmKYC(env.roles.investor2);
      await transferError(
        env.roles.investor1,
        env.roles.investor2,
        deployment.front,
        Errors.RegD.Accreditation
      );
    }).timeout(15e3);
    it("should allow a transfer", async () => {
      await deployment.confirmAccreditation(env.roles.investor2);
      const T = web3.eth.contract(ABI.TokenFront.abi).at(deployment.front);
      const tx = T.transfer(env.roles.investor2, 1e2, {
        from: env.roles.investor1
      });
      const receipt = await txReceipt(web3.eth, tx);
      assert(receipt.status === txSuccess, "call should succeed");
      console.log(receipt);
      assert(receipt.logs.length === 1, "should be one log message");
      assert(
        receipt.logs[0].topics[0].slice(2) === transferSig,
        "should be a Transfer event"
      );
    }).timeout(15e3);
  });
  describe("limits", function() {
    this.timeout(5000);
    it("should prevent more than 99 shareholders");
    it("should prevent more than 2000 shareholders");
  });
  describe("vesting period", () => {
    it("should prevent transfer before the vesting period has finished");
  });
});
