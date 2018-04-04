import * as Web3 from "web3";
import * as C from "./Contracts";

/** 20 byte hex-encoded key hash prefixed with "0x" */
export type Address = string;

/** Securities in S3 are defined by an integer key */
export type SecurityId = number;

/** S3 supports two kinds of security: regulation D & S */
export type Security = RegD | RegS;

export interface RegD extends BaseSecurity {
  __type: "RegD";
  isFund: boolean;
};

export interface RegS extends BaseSecurity {
  __type: "RegS";
}

export interface BaseSecurity {
  investors: { address: string; amount: BigNumber }[];
  metadata: any;
  owner: string;
}

export interface State {
  chainHeight: number;
  capTables: Address | null;
}

export class Client {
  private prov: Web3.Provider;
  private st: State;

  constructor(p: Web3.Provider, s: State | null) {
    this.prov = p;
    if (s !== null) {
      this.st = s;
    } else {
      // Assume that we are joining the network for the first time
      this.st = {
        chainHeight: 0,
        capTables: null
      }
    }
  }

  /**
   * Set up an S3 ecosystem by deploying an instance of the captables contract
   * and an instance of the metadata contract.
   * @return the address of the deployed contract
   */
  public async init(): Promise<string> {
    return undefined;
  }
 
  /**
   * Issue a security.
   */
  public async issue(s: Security): Promise<SecurityId> {
    return undefined;
  }
  
  /**
   * Change the rules surrounding the transfer of a security.
   */
  public async migrate(sid: SecurityId, newLogic: string): Promise<void> {
    return;
  }

  /** 
   * Export value to an ERC20 token.
   * @param id The security we are exporting
   * @param controller The address which controls the security
   * @param configureToken A function which deploys or configures the new token
   *   using the address of the exporter contract
   *
   * _Note: Before setting up the exporter, control over the security somehow
   * has to be transfered to the named controller._
   */
  public async setupExporter(
    id: SecurityId,
    controller: Address,
    configureToken: (exporter: Address) => Promise<Address>,
  ): Promise<void> {
    return;
  }

  /**
   * Import value from an ERC20 token.
   * @param srcToken The ERC20 token from which to import value
   * @param configureToken A function which sets up S3 token rules and provides
   *   an address to which to transfer control of the newly created security.
   */
  public async setupImporter(
    srcToken: Address,
    configureToken: () => Promise<Address>
  ): Promise<void> {
    return;
  }
  
  /** 
   * Get the current state of the system as understood by our node. 
   */
  public state(): State {
    return undefined;
  }
}
