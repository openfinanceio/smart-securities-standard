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
    console.log("Deploying front and coordinator");
    const createFront = new Promise((resolve, reject) => {
      console.log("Creating front");
      web3.eth.contract(ABI.TokenFront.abi).new(
        security.owner,
        {
          data: ABI.TokenFront.bytecode,
          from: controller,
          gas: 3e6
        },
        (err: Error, instance: Web3.ContractInstance) => {
          if (!_.isNull(err)) {
            reject(err);
          }
          if (!_.isUndefined(instance.address)) {
            console.log(`Front deployed to ${instance.address}`);
            resolve(instance);
          }
        }
      );
    }) as Promise<Web3.ContractInstance>;
    const createCoordinator = (front: Web3.ContractInstance) =>
      new Promise((resolve, reject) => {
        switch (security.__type) {
          case "RegD": {
            if (contracts.regD === null) {
              throw Error("We need an instance of TheRegD506c!");
            }
            console.log("Creating RegD coordinator");
            web3.eth.contract(ABI.ARegD506cToken.abi).new(
              supply,
              security.investors.length,
              security.isFund,
              contracts.regD,
              contracts.capTables,
              {
                data: ABI.ARegD506cToken.bytecode,
                from: controller,
                gas: 3e6
              },
              (err: Error, instance: Web3.ContractInstance) => {
                if (!_.isNull(err)) {
                  reject(err);
                }
                if (!_.isUndefined(instance.address)) {
                  console.log(`Deployed to ${instance.address}`);
                  // Register the checkers
                  const regDAddr = contracts.regD as string;
                  const regD = web3.eth
                    .contract(ABI.TheRegD506c.abi)
                    .at(regDAddr);
                  console.log("Registering AML/KYC checker");
                  regD.registerAmlKycChecker(contracts.kyc, instance.address, {
                    from: controller,
                    gas: 1e5
                  });
                  console.log("Registering accreditation checker");
                  regD.registerAccreditationChecker(
                    contracts.accreditation,
                    instance.address,
                    {
                      from: controller,
                      gas: 1e5
                    }
                  );
                  console.log("Migrating front to this coordinator");
                  front.migrate(instance.address, { from: security.owner });
                  front.transferOwnership(security.issuer, {
                    from: security.owner
                  });
                  console.log("Setting the front for the coordinator");
                  instance.setFront(front.address, { from: controller });
                  instance.transferOwnership(security.issuer, {
                    from: controller
                  });
                  console.log("Token contracts configured!");
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
            console.log("Creating a new RegS coordinator");
            web3.eth
              .contract(ABI.ARegSToken.abi)
              .new(
                supply,
                contracts.regS,
                contracts.capTables,
                { data: ABI.ARegSToken.bytecode, from: controller, gas: 4e5 },
                (err: Error, instance: Web3.ContractInstance) => {
                  if (!_.isNull(err)) {
                    reject(err);
                  }
                  if (!_.isUndefined(instance.address)) {
                    console.log(`Deployed to ${instance.address}`);
                    const regSAddr = contracts.regS as string;
                    const regS = web3.eth
                      .contract(ABI.TheRegS.abi)
                      .at(regSAddr);
                    console.log("Registering AML/KYC checker");
                    regS.registerAmlKycChecker(
                      security.checkers.amlKyc,
                      instance.address,
                      {
                        from: controller,
                        gas: 1e5
                      }
                    );
                    console.log("Registering residency checker");
                    regS.registerResidencyChecker(
                      security.checkers.residency,
                      instance.address,
                      {
                        from: controller,
                        gas: 1e5
                      }
                    );
                    console.log("Migrating front to this coordinator");
                    front.migrate(instance.address, { from: controller });
                    front.transferOwnership(security.issuer, {
                      from: controller
                    });
                    console.log("Setting the front");
                    instance.setFront(front.address, { from: controller });
                    instance.transferOwnership(security.issuer, {
                      from: controller
                    });
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
  console.log("Migrating");
  const th = CT.migrate(sid, tokenAddress, { from: controller });
  console.log(th);
  if (security.__type == "RegD") {
    T.issue({ from: security.issuer });
  }
  return {
    coordinator: tokenAddress,
    front: frontAddress,
    securityId: sid
  };
}
