import { ABI } from "./Contracts";
import { Address, S3Contracts } from "./Types";

import * as _ from "lodash";
import * as Web3 from "web3";

export function initS3(
  this: void,
  web3: Web3,
  capTables: string | null,
  controller: string
): Promise<[S3Contracts, Web3.ContractInstance]> {
  if (capTables !== null) {
    throw Error("We already have a cap tables contract!");
  }
  return new Promise(resolve => {
    const cs: S3Contracts = {
      capTables: null,
      regD: null,
      regS: null
    };
    const finish = (cs: S3Contracts, CT: Web3.ContractInstance) => {
      if (!(_.isNull(cs.capTables) || _.isNull(cs.regD) || _.isNull(cs.regS))) {
        resolve([cs, CT]);
      }
    };
    const CT = web3.eth.contract(ABI.CapTables.abi).new(
      {
        data: ABI.CapTables.bytecode,
        from: controller,
        gas: 5e5
      },
      (err: Error, contract: Web3.ContractInstance) => {
        if (!_.isUndefined(contract.address)) {
          cs.capTables = contract.address;
          finish(cs, CT);
        }
      }
    );
    web3.eth.contract(ABI.TheRegD506c.abi).new(
      0, // FIXME: deal with the holding period
      { data: ABI.TheRegD506c.bytecode, from: controller, gas: 1e6 },
      (err: Error, contract: Web3.ContractInstance) => {
        if (!_.isUndefined(contract.address)) {
          cs.regD = contract.address;
          finish(cs, CT);
        }
      }
    );
    web3.eth
      .contract(ABI.TheRegS.abi)
      .new(
        { data: ABI.TheRegS.bytecode, from: controller, gas: 5e5 },
        (err: Error, contract: Web3.ContractInstance) => {
          if (!_.isUndefined(contract.address)) {
            cs.regS = contract.address;
            finish(cs, CT);
          }
        }
      );
  });
}

export async function initUserChecker(
  this: void,
  checkers: Address[],
  controller: string,
  web3: Web3
): Promise<Address> {
  const deploy = new Promise((resolve, reject) => {
    web3.eth.contract(ABI.SimpleUserChecker.abi).new(
      {
        from: controller,
        data: ABI.SimpleUserChecker.bytecode,
        gas: 5e5
      },
      (err: Error, instance: Web3.ContractInstance) => {
        if (!_.isNull(err)) {
          reject(err);
        }
        if (!_.isUndefined(instance.address)) {
          resolve(instance);
        }
      }
    );
  });
  const userChecker = (await deploy) as Web3.ContractInstance;
  await Promise.all(
    checkers.map(
      checker =>
        new Promise((resolve, reject) =>
          userChecker.addChecker(
            checker,
            {
              from: controller,
              gas: 1e5
            },
            (err: Error) => {
              if (!_.isNull(err)) {
                reject(err);
              }
              resolve();
            }
          )
        )
    )
  );
  return userChecker.address;
}
