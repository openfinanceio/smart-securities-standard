import {
  CapTables as CapTablesArtifact,
  SimplifiedLogic,
  TokenFront
} from "./Contracts";
import { Address, BaseSecurity, SecurityId, Transcript } from "./Types";
import { txReceipt } from "./Web3";

import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";

/**
 * Issue a security on S3
 * @param controller the address to use to deploy the contracts.  Note that
 *                   this address will wind up as the resolver as well.
 * @param gasPrice in Wei
 */
export async function issue(
  this: void,
  security: BaseSecurity,
  capTables: Address,
  controller: Address,
  gasPrice: string,
  eth: Web3.EthApi
): Promise<
  [
    {
      securityId: SecurityId;
      middleware: Address;
      front: Address;
    },
    Transcript
  ]
> {
  const [securityId, transcript0] = await initCapTable(
    security,
    capTables,
    controller,
    gasPrice,
    eth
  );
  const [{ front, middleware }, transcript1] = await initToken(
    securityId,
    capTables,
    security.admin,
    controller,
    gasPrice,
    eth
  );
  return [
    {
      front,
      middleware,
      securityId
    },
    transcript0.concat(transcript1)
  ];
}

/*  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  */

export async function initCapTable(
  this: void,
  security: BaseSecurity,
  capTables: Address,
  controller: Address,
  gasPrice: string,
  eth: Web3.EthApi
): Promise<[SecurityId, Transcript]> {
  const transcript: Transcript = [];
  const CapTables = eth.contract(CapTablesArtifact.abi).at(capTables);
  const supply = totalSupply(security);
  logInfo("Deploying the cap table");
  const txInit = CapTables.initialize(supply, controller, {
    from: controller,
    gas: 5e5,
    gasPrice
  });
  const recInit = await txReceipt(eth, txInit);
  const index = new BigNumber(recInit.logs[0].data.slice(2), 16);
  transcript.push({
    type: "send",
    description: `initialize a new security in ${capTables}`,
    hash: txInit,
    gasUsed: recInit.gasUsed,
    data: {
      supply,
      controller,
      index
    }
  });
  logInfo("Initial distribution");
  await Promise.all(
    security.investors.map(
      async (investor: { address: Address; amount: BigNumber }) => {
        const description = `Distributing ${investor.amount.toString()} to ${
          investor.address
        }`;
        logInfo(description);
        const tx = CapTables.transfer(
          index,
          controller,
          investor.address,
          investor.amount,
          {
            from: controller,
            gas: 5e5,
            gasPrice
          }
        );
        const rec = await txReceipt(eth, tx);
        transcript.push({
          type: "send",
          description,
          hash: tx,
          gasUsed: rec.gasUsed,
          data: {
            index,
            src: controller,
            dest: investor.address,
            amount: investor.amount
          }
        });
      }
    )
  );
  return [index, transcript];
}

/*  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  */

export async function initToken(
  this: void,
  securityId: SecurityId,
  capTables: Address,
  admin: Address,
  controller: Address,
  gasPrice: string,
  eth: Web3.EthApi
): Promise<
  [
    {
      middleware: Address;
      front: Address;
    },
    Transcript
  ]
> {
  logInfo("Deploying SimplifiedLogic");
  const transcript: Transcript = [];
  const txSimplifiedLogic = eth
    .contract(SimplifiedLogic.abi)
    .new(securityId, capTables, admin, controller, {
      data: SimplifiedLogic.bytecode,
      from: controller,
      gas: 1.5e6,
      gasPrice
    });
  const recSimplifiedLogic = await txReceipt(
    eth,
    txSimplifiedLogic.transactionHash
  );
  const simplifiedLogicAddress = recSimplifiedLogic.contractAddress as string;
  transcript.push({
    type: "send",
    description: "deployed SimplifiedLogic",
    hash: txSimplifiedLogic.transactionHash,
    gasUsed: recSimplifiedLogic.gasUsed,
    data: {
      securityId,
      capTables,
      admin,
      controller,
      simplifiedLogicAddress
    }
  });
  logDebug(`SimplifiedLogic address: ${simplifiedLogicAddress}`);
  const CapTables = eth.contract(CapTablesArtifact.abi).at(capTables);
  const migrationDescription = "Migrating the cap table to SimplifiedLogic";
  logInfo(migrationDescription);
  const txMigrate = CapTables.migrate(securityId, simplifiedLogicAddress, {
    from: controller,
    gas: 5e5,
    gasPrice
  });
  const migrationReceipt = await txReceipt(eth, txMigrate);
  transcript.push({
    type: "send",
    description: migrationDescription,
    hash: txMigrate,
    gasUsed: migrationReceipt.gasUsed,
    data: {
      securityId,
      simplifiedLogicAddress
    }
  });
  const tokenFrontDescription = "Deploying the token front";
  logInfo(tokenFrontDescription);
  const txFront = eth
    .contract(TokenFront.abi)
    .new(simplifiedLogicAddress, admin, {
      data: TokenFront.bytecode,
      from: controller,
      gas: 1e6,
      gasPrice
    });
  const recTokenFront = await txReceipt(eth, txFront.transactionHash);
  const front = recTokenFront.contractAddress as string;
  transcript.push({
    type: "send",
    description: tokenFrontDescription,
    hash: txFront.transactionHash,
    gasUsed: recTokenFront.gasUsed,
    data: {
      front,
      simplifiedLogicAddress,
      admin
    }
  });
  const simplifiedLogic = eth
    .contract(SimplifiedLogic.abi)
    .at(simplifiedLogicAddress);
  const setFrontDescription = "Setting the front";
  logInfo(setFrontDescription);
  const txSetFront = simplifiedLogic.setFront(front, {
    from: admin,
    gas: 5e5,
    gasPrice
  });
  const setFrontReceipt = await txReceipt(eth, txSetFront);
  transcript.push({
    type: "send",
    description: setFrontDescription,
    hash: txSetFront,
    gasUsed: setFrontReceipt.gasUsed,
    data: {
      front
    }
  });
  return [
    {
      front,
      middleware: simplifiedLogicAddress
    },
    transcript
  ];
}

/*  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  */

function totalSupply(security: BaseSecurity) {
  const step = (supply: BigNumber, shares: { amount: BigNumber }) =>
    supply.plus(shares.amount);
  return security.investors.reduce(step, new BigNumber(0));
}

function logDebug(msg: string) {
  console.log(msg);
}

function logInfo(msg: string) {
  console.log(msg);
}
