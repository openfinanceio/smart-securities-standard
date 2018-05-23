import * as Web3 from "web3";

export const roles = (web3: Web3) => ({
  controller: web3.eth.accounts[0],
  checkers: {
    amlKyc: web3.eth.accounts[1],
    accreditation: web3.eth.accounts[2]
  },
  investor1: web3.eth.accounts[3],
  investor2: web3.eth.accounts[4],
  issuer: web3.eth.accounts[5],
  securityOwner: web3.eth.accounts[6]
});
