import { BigNumber } from "bignumber.js";
import {
  addHexPrefix,
  generateAddress,
  privateToAddress
} from "ethereumjs-util";

import { BaseSecurity } from "./Types";

export function totalSupply(security: BaseSecurity) {
  const step = (supply: BigNumber, shares: { amount: string }) =>
    supply.plus(shares.amount);
  return security.investors.reduce(step, new BigNumber(0));
}

export const toZeroXHex = (buf: Buffer) => addHexPrefix(buf.toString("hex"));

export const toUInt256 = (n: BigNumber | string | number) =>
  padTo32(new BigNumber(n).toString(16));

export const genAddress = (addr: string, n: number) => {
  const addrBuffer = Buffer.from(noHexPrefix(addr), "hex");
  return addHexPrefix(
    (generateAddress(addrBuffer, n as any) as Buffer).toString("hex")
  );
};

export const privToAddress = (buf: Buffer) =>
  addHexPrefix((privateToAddress(buf) as Buffer).toString("hex"));

export const hexSmash = (hexes: Array<string>) =>
  addHexPrefix(hexes.map(noHexPrefix).join(""));

export const noHexPrefix = (hex: string) =>
  hex.startsWith("0x") ? hex.slice(2) : hex;

export const padTo32 = (hex: string) => noHexPrefix(hex).padStart(64, "0");
