import * as Web3 from "web3";

import * as C from "./Contracts";

export type Security = RegD | RegS;

export interface RegD extends HasInvestors {
  __type: "RegD";
  isFund: boolean;
};

export interface RegS extends HasInvestors {
  __type: "RegS";
}

interface BaseSecurity {
  investors: { address: string; amount: BigNumber }[];
  metadata: any;
  owner: string;
}

export interface State {
  chainHeight: number;
}

export class Client {

  private state: State;

  constructor(p: Web3.Provider, s: State | null) {
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
   * Get the current state of the system as understood by our node. 
   */
  public state(): State {
    return;
  }

}
