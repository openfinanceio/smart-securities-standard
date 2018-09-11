import { BigNumber } from "bignumber.js";

/** 20 byte hex-encoded key hash prefixed with "0x" */
export type Address = string;

/** Securities in S3 are defined by an integer key */
export type SecurityId = BigNumber;

export interface BaseSecurity {
  admin: Address;
  investors: { address: Address; amount: BigNumber }[];
  metadata: {
    name: string;
    [prop: string]: any;
  };
}

/** A selection of transfer errors */
export namespace Errors {
  export enum RegD {
    Ok = 0,
    HoldingPeriod,
    ShareholderMaximum,
    BuyerAMLKYC,
    SellerAMLKYC,
    Accreditation
  }
}
