pragma solidity ^0.4.24;

import { DelegatedTokenLogic } from "./DelegatedTokenLogic.sol";
import { IndexConsumer } from "./IndexConsumer.sol";
import { ICapTables } from "./interfaces/ICapTables.sol";

/**
 * One method for implementing a permissioned token is to appoint some
 * authority which must decide whether to approve or refuse trades.  This
 * contract implements this functionality.  
 */
contract SimplifiedLogic is IndexConsumer, DelegatedTokenLogic {
    
    enum TransferStatus {
        Unused,
        Active,
        Resolved
    }

    /** Data associated to a (request to) transfer */
    struct TokenTransfer {
        address src;
        address dest;
        uint256 amount;
        address spender;
        TransferStatus status;
    }
    
    /** 
     * The resolver determines whether a transfer ought to proceed and
     * executes or nulls it. 
     */
    address public resolver;

    /** 
     * Transfer requests are generated when a token owner (or delegate) wants
     * to transfer some tokens.  They must be either executed or nulled by the
     * resolver. 
     */
    mapping(uint256 => TokenTransfer) public transferRequests;

    /**
     * The contract may be deactivated during a migration.
     */
    bool public contractActive = true;
    
    /** Represents that a user intends to make a transfer. */
    event TransferRequest(
        uint256 indexed index,
        address src,
        address dest,
        uint256 amount,
        address spender
    );
    
    /** Represents the resolver's decision about the transfer. */
    event TransferResult(
        uint256 indexed index,
        uint16 code
    );
        
    /** 
     * Methods that are only safe when the contract is in the active state.
     */
    modifier onlyActive() {
        require(contractActive, "the contract MUST be active");
        _;
    }
    
    /**
     * Forbidden to all but the resolver.
     */
    modifier onlyResolver() {
        require(msg.sender == resolver, "this method is reserved for the designated resolver");
        _;
    }

    constructor(
        uint256 _index,
        address _capTables,
        address _owner,
        address _resolver
    ) public {
        index = _index;
        capTables = _capTables;
        owner = _owner;
        resolver = _resolver;
    }

    function transfer(address _dest, uint256 _amount, address _sender) 
        public 
        onlyFront 
        onlyActive 
        returns (bool) 
    {
        uint256 txfrIndex = nextIndex();
        transferRequests[txfrIndex] = TokenTransfer(
            _sender, 
            _dest, 
            _amount, 
            _sender, 
            TransferStatus.Active
        );
        emit TransferRequest(
            txfrIndex,
            _sender,
            _dest,
            _amount,
            _sender
        );
        return false; // The transfer has not taken place yet
    }

    function transferFrom(address _src, address _dest, uint256 _amount, address _sender) 
        public 
        onlyFront 
        onlyActive 
        returns (bool)
    {
        require(_amount <= allowed[_src][_sender], "the transfer amount MUST NOT exceed the allowance");
        uint txfrIndex = nextIndex();
        transferRequests[txfrIndex] = TokenTransfer(
            _src, 
            _dest, 
            _amount, 
            _sender, 
            TransferStatus.Active
        );
        emit TransferRequest(
            txfrIndex,
            _src,
            _dest,
            _amount,
            _sender
        );
        return false; // The transfer has not taken place yet
    }

    function setResolver(address _resolver)
        public
        onlyOwner
    {
        resolver = _resolver;
    }

    function resolve(uint256 _txfrIndex, uint16 _code) 
        public 
        onlyResolver
        returns (bool result)
    {
        require(transferRequests[_txfrIndex].status == TransferStatus.Active, "the transfer request MUST be active");
        TokenTransfer storage tfr = transferRequests[_txfrIndex];
        result = false;
        if (_code == 0) {
            result = true;
            if (tfr.spender == tfr.src) {
                // Vanilla transfer
                ICapTables(capTables).transfer(index, tfr.src, tfr.dest, tfr.amount);
            } else {
                // Requires an allowance
                ICapTables(capTables).transfer(index, tfr.src, tfr.dest, tfr.amount);
                allowed[tfr.src][tfr.spender] = allowed[tfr.src][tfr.spender].sub(tfr.amount);
            }
        } 
        transferRequests[_txfrIndex].status = TransferStatus.Resolved;
        emit TransferResult(_txfrIndex, _code);
    }

    function migrate(address newLogic) public onlyOwner {
        contractActive = false;
        ICapTables(capTables).migrate(index, newLogic);
    }

}
