import * as Web3 from "web3";
import { SolidityFunction } from "web3/lib/web3/function";
import { ABI } from "./Contracts";

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
    jurisdiction: Address;
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
  capTables: Address | null;
  regD: Address | null;
  regS: Address | null;
}

export interface S3Metadata {
  currentLogic: string;
  id: SecurityId;
  name: string;
}

export interface State {
  chainHeight: number;
  contracts: S3Contracts;
  securities: S3Metadata[];
}

// function migrate(address newAddress);
const migrateABI = {
  name: "migrate",
  payable: false,
  constant: false,
  type: "function",
  inputs: [
    {
      name: "newAddress",
      type: "address"
    }
  ],
  outputs: [],
  stateMutability: "nonpayable"
};

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
        .contract(ABI.CapTables)
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
    if (this.st.contracts.capTables !== null) {
      throw Error("We already have a cap tables contract!");
    }
    const CT = await this.w3.eth
      .contract(ABI.CapTables)
      .new({ from: this.controller });
    const RD = await this.w3.eth
      .contract(ABI.TheRegD506c)
      .new({ from: this.controller });
    const RS = await this.w3.eth
      .contract(ABI.TheRegS)
      .new({ from: this.controller });
    const cs = {
      capTables: CT.address,
      regD: RD.address,
      regS: RS.address
    };
    this.capTables = CT;
    this.st.contracts = cs;
    return cs;
  }

  /**
   * Issue a security.
   * TODO:
   * - [ ] make the allocation more efficient (maybe using coupons)
   */
  public async issue(
    s: Security
  ): Promise<{ securityId: SecurityId; token: Address }> {
    if (this.capTables === null) {
      this.initClient();
    }
    // Compute the total supply
    const supply: BigNumber = s.investors.reduce(
      (s, x) => s.plus(x.amount),
      new BigNumber(0)
    );
    const CT = this.capTables as Web3.ContractInstance;
    const sid: SecurityId = await CT.initialize(supply, {
      from: this.controller
    });
    // Deploy the token logic contracts
    const computeInstance = () => {
      switch (s.__type) {
        case "RegD": {
          if (this.st.contracts.regD === null) {
            throw Error("We need an instance of TheRegD506c!");
          }
          return this.w3.eth
            .contract(ABI.ARegD506cToken)
            .new(
              s.isFund,
              s.issuer,
              this.st.contracts.regD,
              this.st.contracts.capTables,
              sid,
              { from: this.controller }
            );
        }
        case "RegS": {
          if (this.st.contracts.regS === null) {
            throw Error("We need an instance of TheRegS!");
          }
          return this.w3.eth
            .contract(ABI.ARegSToken)
            .new(
              s.issuer,
              this.st.contracts.regS,
              this.st.contracts.capTables,
              sid,
              { from: this.controller }
            );
        }
      }
    };
    const T = computeInstance();
    // Configure the cap table
    await Promise.all(
      s.investors.map(inv => {
        T.transferFrom(this.controller, inv.address, inv.amount, {
          from: this.controller
        });
      })
    );
    this.st.securities.push({
      currentLogic: T.address,
      id: sid,
      name: s.metadata.name
    });
    return {
      securityId: sid,
      token: T.address
    };
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
    const tokenAddress = await this.capTables.addresses.call(sid);
    const mgrt = new SolidityFunction(this.w3.eth, migrateABI, tokenAddress);
    await mgrt.sendTransaction(newLogic, {
      from: administrator
    });
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
    controller: Address,
    configureToken: (exporter: Address) => Promise<Address>
  ): Promise<void> {
    return;
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
  ): Promise<void> {
    return;
  }

  /**
   * Get the current state of the system as understood by our node.
   */
  public state(): State {
    return this.st;
  }
}
