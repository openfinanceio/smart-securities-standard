import * as assert from "assert";
import { BigNumber } from "bignumber.js";
import { TransactionReceipt } from "ethereum-types";
import * as Web3 from "web3";
import * as winston from "winston";

export const getRoles = (web3: Web3) => {
  if (!web3.isConnected()) {
    console.log("\x1b[33m\x1b[41m%s\x1b[0m", "Node not connected");
    process.exit(1);
  }
  return {
    controller: web3.eth.accounts[0],
    investor1: web3.eth.accounts[3],
    investor2: web3.eth.accounts[4],
    investor3: web3.eth.accounts[7],
    issuer: web3.eth.accounts[5],
    securityOwner: web3.eth.accounts[6],
    resolver: web3.eth.accounts[8]
  };
};

export const getSecurity = (roles: { [key: string]: string }) => ({
  metadata: { name: "TestSecurity" },
  investors: [
    {
      address: roles.investor1,
      amount: new BigNumber(1e5)
    },
    {
      address: roles.investor2,
      amount: new BigNumber(1e7)
    }
  ],
  admin: roles.securityOwner
});

export const assertSuccess = (receipt: TransactionReceipt) => {
  assert(
    receipt.status === "0x1" || // geth
    receipt.status === 1 || // ganache-cli
      receipt.status === "0x01", // ganache-cli
    "transaction should succeed"
  );
};

export const log = winston.createLogger({
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});
