// This script will generate some example files for use with the cli

import { BigNumber } from "bignumber.js";
import { writeFileSync } from "fs";
import * as Web3 from "web3";

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

// Bail if there's no node
if (!web3.isConnected()) {
  console.log("Please start ganache on port 8545");
  process.exit(1);
}

// ~~~~~~~~~~~ //
// DEFINITIONS //
// ~~~~~~~~~~~ //

const [controller, admin, investorA, investorB] = web3.eth.accounts;

const config = {
  net: {
    host: "localhost",
    port: 8545
  },
  controller,
  gasReportPath: "examples/gasPrices.json"
};

const spec = {
  capTables: null,
  securityPaths: ["examples/security.1.json"]
};

const security = {
  admin,
  investors: [
    {
      address: investorA,
      amount: new BigNumber(1e6)
    },
    {
      address: investorB,
      amount: new BigNumber(1e5)
    }
  ],
  metadata: {
    name: "Security1"
  }
};

// ~~~~~~~~~~~ //
// WRITE FILES //
// ~~~~~~~~~~~ //

writeFileSync("examples/S3-conf.json", JSON.stringify(config), "utf8");

writeFileSync("examples/S3-spec.json", JSON.stringify(spec), "utf8");

writeFileSync("examples/security.1.json", JSON.stringify(security), "utf8");
