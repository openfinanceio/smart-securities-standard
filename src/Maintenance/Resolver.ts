// Resolver
// ==
//
// The resolver is going to be in a hot wallet, which means that we need to be
// able to change it easily and securely.

import { randomBytes } from "crypto";
import EthereumTx = require("ethereumjs-tx");

import { OfflineTranscriptEntry } from "../Types";
import * as U from "../Util";
import { sigHashes } from "../Contracts";

export function newResolver(
  this: void,
  simplifiedTokenLogicAddress: string,
  owner: Buffer,
  ethParams: {
    gasPrices: string[];
    nonce: number;
    chainId: number;
  }
): {
  resolverKey: Buffer;
  resolverAddress: string;
  nonce: number;
  transcript: OfflineTranscriptEntry;
} {
  const newResolver = randomBytes(32);
  const newResolverAddress = U.privToAddress(newResolver);
  const ownerAddress = U.privToAddress(owner);
  const nonce = ethParams.nonce;
  const data = U.hexSmash([
    sigHashes.SimplifiedTokenLogic.setResolver,
    U.padTo32(newResolverAddress)
  ]);
  const signedTxes = ethParams.gasPrices.map(gasPrice => {
    const tx = new EthereumTx({
      data,
      from: ownerAddress,
      to: simplifiedTokenLogicAddress,
      gasPrice,
      gas: 1e5,
      nonce,
      chainId: ethParams.chainId
    });
    tx.sign(owner);
    const result: [string, string] = [gasPrice, U.toZeroXHex(tx.serialize())];
    return result;
  });
  return {
    resolverKey: newResolver,
    resolverAddress: newResolverAddress,
    nonce: nonce + 1,
    transcript: {
      description: `Sets SimplifiedTokenLogic.resolver to ${newResolverAddress}`,
      params: {
        ownerAddress,
        newResolverAddress,
        simplifiedTokenLogicAddress
      },
      signedTxes
    }
  };
}
