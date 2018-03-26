---
version: 0.1.1
---

OpenFinance S3 - Smart Securities Standard
==

This library contains contracts which reify particular SEC rules and
exemptions, such as regulations A+, CF, D, and S.  The library architecture
makes it possible for securities issuers to automate compliance with the SEC
rules governing their class of securities, and to roll over into other classes
as and when the rules allow. 

Contract overview 
--

### Interfaces

- `TransferRestrictor`:  A contract expressing rules about whether to approve or
  block an ERC token transfer should implement this interface.  The contract
  may use the information available at call time (value sender, value receiver,
  and amount) as well as any additional information exposed through some
  interface of the calling contract.
- `UserChecker`:  Contracts which determine whether or not to block an account
  from doing something should implement this interface. 
- `RegD506c`:  This interface captures the methods required to configure the
  contract make a determination about the compliance of a token transfer under
  regulation D 506(c).  _Note: current implementation allows up to one contract
  to be designated as an AML/KYC provider for each token.  Similarly for
  accreditation checkers._ 
- `RegD506cToken`:  Tokens regulated under regulation D 506(c) should implement
  this interface, which exposes the current number of shareholders. 

### Concrete contracts

- `RestrictedToken`:  This contract extends Open Zeppelin's ERC20
  `StandardToken` contract, by allowing a `TransferRestrictor` to be configured
  which is used to enforce some rule set.
- `SimpleUserChecker`:  This contract implements the `UserChecker` interface.
  It maintains a configurable list of agents who may confirm users by storing a
  commitment (presumably a hash digest of a document) to user data.
- `TheRegD506c`:  This contract implements regulation D 506 (c) rules.  To use
  this as their `TransferRestrictor`, tokens must configure an AML/KYC provider
  and an accredited investor status checker for themselves.  These contracts
  must implement `UserChecker`.  Furthermore, the token contract must implement
  `RegD506cToken`.
- `ARegD506cToken`:  This contract implements the `RegD506cToken` interface,
  which requires internal tracking of the number of active shareholders.  A
  given shareholder may have multiple Ethereum accounts, but in this draft of
  the standard we actually restrict the number of accounts that have a positive
  balance.  _Note: An attacker may be able to DoS the investment community by
  buying shares under multiple accounts and exhausting the account allotment._

Implemented Regulations
==

Reg S
--

This regulation covers certain securities that can be traded by foreign investors.

RegD 506 (c)
--

A security which meets this exemption may be traded under the following 
conditions.

- An initial shareholder may transfer shares _after_ a 12 month holding period.
- Both the buyer and seller in a share transfer must meet AML-KYC requirements.
- The buyer must be accredited.
- If the security was issued by a fund, the number of shareholders must not
	exceed 99; otherwise the number of shareholders must not exceed 2000.
