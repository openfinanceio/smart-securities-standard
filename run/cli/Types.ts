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

export interface Spec {
  /**
   * When null, deploy a new captables; otherwise this is the address of the
   * capTables contract to use.
   */
  capTables: string | null;
  /**
   * A designated address to resolve transfers
   */
  resolver: string | null;
  securityPaths: string[];
}

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
