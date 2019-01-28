import {
  CapTables as CapTablesArtifact,
  SimplifiedTokenLogic,
  TokenFront
} from "../Contracts";
import { Address, BaseSecurity, SecurityId, Transcript } from "../Types";
import { txReceipt } from "../Web3";
import { totalSupply } from "../Util";

import { BigNumber } from "bignumber.js";
import * as Web3 from "web3";
import { Logger } from "winston";

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
  kit: {
    eth: Web3.EthApi;
    log: Logger;
  }
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
    kit
  );
  const [{ front, middleware }, transcript1] = await initToken(
    {
      securityId,
      name: security.metadata.name,
      symbol: security.metadata.symbol,
      decimals: security.metadata.decimals
    },
    capTables,
    security.admin,
    controller,
    gasPrice,
    kit
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
  kit: {
    eth: Web3.EthApi;
    log: Logger;
  }
): Promise<[SecurityId, Transcript]> {
  const transcript: Transcript = [];
  const CapTables = kit.eth.contract(CapTablesArtifact.abi).at(capTables);
  const supply = totalSupply(security);
  kit.log.debug("Deploying the cap table");
  const txInit = CapTables.initialize(supply, controller, {
    from: controller,
    gas: 5e5,
    gasPrice
  });
  const recInit = await txReceipt(kit.eth, txInit);
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
  kit.log.debug("Initial distribution");
  await Promise.all(
    security.investors.map(
      async (investor: { address: Address; amount: string }) => {
        const description = `Distributing ${investor.amount.toString()} to ${
          investor.address
        }`;
        kit.log.info(description);
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
        const rec = await txReceipt(kit.eth, tx);
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
  metadata: {
    securityId: SecurityId;
    name: string;
    symbol: string;
    decimals: number;
  },
  capTables: Address,
  admin: Address,
  controller: Address,
  gasPrice: string,
  kit: {
    eth: Web3.EthApi;
    log: Logger;
  }
): Promise<
  [
    {
      middleware: Address;
      front: Address;
    },
    Transcript
  ]
> {
  kit.log.debug("Deploying SimplifiedLogic");
  const transcript: Transcript = [];
  const txSimplifiedLogic = kit.eth
    .contract(SimplifiedTokenLogic.abi)
    .new(metadata.securityId, capTables, controller, controller, {
      data: SimplifiedTokenLogic.bytecode,
      from: controller,
      gas: 1.5e6,
      gasPrice
    });
  const recSimplifiedLogic = await txReceipt(
    kit.eth,
    txSimplifiedLogic.transactionHash
  );
  const simplifiedLogicAddress = recSimplifiedLogic.contractAddress as string;
  transcript.push({
    type: "send",
    description: "deployed SimplifiedLogic",
    hash: txSimplifiedLogic.transactionHash,
    gasUsed: recSimplifiedLogic.gasUsed,
    data: {
      securityId: metadata.securityId,
      capTables,
      admin,
      controller,
      simplifiedLogicAddress
    }
  });
  kit.log.debug(`SimplifiedLogic address: ${simplifiedLogicAddress}`);
  const CapTables = kit.eth.contract(CapTablesArtifact.abi).at(capTables);
  const migrationDescription = "Migrating the cap table to SimplifiedLogic";
  kit.log.debug(migrationDescription);
  const txMigrate = CapTables.migrate(
    metadata.securityId,
    simplifiedLogicAddress,
    {
      from: controller,
      gas: 5e5,
      gasPrice
    }
  );
  const migrationReceipt = await txReceipt(kit.eth, txMigrate);
  transcript.push({
    type: "send",
    description: migrationDescription,
    hash: txMigrate,
    gasUsed: migrationReceipt.gasUsed,
    data: {
      securityId: metadata.securityId,
      simplifiedLogicAddress
    }
  });
  const tokenFrontDescription = "Deploying the token front";
  kit.log.debug(tokenFrontDescription);
  const txFront = kit.eth
    .contract(TokenFront.abi)
    .new(
      simplifiedLogicAddress,
      admin,
      metadata.name,
      metadata.symbol,
      metadata.decimals,
      {
        data: TokenFront.bytecode,
        from: controller,
        gas: 1e6,
        gasPrice
      }
    );
  const recTokenFront = await txReceipt(kit.eth, txFront.transactionHash);
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
  const simplifiedLogic = kit.eth
    .contract(SimplifiedTokenLogic.abi)
    .at(simplifiedLogicAddress);
  const setFrontDescription = "Setting the front";
  kit.log.debug(setFrontDescription);
  const txSetFront = simplifiedLogic.setFront(front, {
    from: controller,
    gas: 5e5,
    gasPrice
  });
  const setFrontReceipt = await txReceipt(kit.eth, txSetFront);
  transcript.push({
    type: "send",
    description: setFrontDescription,
    hash: txSetFront,
    gasUsed: setFrontReceipt.gasUsed,
    data: {
      front
    }
  });

  {
    // Set the admin on SimplifiedLogic

    const txHash = simplifiedLogic.transferOwnership(admin, {
      from: controller,
      gas: 5e5,
      gasPrice
    });

    const receipt = await txReceipt(kit.eth, txHash);

    transcript.push({
      type: "send",
      description: "sets the admin on SimplifiedTokenLogic",
      hash: txHash,
      gasUsed: receipt.gasUsed,
      data: {
        front,
        admin
      }
    });
  }

  return [
    {
      front,
      middleware: simplifiedLogicAddress
    },
    transcript
  ];
}

/*  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  */
