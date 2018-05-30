import * as fixtures from "./fixtures";
import { ABI } from "../src/Contracts";
import { Client } from "../src/S3";
import { Security, Errors } from "../src/Types";

import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";
import * as sha3 from "web3/lib/utils/sha3";

const provider = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(provider);

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

describe("Regulation D", () => {
  describe("user status", function() {
    this.timeout(5000);
    let ecosystem;
    let front: string;
    let security: Security;
    before(async () => {
      console.log("Setting up S3");
      ecosystem = await setup();
      // Issue a security
      security = env.security(
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
      front = result.front;
      const { contracts } = ecosystem.s3.state();
      if (contracts === null) {
        throw Error("no contracts!");
      }
      // KYC
      console.log("Setting up KYC");
      await ecosystem.s3.registerForKyc([env.roles.checkers.amlKyc]);
      const KYC = web3.eth
        .contract(ABI.SimpleUserChecker.abi)
        .at(contracts.kyc);
      await KYC.confirmUser(env.roles.investor1, 0x01, {
        from: env.roles.checkers.amlKyc
      });
      // Accreditation
      console.log("Setting up accreditation");
      await ecosystem.s3.registerForAccreditation([
        env.roles.checkers.accreditation
      ]);
      const Acc = web3.eth
        .contract(ABI.SimpleUserChecker.abi)
        .at(contracts.accreditation);
      await Acc.confirmUser(env.roles.investor1, 0x02, {
        from: env.roles.checkers.accreditation
      });
      // Invariants
      const kyc1 = KYC.confirm.call(env.roles.investor1);
      const kyc2 = KYC.confirm.call(env.roles.investor2);
      const acc1 = KYC.confirm.call(env.roles.investor1);
      const acc2 = KYC.confirm.call(env.roles.investor2);
      assert(kyc1, "investor 1 should be KYC'd");
      assert(acc1, "investor 1 should be accredited");
      assert(!kyc2, "investor 2 should not be KYC'd");
      assert(!acc2, "investor 2 should not be accredited");
      const T = web3.eth.contract(ABI.TokenFront.abi).at(front);
      const bal = T.balanceOf.call(env.roles.investor1);
      assert(bal.equals(security.investors[0].amount), "security amount");
    });
    it("should prevent unverified (KYC) investors from buying", done => {
      // investor2 does not have KYC connfirmation
      const T = web3.eth.contract(ABI.TokenFront.abi).at(front);
      T.transfer(
        env.roles.investor2,
        1e2,
        { from: env.roles.investor1 },
        (err: Error, txHash: string) => {
          assert(err === null, "transfer tx should not revert");
          web3.eth.getTransactionReceipt(txHash, (err: Error, receipt: any) => {
            // FIXME: Make this less ad hoc
            assert(receipt.logs.length === 1, "should generate 1 log message");
            assert(
              receipt.logs[0].topics[0].slice(2) === transferErrorSig,
              "should generate the correct type of log message"
            );
            const errorCode = new BigNumber(
              receipt.logs[0].data.slice(2 + 64),
              16
            );
            assert(
              errorCode.toNumber() === Errors.RegD.BuyerAMLKYC,
              "wrong reason " + errorCode.toString()
            );
            done();
          });
        }
      );
    }).timeout(6000);
    it("should prevent unverified (KYC) investors from selling");
    it("should prevent unaccredited investors from buying");
  });
  describe("limits", () => {
    it("should prevent more than 99 shareholders");
    it("should prevent more than 2000 shareholders");
  });
  describe("vesting period", () => {
    it("should prevent transfer before the vesting period has finished");
  });
});
