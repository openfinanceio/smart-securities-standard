export { SimplifiedLogic } from "./Simplified/Contracts";
export { init } from "./Simplified/Init";
export { issue } from "./Simplified/Issue";
export {
  Transfer,
  TransferRequest,
  handleTransfers
} from "./Simplified/Monitor";
export { BigNumber } from "bignumber.js";

import { ABI, Artifact } from "./Contracts";
export { BaseSecurity } from "./Types";

export const TokenFront: Artifact = ABI.TokenFront;
