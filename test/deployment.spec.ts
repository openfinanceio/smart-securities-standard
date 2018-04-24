import { Security, Client } from "../src/S3";

import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

describe("initialize S3", () => {
  const provider = new Web3.providers.HttpProvider("http://localhost:8545");
  const web3 = new Web3(provider);
  const controller = web3.eth.accounts[0];
  const checkers = {
    amlKyc: web3.eth.accounts[1],
    accreditation: web3.eth.accounts[2]
  };
  const investor1 = web3.eth.accounts[3];
  const investor2 = web3.eth.accounts[4];
  const issuer = web3.eth.accounts[5];
  const securityOwner = web3.eth.accounts[6];
  it("should set up a new S3 framework", async () => {
    const s3 = new Client(controller, null, provider);
    await s3.initS3();
  });
  it("should issue a security", async () => {
    const s3 = new Client(controller, null, provider);
    await s3.initS3();
    const security: Security = {
      __type: "RegD",
      checkers,
      investors: [
        {
          address: investor1,
          amount: new BigNumber("1e5")
        },
        {
          address: investor2,
          amount: new BigNumber("2e4")
        }
      ],
      isFund: false,
      issuer,
      metadata: { name: "Security1" },
      owner: securityOwner
    };
    const result = await s3.issue(security);
    console.log(result);
  });
});
