import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import { TransactionReceipt } from "ethereum-types";
import * as Web3 from "web3";

import { RegD } from "../src/Types";

export const environment = (web3: Web3) => {
  if (!web3.isConnected()) {
    console.log("\x1b[33m\x1b[41m%s\x1b[0m", "Node not connected");
    process.exit(1);
  }
  const issuer = web3.eth.accounts[5];
  const securityOwner = web3.eth.accounts[6];
  return {
    roles: {
      controller: web3.eth.accounts[0],
      checkers: {
        amlKyc: web3.eth.accounts[1],
        accreditation: web3.eth.accounts[2]
      },
      investor1: web3.eth.accounts[3],
      investor2: web3.eth.accounts[4],
      investor3: web3.eth.accounts[7],
      issuer,
      securityOwner
    },
    security: (
      amlKycAddr: string,
      accreditationAddr: string,
      investors: { address: string; amount: BigNumber }[]
    ) => {
      const s: RegD = {
        __type: "RegD",
        checkers: {
          amlKyc: amlKycAddr,
          accreditation: accreditationAddr
        },
        investors,
        isFund: false,
        issuer,
        metadata: { name: "Security1" },
        owner: securityOwner
      };
      return s;
    }
  };
};

export const assertSuccess = (receipt: TransactionReceipt) => {
  assert(
    receipt.status === "0x1" || // geth
    receipt.status === 1 || // ganache-cli
      receipt.status === "0x01", // ganache-cli
    "transaction should succeed"
  );
};
