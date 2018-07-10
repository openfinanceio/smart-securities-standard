import { SimplifiedLogic } from "./Contracts";
import { ABI } from "../Contracts";
import { Address, BaseSecurity, SecurityId } from "../Types";

import { txReceipt } from "@cfxmarkets/web3-utils";
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
  gasPrice: BigNumber, 
  eth: Web3.EthApi
): Promise<{
  securityId: SecurityId;
  middleware: Address;
  front: Address;
}> {
  const securityId = await initCapTable(security, capTables, controller, gasPrice, eth);
  const { front, middleware } = await initToken(
    securityId,
    capTables,
    security.admin,
    controller,
    gasPrice,
    eth
  );
  return {
    front,
    middleware,
    securityId
  };
}

/*  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  */

export async function initCapTable(
  this: void,
  security: BaseSecurity,
  capTables: Address,
  controller: Address,
  gasPrice: BigNumber, 
  eth: Web3.EthApi
): Promise<SecurityId> {
  const CapTables = eth.contract(ABI.CapTables.abi).at(capTables);
  const supply = totalSupply(security);
  logInfo("Deploying the cap table");
  const txInit = CapTables.initialize(supply, controller, {
    from: controller,
    gas: 5e5,
    gasPrice
  });
  const recInit = await txReceipt(eth, txInit);
  const index = new BigNumber(recInit.logs[0].data.slice(2), 16);
  logInfo("Initial distribution");
  await Promise.all(
    security.investors.map(
      async (investor: { address: Address; amount: BigNumber }) => {
        logInfo(
          `Distributing ${investor.amount.toString()} to ${investor.address}`
        );
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
        await txReceipt(eth, tx);
      }
    )
  );
  return index;
}

/*  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  */

export async function initToken(
  this: void,
  securityId: SecurityId,
  capTables: Address,
  admin: Address,
  controller: Address,
  gasPrice: BigNumber,
  eth: Web3.EthApi
): Promise<{
  middleware: Address;
  front: Address;
}> {
  logInfo("Deploying SimplifiedLogic");
  const txSimplifiedLogic = eth
    .contract(SimplifiedLogic.abi)
    .new(
      securityId,
      capTables, 
      admin,
      controller,
      {
        data: SimplifiedLogic.bytecode,
        from: controller,
        gas: 1.5e6,
        gasPrice
      }
    );
  const recSimplifiedLogic = await txReceipt(
    eth,
    txSimplifiedLogic.transactionHash
  );
  const simplifiedLogicAddress = recSimplifiedLogic.contractAddress as string;
  logDebug(`SimplifiedLogic address: ${simplifiedLogicAddress}`);
  const CapTables = eth.contract(ABI.CapTables.abi).at(capTables);
  logInfo("Migrating the cap table to SimplifiedLogic");
  const txMigrate = CapTables.migrate(securityId, simplifiedLogicAddress, {
    from: controller,
    gas: 5e5,
    gasPrice
  });
  await txReceipt(eth, txMigrate);
  logInfo("Deploying the token front");
  const txFront = eth
    .contract(ABI.TokenFront.abi)
    .new(
      recSimplifiedLogic.contractAddress, 
      admin,
      {
        data: ABI.TokenFront.bytecode,
        from: controller,
        gas: 1e6,
        gasPrice
      }
    );
  const recTokenFront = await txReceipt(eth, txFront.transactionHash);
  const front = recTokenFront.contractAddress as string;
  const simplifiedLogic = eth
    .contract(SimplifiedLogic.abi)
    .at(simplifiedLogicAddress);
  logInfo("Setting the front");
  const txSetFront = simplifiedLogic.setFront(recTokenFront.contractAddress, {
    from: admin,
    gas: 5e5,
    gasPrice
  });
  await txReceipt(eth, txSetFront);
  return {
    front,
    middleware: simplifiedLogicAddress
  };
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
