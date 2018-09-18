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
    [prop: string]: unknown;
  };
}

export interface IndexedSecurity extends BaseSecurity {
  securityId: number;
}

// A log entry for something that we just did
export type TranscriptEntry /* call */ =
  | {
      type: "call";
      description: string;
      observation: { [key: string]: unknown };
    }
  | /* send */ {
      type: "send";
      description: string;
      hash: string;
      gasUsed: number;
      data: { [key: string]: unknown };
    };

export interface OfflineTranscriptEntry {
  description: string;
  params: { [key: string]: unknown };
  // There will be signed transactions for many gas price levels
  signedTxes: Array<[string, string]>;
}

export type Transcript = Array<TranscriptEntry>;
export type OfflineTranscript = Array<OfflineTranscriptEntry>;

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
