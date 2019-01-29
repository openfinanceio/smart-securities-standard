import * as assert from "assert";
import { randomBytes } from "crypto";
import * as Web3 from "web3";

import {
  Administration,
  Data,
  SimplifiedTokenLogic,
  TokenFront,
  init,
  issue,
  newResolver
} from "../src";
import { getSecurity, getRoles, log } from "./Support";
import * as U from "../src/Util";
import { txReceipt } from "../src/Web3";

const web3ConnString = "http://localhost:8545";
const web3 = new Web3(new Web3.providers.HttpProvider(web3ConnString));
const chainId = parseInt(web3.version.network);
const roles = getRoles(web3);

describe("maintenance", () => {
  describe("resolver", () => {
    it("should change the resolver", async () => {
      const [capTables] = await init(roles.controller, "0", web3.eth);

      const admin = randomBytes(32);
      const adminAddress = U.privToAddress(admin);

      const security = getSecurity(roles);

      const [{ middleware }] = await issue(
        security,
        capTables,
        roles.controller,
        "0",
        {
          eth: web3.eth,
          log
        }
      );

      // We have to change the admin to an address where we have the private
      // key
      const simplifiedTokenLogic = web3.eth
        .contract(SimplifiedTokenLogic.abi)
        .at(middleware);

      {
        const hash = simplifiedTokenLogic.transferOwnership(adminAddress, {
          from: security.admin
        });
        await txReceipt(web3.eth, hash);
      }

      {
        const hash = web3.eth.sendTransaction({
          from: roles.controller,
          to: adminAddress,
          value: 1e10
        });
        await txReceipt(web3.eth, hash);
      }

      const {
        resolverAddress,
        transcript: { signedTxes }
      } = newResolver(middleware, admin, {
        gasPrices: ["0"],
        nonce: 0,
        chainId
      });

      {
        const hash = web3.eth.sendRawTransaction(signedTxes[0][1]);
        await txReceipt(web3.eth, hash);
      }

      const observed = simplifiedTokenLogic.resolver.call();
      assert.equal(observed, resolverAddress, "resolver should update");
    });
  });
  describe("administration", () => {
    const deployerAddr = web3.eth.accounts[10];

    const adminAddress = U.genAddress(
      deployerAddr,
      web3.eth.getTransactionCount(deployerAddr)
    );

    const roles = {
      controller: web3.eth.accounts[0],
      investor1: web3.eth.accounts[1],
      investor2: web3.eth.accounts[2],
      issuer: web3.eth.accounts[3],
      securityOwner: adminAddress,
      resolver: web3.eth.accounts[4]
    };

    const addressA = web3.eth.accounts[11];
    const addressB = web3.eth.accounts[12];
    const addressC = web3.eth.accounts[13];

    const security = getSecurity(roles);

    let front: string;
    let logic: string;

    before(async () => {
      const [capTables] = await init(roles.controller, "0", web3.eth);

      const [deployed] = await issue(
        security,
        capTables,
        roles.controller,
        "0",
        {
          eth: web3.eth,
          log
        }
      );

      front = deployed.front;
      logic = deployed.middleware;

      const depObj = web3.eth
        .contract(Administration.abi)
        .new(addressA, addressB, addressC, {
          data: Administration.bytecode,
          gas: 1.5e6,
          from: deployerAddr
        });

      const adminReceipt = await txReceipt(web3.eth, depObj.transactionHash);
      assert.equal(
        adminReceipt.contractAddress,
        adminAddress,
        "addresses should match"
      );
    });

    it("should bind the front and logic", async () => {
      const admin = web3.eth.contract(Administration.abi).at(adminAddress);
      const callNumber = 0;

      {
        const hash = admin.bind(callNumber, logic, front, {
          from: addressA,
          gas: 3e5
        });
        assert.equal(
          (await txReceipt(web3.eth, hash)).status,
          "0x1",
          "should succeed"
        );
      }

      {
        const hash = admin.bind(callNumber, logic, front, {
          from: addressC,
          gas: 3e5
        });
        assert.equal(
          (await txReceipt(web3.eth, hash)).status,
          "0x1",
          "should succeed"
        );
      }

      assert.equal(admin.targetFront.call(), front, "should bind front");

      assert.equal(admin.targetLogic.call(), logic, "should bind logic");
    });

    it("should require 2 signatures to perform a clawback", async () => {
      const admin = web3.eth.contract(Administration.abi).at(adminAddress);
      const frontInstance = web3.eth.contract(TokenFront.abi).at(front);

      const callNumber = admin.maximumClaimedCallNumber.call().toNumber() + 1;

      const hashA = admin.clawback(
        callNumber,
        roles.investor2,
        roles.investor1,
        1e2,
        {
          from: addressA,
          gas: 3e5
        }
      );

      {
        const receipt = await txReceipt(web3.eth, hashA);
        assert.equal(receipt.status, "0x1", "tx should not revert");
      }

      assert.equal(
        frontInstance.balanceOf(roles.investor1).toNumber(),
        1e5,
        "investor 1 balance after first sig"
      );

      assert.equal(
        frontInstance.balanceOf(roles.investor2).toNumber(),
        1e7,
        "investor 2 balance after first sig"
      );

      const hashB = admin.clawback(
        callNumber,
        roles.investor2,
        roles.investor1,
        1e2,
        {
          from: addressB,
          gas: 3e5
        }
      );

      {
        const receipt = await txReceipt(web3.eth, hashB);
        assert.equal(receipt.status, "0x1", "tx should not revert");
      }

      assert.equal(
        frontInstance.balanceOf(roles.investor1).toNumber(),
        1e5 + 1e2,
        "investor 1 balance after second sig"
      );

      assert.equal(
        frontInstance.balanceOf(roles.investor2).toNumber(),
        1e7 - 1e2,
        "investor 2 balance after second sig"
      );

      const [status, op, sigA, sigB, sigC] = admin.methodCalls.call(callNumber);

      assert.equal(status.toNumber(), 2, "method call status");
      assert.equal(op.toNumber(), 2, "operation");
      assert(sigA, "signature A");
      assert(sigB, "signature B");
      assert(!sigC, "signature C");
    });

    it("should force all calls to use the same arguments", async () => {
      const admin = web3.eth.contract(Administration.abi).at(adminAddress);
      const callNumber = admin.maximumClaimedCallNumber.call().toNumber() + 1;

      const newResolver0 = web3.eth.accounts[6];
      const newResolver1 = web3.eth.accounts[7];

      admin.setResolver(callNumber, newResolver0, { from: addressB });
      const hash = admin.setResolver(callNumber, newResolver1, {
        from: addressC,
        gas: 3e5
      });

      assert.equal(
        (await txReceipt(web3.eth, hash)).status,
        "0x0",
        "tx should fail"
      );
    });

    it("should revert if a non-signer sends a method call", async () => {
      const admin = web3.eth.contract(Administration.abi).at(adminAddress);
      const callNumber = admin.maximumClaimedCallNumber.call().toNumber() + 1;

      const rando = web3.eth.accounts[9];

      const hash = admin.rotate(callNumber, addressA, rando, {
        from: rando,
        gas: 3e5
      });
      assert.equal(
        (await txReceipt(web3.eth, hash)).status,
        "0x0",
        "tx should fail"
      );
    });
  });
});
