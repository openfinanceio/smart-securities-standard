import * as iots from "io-ts";

import {
  Transcript,
  OfflineTranscript,
  OfflineTranscriptEntry
} from "../../src/Types";

export interface GasReport {
  safeLow: number;
}

export interface Config {
  /** This is what we use to connect to web3 */
  net: {
    host: string;
    port: number;
  };
  /** A general purpose controller address */
  controller: string;
  /** Path to the gas report, which can be kept current by some other process. */
  gasReportPath: string;
}

export const configRT: iots.Type<Config> = iots.type({
  net: iots.type({
    host: iots.string,
    port: iots.number
  }),
  controller: iots.string,
  gasReportPath: iots.string
});

// ~~~~~~~~~~~~~~~~~~~~~~~~ //
// Different specifications //
// ~~~~~~~~~~~~~~~~~~~~~~~~ //

export interface Spec {
  /**
   * When null, deploy a new captables; otherwise this is the address of the
   * capTables contract to use.
   */
  capTables: string;
  /**
   * A designated address to resolve transfers
   */
  resolver: string;
  securityPaths: string[];
}

export const specRT: iots.Type<Spec> = iots.type({
  capTables: iots.string,
  resolver: iots.string,
  securityPaths: iots.array(iots.string)
});

export const adminSpecRT = iots.type({
  tokenLogic: iots.string,
  tokenFront: iots.string,
  cosignerA: iots.string,
  cosignerB: iots.string,
  cosignerC: iots.string
});

export type AdminSpec = iots.TypeOf<typeof adminSpecRT>;

export interface S3 {
  name: string;
  capTables: string;
  front: string;
  logic: string;
}

export interface OnlineReport {
  transcript: Transcript;
  ethState: {
    capTables: string;
    securities: Array<S3>;
  };
}

export interface OfflineReport {
  nonce: number;
  stage1: Array<[string, OfflineTranscriptEntry]>;
  stage2: Array<[string, OfflineTranscript]>;
}
