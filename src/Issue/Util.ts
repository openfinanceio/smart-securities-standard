import { BigNumber } from "bignumber.js";
import { BaseSecurity } from "../Types";

export function totalSupply(security: BaseSecurity) {
  const step = (supply: BigNumber, shares: { amount: BigNumber }) =>
    supply.plus(shares.amount);
  return security.investors.reduce(step, new BigNumber(0));
}
