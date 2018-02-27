import BigNumber from "bignumber.js";
import * as Web3 from "web3";

describe("SimpleUserChecker", function() {
  it("should create the contract");
  it("should add a checker");
  it("should fail to add a checker (non owner)");
  it("should remove a checker");
  it("should fail to remove a checker (non owner)");
  it("should add a confirmation to a user");
  it("should fail to add a confirmation to a user (non confirmer)");
  it("should confirm a confirmed user");
  it("should not confirm an unconfirmed user");
});
