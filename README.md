---
version: 0.1.1
---

OpenFinance S3 - Smart Securities Standard
==

This library contains a series of modular contracts, meant to build off of each 
other, and fit the needs of specific regulation. You will find all the 
requirements of a compliant transfer, AML/KYC, investor accreditation, and bad 
actor checks. Our library will encompass all offerings of registered & 
restricted securities, including Regulation D, Reg S, Reg A+, & Reg CF. These 
offerings will allow an issuer to easily and compliantly create a security 
token capable of utilizing the full benefit of the OFN ecosystem.

Contract overview 
--

### Interfaces

- `TransferRestrictor`is an interface for restricting ERC20 transfers. Contains 
	a function .test that checks address to, address from, amount, and token 
	address. Returns a bool
- `RestrictedToken` is the basis of the Security token standard. This is the 
	first line in the extension of the StandardToken (ERC20) Open Zeppelin 
	contract. It adds flexible rule checking. RestrictedToken is passed a 
	restrictor address, which is then used to test against msg.sender, to, value, 
	and the token (this). From there, restricted transfers can occur, or 
	delegated resticted transfers. (transfer && transferFrom)
- `UserChecker` is an interface that confirms user address and returns a bool
- `RegD506c` is an implementation of the restrictions set forth via regulation D 
	exemption 506(c). Inherits Transfer Restrictor. This contracts begins the 
	holding period of the token, registers AML/KYC, investor accreditation, and 
	bad actor checks.
- `RegD506cToken` Returns a bool determining if the token represents the a 
	fund, which hold different shareholder limits.

### Concrete contracts

- `SimpleUserChecker` is an extension of Ownable and UserChecker. Used to 
	confirm entities via checkers, or registered address allowed to approve said 
	enitity identities. Add, remove, and confirm Users.
- `TheRegD506c` holds tables for all AML-KYC, accredited investors, and 
	Issuance dates for the securities. Enforces All applied Rules, checks AML-KYC 
	status with the registered checker, confirms accredited investor status with 
	the associated checker.
- `ARegD506cToken` implements the `RegD506cToken` interface, which requires 
	internal tracking of the number of active shareholders.  A given shareholder 
	may have multiple Ethereum accounts, but in this draft of the standard we 
	actually restrict the number of accounts that have a positive balance.  
	_Note: An attacker may be able to DoS the investment community by buying 
	shares under multiple accounts and exhausting the account allotment._

Implemented Regulations
==

Reg S
--

RegD 506 (c)
--

A security which meets this exemption may be traded under the following 
conditions.

- An initial shareholder may transfer shares _after_ a 12 month holding period.
- Both the buyer and seller in a share transfer must meet AML-KYC requirements.
- The buyer must be accredited.
- If the security was issued by a fund, the number of shareholders must not
	exceed 99; otherwise the number of shareholders must not exceed 2000.
