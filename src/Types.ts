import { BigNumber } from "bignumber.js";

/** 20 byte hex-encoded key hash prefixed with "0x" */
export type Address = string;

/** Securities in S3 are defined by an integer key */
export type SecurityId = BigNumber;

/** S3 supports two kinds of security: regulation D & S */
export type Security = RegD | RegS;

export interface RegD extends BaseSecurity {
  __type: "RegD";
  isFund: boolean;
  checkers: {
    amlKyc: Address;
    accreditation: Address;
  };
}

export interface RegS extends BaseSecurity {
  __type: "RegS";
  checkers: {
    amlKyc: Address;
    residency: Address;
  };
}

export interface BaseSecurity {
  investors: { address: Address; amount: BigNumber }[];
  issuer: Address;
  metadata: {
    name: string;
    [prop: string]: any;
  };
  owner: Address;
}

export interface S3Contracts {
  capTables: Address;
  regD: Address;
  regS: Address;
  kyc: Address;
  accreditation: Address;
  residency: Address;
}

export interface S3Metadata {
  front: Address;
  currentLogic: Address;
  id: SecurityId;
  name: string;
}
