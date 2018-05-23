import { ABI } from "../src/Contracts";
import { Client } from "../src/S3";
import { Security } from "../src/Types";

import * as fixtures from "./fixtures";

import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

const provider = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(provider);
const roles = fixtures.roles(web3);
const controller = roles.controller;

describe("initialize S3", () => {
  it("should set up a new S3 framework", async () => {
    const s3 = new Client(controller, null, provider);
    const contracts = await s3.initS3();
    assert(
      contracts.capTables !== null && web3.isAddress(contracts.capTables),
      "capTables should be a valid address"
    );
    assert(
      contracts.regD !== null && web3.isAddress(contracts.regD),
      "regD should be an address"
    );
    assert(
      contracts.regS !== null && web3.isAddress(contracts.regS),
      "regS should be an address"
    );
  });
  it("should set up a user checker", async () => {
    const s3 = new Client(controller, null, provider);
    await s3.initS3();
    const userChecker = await s3.initUserChecker([]);
    assert(
      web3.isAddress(userChecker),
      "userChecker should be a valid address"
    );
  });
  // Currently the point of this test is to exercise the issuance procedure
  it("should issue a security", async () => {
    const s3 = new Client(controller, null, provider);
    const s3Contracts = await s3.initS3();

    const amlKycAddr = await s3.initUserChecker([roles.checkers.amlKyc]);
    const AK = web3.eth.contract(ABI.SimpleUserChecker.abi).at(amlKycAddr);
    await AK.confirmUser(roles.investor1, 0x1, { from: roles.checkers.amlKyc });
    await AK.confirmUser(roles.investor2, 0x2, { from: roles.checkers.amlKyc });
    await AK.confirmUser(controller, 0x01, { from: roles.checkers.amlKyc });

    const accreditationAddr = await s3.initUserChecker([
      roles.checkers.accreditation
    ]);
    const AC = web3.eth
      .contract(ABI.SimpleUserChecker.abi)
      .at(accreditationAddr);
    await AC.confirmUser(roles.investor1, 0x3, {
      from: roles.checkers.accreditation
    });
    await AC.confirmUser(roles.investor2, 0x4, {
      from: roles.checkers.accreditation
    });
    await AC.confirmUser(controller, 0x02, {
      from: roles.checkers.accreditation
    });

    const security: Security = {
      __type: "RegD",
      checkers: {
        amlKyc: amlKycAddr,
        accreditation: accreditationAddr
      },
      investors: [
        {
          address: roles.investor1,
          amount: new BigNumber("1e5")
        },
        {
          address: roles.investor2,
          amount: new BigNumber("2e4")
        }
      ],
      isFund: false,
      issuer: roles.issuer,
      metadata: { name: "Security1" },
      owner: roles.securityOwner
    };
    const result = await s3.issue(security);
    const T = web3.eth.contract(ABI.TokenFront.abi).at(result.front);
    // Check balances
    const bal1 = T.balanceOf.call(roles.investor1);
    const bal2 = T.balanceOf.call(roles.investor2);
    const supply = T.totalSupply.call();
    assert.equal(bal1.toNumber(), security.investors[0].amount.toNumber());
    assert.equal(bal2.toNumber(), security.investors[1].amount.toNumber());
    assert.equal(
      supply.toNumber(),
      security.investors[0].amount.plus(security.investors[1].amount).toNumber()
    );
    // Check the cap table
    const capTableAddress = s3Contracts.capTables as string;
    const CT = web3.eth.contract(ABI.CapTables.abi).at(capTableAddress);
    const capTableBal1 = CT.balanceOf.call(result.securityId, roles.investor1);
    const capTableBal2 = CT.balanceOf.call(result.securityId, roles.investor2);
    assert.equal(
      capTableBal1.toNumber(),
      security.investors[0].amount.toNumber()
    );
    assert.equal(
      capTableBal2.toNumber(),
      security.investors[1].amount.toNumber()
    );
  }).timeout(15000);
});
