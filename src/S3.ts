import * as Web3 from "web3";
import { ABI } from "./Contracts";
import * as Init from "./Init";
import { issue } from "./Issue";
import { migrate, setupExporter, setupImporter } from "./Migrate";
import {
  Address,
  S3Contracts,
  S3Metadata,
  SecurityId,
  Security
} from "./Types";

export interface State {
  chainHeight: number;
  contracts: S3Contracts;
  securities: S3Metadata[];
}

export const MissingCapTables = Error("A CapTables instance is required!");

export class Client {
  private capTables: Web3.ContractInstance | null;
  private controller: Address;
  private st: State;
  private w3: Web3;

  constructor(c: Address, s: State | null, p: Web3.Provider) {
    this.controller = c;
    this.w3 = new Web3(p);
    if (s !== null) {
      this.st = s;
    } else {
      // Assume that we are joining the network for the first time
      this.st = {
        chainHeight: 0,
        contracts: {
          capTables: null,
          regD: null,
          regS: null
        },
        securities: []
      };
    }
  }

  /**
   * Create a CapTables instance if possible.
   */
  public async initClient(): Promise<void> {
    if (this.capTables !== null) {
      throw Error("We already have a CapTables instance!");
    }
    if (this.st !== null && this.st.contracts.capTables !== null) {
      this.capTables = await this.w3.eth
        .contract(ABI.CapTables.abi)
        .at(this.st.contracts.capTables);
    } else {
      throw Error("We need the address of a CapTables contract!");
    }
  }

  /**
   * Set up an S3 ecosystem by deploying an instance of the captables contract
   * and an instance of the metadata contract.
   * @return the address of the deployed contract
   */
  public async initS3(): Promise<S3Contracts> {
    const [cs, CT] = await Init.initS3(
      this.w3,
      this.st.contracts.capTables,
      this.controller
    );
    this.capTables = CT;
    this.st.contracts = cs;
    return cs;
  }

  /**
   * Set up a new user checker to use.
   */
  public initUserChecker(checkers: Address[]): Promise<Address> {
    return Init.initUserChecker(checkers, this.controller, this.w3);
  }

  /**
   * Issue a security.
   * TODO:
   * - [ ] make the allocation more efficient (maybe using coupons)
   */
  public async issue(
    security: Security
  ): Promise<{ securityId: SecurityId; token: Address }> {
    if (this.capTables === null) {
      this.initClient();
    }
    const res = await issue(
      security,
      this.st.contracts,
      this.controller,
      this.w3
    );
    this.st.securities.push({
      currentLogic: res.token,
      id: res.securityId,
      name: security.metadata.name
    });
    return res;
  }

  /**
   * Change the rules surrounding the transfer of a security.
   * The old contract should implement a unary method `migrate` that takes that
   * address of the new contract and configures the new contract appropriately.
   */
  public async migrate(
    sid: SecurityId,
    newLogic: string,
    administrator: string
  ): Promise<void> {
    if (this.capTables === null) {
      throw MissingCapTables;
    }
    migrate(sid, newLogic, administrator, this.capTables, this.w3);
  }

  /**
   * Produce a URI for a security.  Note that the URI must include the address
   * of the CapTables contract as the security's ID.
   */
  public securityURI(sid: SecurityId): string {
    if (this.st.contracts.capTables === null) {
      throw MissingCapTables;
    }
    return `s3://${this.st.contracts.capTables.slice(2)}/${sid.toString()}`;
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
   *
   * TODO:
   * - [ ] implement
   */
  public async setupExporter(
    id: SecurityId,
    configureToken: (exporter: Address) => Promise<Address>
  ): Promise<Address> {
    return setupExporter(id, configureToken, this.controller, this.w3);
  }

  /**
   * Import value from an ERC20 token.
   * @param srcToken The ERC20 token from which to import value
   * @param configureToken A function which sets up S3 token rules and provides
   *   an address to which to transfer control of the newly created security.
   *
   * TODO:
   * - [ ] implement
   */
  public async setupImporter(
    srcToken: Address,
    configureToken: () => Promise<Address>
  ): Promise<{ securityId: SecurityId; token: Address }> {
    return setupImporter(srcToken, configureToken, this.controller, this.w3);
  }

  /**
   * Get the current state of the system as understood by our node.
   */
  public state(): State {
    return this.st;
  }
}
