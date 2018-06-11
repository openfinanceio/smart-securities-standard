import { ABI, Artifact } from "./Contracts";
import { Address, S3Contracts } from "./Types";

import * as _ from "lodash";
import * as Web3 from "web3";

export async function initS3(
  this: void,
  web3: Web3,
  controller: string
): Promise<S3Contracts> {
  const simpleContract = (def: Artifact) =>
    new Promise((resolve, reject) => {
      web3.eth.contract(def.abi).new(
        {
          data: def.bytecode,
          from: controller,
          gas: 1e6
        },
        (err: Error, contract: Web3.ContractInstance) => {
          if (err !== null) {
            reject(err);
          } else if (!_.isUndefined(contract.address)) {
            const address: string = contract.address;
            resolve(address);
          }
        }
      );
    }) as Promise<string>;
  const capTables = await simpleContract(ABI.CapTables);
  const regS = await simpleContract(ABI.TheRegS);
  const regD = (await new Promise((resolve, reject) =>
    web3.eth.contract(ABI.TheRegD506c.abi).new(
      0, // FIXME: deal with the holding period
      { data: ABI.TheRegD506c.bytecode, from: controller, gas: 1e6 },
      (err: Error, contract: Web3.ContractInstance) => {
        if (err !== null) {
          reject(err);
        } else if (!_.isUndefined(contract.address)) {
          resolve(contract.address);
        }
      }
    )
  )) as string;
  // FIXME: allow for user checker configuration
  const kyc = await initUserChecker([], controller, web3);
  const accreditation = await initUserChecker([], controller, web3);
  const residency = await initUserChecker([], controller, web3);
  const contracts = {
    capTables,
    regD,
    regS,
    kyc,
    accreditation,
    residency
  };
  return contracts;
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
        gas: 8e5
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
