import {
  CapTables as CapTablesArtifact,
  SimplifiedTokenLogic,
  TokenFront
} from "../Contracts";
import {
  Address,
  BaseSecurity,
  IndexedSecurity,
  SecurityId,
  Transcript
} from "../Types";
import { success, txReceipt } from "../Web3";
import { totalSupply } from "../Util";

import * as assert from "assert";
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
    { securityId: securityId.toNumber(), ...security },
    capTables,
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

  kit.log.debug(`Parameters: capTables = ${capTables}`);

  const CapTables = kit.eth.contract(CapTablesArtifact.abi).at(capTables);

  const supply = totalSupply(security);

  kit.log.debug("Deploying the cap table");
  kit.log.debug(`Parameters: supply = ${supply}; controller = ${controller}`);

  const txInit = CapTables.initialize(supply.toString(), controller, {
    from: controller,
    gas: 5e5,
    gasPrice
  });

  const recInit = await txReceipt(kit.eth, txInit);
  assert(success(recInit), "initialize");

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
          index.toString(),
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
        assert(success(rec), "transfer");

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
  security: IndexedSecurity,
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
      middleware: Address;
      front: Address;
    },
    Transcript
  ]
> {
  kit.log.debug("Deploying SimplifiedLogic");

  const metadata = security.metadata;
  const transcript: Transcript = [];

  const txSimplifiedLogic = kit.eth
    .contract(SimplifiedTokenLogic.abi)
    .new(
      security.securityId.toString(),
      capTables,
      controller,
      security.resolver,
      {
        data: SimplifiedTokenLogic.bytecode,
        from: controller,
        gas: 1.5e6,
        gasPrice
      }
    );

  const recSimplifiedLogic = await txReceipt(
    kit.eth,
    txSimplifiedLogic.transactionHash
  );

  assert(success(recSimplifiedLogic), "new SimplifiedLogic");

  const simplifiedLogicAddress = recSimplifiedLogic.contractAddress as string;

  transcript.push({
    type: "send",
    description: "deployed SimplifiedLogic",
    hash: txSimplifiedLogic.transactionHash,
    gasUsed: recSimplifiedLogic.gasUsed,
    data: {
      securityId: security.securityId,
      capTables,
      admin: security.admin,
      resolver: security.resolver,
      controller,
      simplifiedLogicAddress
    }
  });

  kit.log.debug(`SimplifiedLogic address: ${simplifiedLogicAddress}`);

  {
    const CapTables = kit.eth.contract(CapTablesArtifact.abi).at(capTables);
    const description = "Migrating the cap table to SimplifiedLogic";

    kit.log.debug(description);

    const hash = CapTables.migrate(
      security.securityId,
      simplifiedLogicAddress,
      {
        from: controller,
        gas: 5e5,
        gasPrice
      }
    );

    const receipt = await txReceipt(kit.eth, hash);
    assert(success(receipt), "migration");

    transcript.push({
      type: "send",
      description,
      hash,
      gasUsed: receipt.gasUsed,
      data: {
        securityId: security.securityId,
        simplifiedLogicAddress
      }
    });
  }

  const tokenFrontDescription = "Deploying the token front";

  kit.log.debug(tokenFrontDescription);

  const txFront = kit.eth
    .contract(TokenFront.abi)
    .new(
      simplifiedLogicAddress,
      security.admin,
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
  assert(success(recTokenFront), "new TokenFront");

  const front = recTokenFront.contractAddress as string;

  transcript.push({
    type: "send",
    description: tokenFrontDescription,
    hash: txFront.transactionHash,
    gasUsed: recTokenFront.gasUsed,
    data: {
      front,
      simplifiedLogicAddress,
      admin: security.admin
    }
  });

  const simplifiedLogic = kit.eth
    .contract(SimplifiedTokenLogic.abi)
    .at(simplifiedLogicAddress);

  {
    const description = "Setting the front";

    kit.log.debug(description);

    const hash = simplifiedLogic.setFront(front, {
      from: controller,
      gas: 5e5,
      gasPrice
    });

    const receipt = await txReceipt(kit.eth, hash);

    transcript.push({
      type: "send",
      description,
      hash,
      gasUsed: receipt.gasUsed,
      data: {
        front
      }
    });
  }

  {
    const description = "Setting the admin";

    kit.log.debug(description);

    const hash = simplifiedLogic.transferOwnership(security.admin, {
      from: controller,
      gas: 5e5,
      gasPrice
    });

    const receipt = await txReceipt(kit.eth, hash);

    transcript.push({
      type: "send",
      description,
      hash,
      gasUsed: receipt.gasUsed,
      data: {
        simplifiedLogicAddress,
        adminAddress: security.admin
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
