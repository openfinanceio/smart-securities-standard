import { ABI } from "./Contracts";
import { Address, S3Contracts, Security, SecurityId } from "./Types";

import { BigNumber } from "bignumber.js";
import * as _ from "lodash";
import * as Web3 from "web3";

export async function issue(
  this: void,
  security: Security,
  contracts: S3Contracts,
  controller: Address,
  web3: Web3
): Promise<{ securityId: SecurityId; coordinator: Address; front: Address }> {
  // Compute the total supply
  const supply: BigNumber = security.investors.reduce(
    (s, x) => s.plus(x.amount),
    new BigNumber(0)
  );
  // Deploy the token logic contracts
  function deploy(): Promise<[Address, Web3.ContractInstance]> {
    console.log("deploying");
    const createFront = new Promise((resolve, reject) => {
      console.log("creating front");
      web3.eth.contract(ABI.TokenFront.abi).new(
        {
          data: ABI.TokenFront.bytecode,
          from: controller,
          gas: 7e5
        },
        (err: Error, instance: Web3.ContractInstance) => {
          if (!_.isNull(err)) {
            reject(err);
          }
          if (!_.isUndefined(instance.address)) {
            console.log(instance.address);
            resolve(instance);
          }
        }
      );
    }) as Promise<Web3.ContractInstance>;
    const createCoordinator = (front: Web3.ContractInstance) =>
      new Promise((resolve, reject) => {
        console.log("creating coordinator");
        switch (security.__type) {
          case "RegD": {
            if (contracts.regD === null) {
              throw Error("We need an instance of TheRegD506c!");
            }
            web3.eth.contract(ABI.ARegD506cToken.abi).new(
              supply,
              security.isFund,
              security.issuer,
              contracts.regD,
              contracts.capTables,
              {
                data: ABI.ARegD506cToken.bytecode,
                from: controller,
                gas: 2e6
              },
              (err: Error, instance: Web3.ContractInstance) => {
                if (!_.isNull(err)) {
                  reject(err);
                }
                if (!_.isUndefined(instance.address)) {
                  // Register the checkers
                  console.log(instance);
                  const regDAddr = contracts.regD as string;
                  const regD = web3.eth
                    .contract(ABI.TheRegD506c.abi)
                    .at(regDAddr);
                  regD.registerAmlKycChecker(
                    security.checkers.amlKyc,
                    instance.address,
                    {
                      from: security.issuer,
                      gas: 1e5
                    }
                  );
                  regD.registerAccreditationChecker(
                    security.checkers.accreditation,
                    instance.address,
                    {
                      from: security.issuer,
                      gas: 1e5
                    }
                  );
                  console.log(front);
                  front.migrate(instance.address, { from: controller });
                  instance.setFront(front.address, { from: controller });
                  resolve([front.address, instance]);
                }
              }
            );
            break;
          }
          case "RegS": {
            if (contracts.regS === null) {
              throw Error("We need an instance of TheRegS!");
            }
            web3.eth
              .contract(ABI.ARegSToken.abi)
              .new(
                supply,
                security.issuer,
                contracts.regS,
                contracts.capTables,
                { data: ABI.ARegSToken.bytecode, from: controller, gas: 4e5 },
                (err: Error, instance: Web3.ContractInstance) => {
                  if (!_.isNull(err)) {
                    reject(err);
                  }
                  if (!_.isUndefined(instance.address)) {
                    const regSAddr = contracts.regS as string;
                    const regS = web3.eth
                      .contract(ABI.TheRegS.abi)
                      .at(regSAddr);
                    regS.registerAmlKycChecker(
                      security.checkers.amlKyc,
                      instance.address,
                      {
                        from: controller,
                        gas: 1e5
                      }
                    );
                    regS.registerResidencyChecker(
                      security.checkers.residency,
                      instance.address,
                      {
                        from: controller,
                        gas: 1e5
                      }
                    );
                    front.migrate(instance.address, { from: controller });
                    instance.setFront(front.address, { from: controller });
                    resolve([front.address, instance]);
                  }
                }
              );
          }
        }
      }) as Promise<[Address, Web3.ContractInstance]>;
    return createFront.then(createCoordinator);
  }
  const [frontAddress, T] = await deploy();
  console.log(frontAddress, T);
  const tokenAddress = T.address;
  const sid: BigNumber = T.index.call();
  // Configure the cap table
  const capTablesAddr = contracts.capTables as string;
  const CT = web3.eth.contract(ABI.CapTables.abi).at(capTablesAddr);
  console.log("Doing distribution");
  await Promise.all(
    security.investors.map(inv => {
      console.log(`${inv.address} gets ${inv.amount.toString()}`);
      return new Promise((resolve, reject) =>
        CT.transfer(
          sid,
          controller,
          inv.address,
          inv.amount,
          {
            from: controller
          },
          (err: Error, hash: string) => {
            if (!_.isNull(err)) {
              reject(err);
            } else {
              resolve(hash);
            }
          }
        )
      );
    })
  );
  // Move control of the cap table to the token
  CT.migrate(sid, tokenAddress, { from: controller });
  if (security.__type == "RegD") {
    T.issue({ from: security.issuer });
  }
  return {
    coordinator: tokenAddress,
    front: frontAddress,
    securityId: sid
  };
}
