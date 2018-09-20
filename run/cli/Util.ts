import { BigNumber } from "bignumber.js";
import { addHexPrefix } from "ethereumjs-util";

export function gweiToWei(this: void, gwei: number) {
  return addHexPrefix(new BigNumber(gwei).mul(1e9).toString(16));
}
