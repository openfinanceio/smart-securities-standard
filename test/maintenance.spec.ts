import * as assert from "assert";
import { randomBytes } from "crypto";
import * as Web3 from "web3";

import { SimplifiedTokenLogic, init, issue, newResolver } from "../src";
import { getSecurity, getRoles, log } from "./Support";
import { privToAddress } from "../src/Util";
import { txReceipt } from "../src/Web3";

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const roles = getRoles(web3);
const security = getSecurity(roles);
const chainId = parseInt(web3.version.network);

describe("maintenance", () => {
  describe("resolver", () => {
    it("should change the resolver", async () => {
      const [capTables] = await init(roles.controller, "0", web3.eth);
      const admin = randomBytes(32);
      const adminAddress = privToAddress(admin);
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
});
