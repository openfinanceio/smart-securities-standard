---
version: 0.2.0
status: experimental
---

OpenFinance S3 - Smart Securities Standard
==

Overview
--

S3 has grown out of the OpenFinance Network's efforts to automate certain
aspects of running a compliant alternatives exchange.  Currently, it consists
of a smart contract library and a typescript library for manipulating these
contracts.  However, the full scope includes a standard protocol that exchanges
an compliance providers can use to communicate in order to maintain the trading
invariants required by the SEC for securities to keep their filing exemptions.

Contributing
--

If you would like to contribute, please see `contributing.md` before you begin.
Then, take a look at the setup instructions below.

Architecture
--

The _simplified_ S3 architecture provides a permissioned token with no rule
checking on chain.  There are three classes of contracts.

- `CapTables`: All securities issued on S3 share this contract, which is only
  responsible for being the single source of truth for cap tables.
- `TokenFront`: This contract provides a fixed Ethereum address for a given
  security.  All calls are forwarded to a contract expressing rule logic.
- `SimpliedLogic`: This contract implements a two stage clearing and settlement
  protocol.  Users create token transfer requests by calling `transfer` and
  `transferFrom` on the associated `TokenFront`.  Then a third party resolves
  each transfer request by providing an error code.  Only on error code `0` is
  the transfer settled.

_Note: There are additional contracts in the library which directly reify
regulation D and regulation S rules.  However, these contracts and their
supporting TypeScript library are highly unstable._

How to use the contracts
--

Start by having a look at `src/Types.ts`.  To issue:


```typescript
import * as s3 from "@openfinance/smart-securities-standard";
import { readFileSync, writeFileSync } from "fs";
import * as Web3 from "web3";

const capTablesAddress = readFileSync("soon-to-be-deployed-s3-capTables.address", "utf8");
const security: s3.BaseSecurity = JSON.parse(readFileSync("mySecurity.json", "utf8"));

const prov = new Web3.providers.HttpProvider("http://localhost:8545");
const web3 = new Web3(prov);

async function go() {
  const record = await s3.issue(
    security, 
    capTablesAddress, 
    deploymentAddress, 
    Web3.eth
  );
  writeFileSync("my-deployment-record.json", JSON.stringify(record), "utf8");
}

go();
```

Manual issuance proceeds in several stages.

- **Stage I.** Choose a deployed `CapTables` contract and send a transaction
  which calls `initialize` with your total supply.  This will create a new
  security, owned by the caller and will give you the index of the security.
  The caller will hold the entire balance.
- **Stage II.**  Make calls to `CapTables.transfer` to configure the initial
  distribution of your security.
- **Stage III.** Deploy `SimplifiedLogic` to address `logicAddress`, then
  deploy `TokenFront` with construction parameter `logicAddress`.  Call
  `setFront` on `SimplifiedLogic` with the address of the `TokenFront` to
  authorize it to call in. 
- **Stage IV.** Make some provision to detect and resolve transfer requests.
  `SimplifiedLogic` will log `TransferRequest` messages as users attempt to
  move tokens around.
- **Stage V.** If you need to modify the logic that governs token transfers,
  use the `migrate` method of `CapTables` and `TokenFront`.

Implemented Regulations
==
RegD 506 (c)
--

A security which meets this exemption may be traded under the following 
conditions.

- An initial shareholder may transfer shares _after_ a 12 month holding period.
- Both the buyer and seller in a share transfer must meet AML-KYC requirements.
- The buyer must be accredited.
- If the security was issued by a fund, the number of shareholders must not
	exceed 99; otherwise the number of shareholders must not exceed 2000.

Reg S
--

This regulation covers certain securities that can be traded by foreign investors.

- Both the seller and buyer must pass AML/KYC checks.
- Both the seller and buyer must reside in a non-US jurisdiction.

Setting up S3 for development
==

S3 can be set up like any `npm` package, except that it depends on an
unpublished, experimental package `@cfxmarkets/web3-utils`.  Feel free to
contact `Ian Shipman` for a current tarball.
