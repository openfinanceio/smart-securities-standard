pragma solidity ^0.5.0;

import { DelegatedERC20 } from "./interfaces/DelegatedERC20.sol";
import { SimplifiedLogic } from "./SimplifiedLogic.sol";
import { TokenFront } from "./TokenFront.sol";

/**
 * This contract adds a 2-of-3 signature requirement to administrative calls.
 */
contract Administration {

    /** 
     * Since a method call requires 3 signatures, when it has one signature it
     * is in an indeterminate state.
     */
    enum CallStatus {
        None,
        Open,
        Complete
    }

    /**
     * These are the operations available.
     */
    enum Operation {
        AbortCall,
        SetResolver,
        Clawback,
        Migrate,
        NewAdmin,
        Rotate,
        Bind
    }

    /** 
     * Information about the current state of the call 
     */
    struct MethodCall {
        CallStatus status;
        Operation op;
        bool sigA;
        bool sigB;
        bool sigC;
        bytes32 argHash;
    }

    enum Signer { A, B, C }


    bool public bound = false;
    uint256 public maximumClaimedCallNumber = 0;

    SimplifiedLogic public targetLogic;
    TokenFront public targetFront;

    address public cosignerA;
    address public cosignerB;
    address public cosignerC;

    mapping(uint256 => MethodCall) public methodCalls;
    

    constructor(
        address _cosignerA,
        address _cosignerB,
        address _cosignerC
    ) public {
        cosignerA = _cosignerA;
        cosignerB = _cosignerB;
        cosignerC = _cosignerC;
    }
    
    /**
     * Here we implement the preliminary checks: 
     * - sender must be a cosigner
     * - call slot must be available
     * - if the call is in progress the method must match
     */
    function setup(uint256 _callNumber, Operation _op, bytes32 _argHash) internal {
        require(
            msg.sender == cosignerA || msg.sender == cosignerB || msg.sender == cosignerC,
            "method call restricted to cosigners"
        );

        MethodCall storage mc = methodCalls[_callNumber];

        require(
            mc.status == CallStatus.None || 
            mc.status == CallStatus.Open,
            "method status must be none or open"
        );

        if (mc.status == CallStatus.None) {

            if (_callNumber > maximumClaimedCallNumber) {
                maximumClaimedCallNumber = _callNumber;
            }

            mc.status = CallStatus.Open;
            mc.op = _op;
            mc.argHash = _argHash;

        } else {
            require(
                _argHash == mc.argHash,
                "same arguments must be passed"
            );

            require(
                mc.op == _op,
                "the call on file must match the current call"
            );
        }
    }

    /** 
     * Add the senders signature as appropriate. 
     */
    function addSig(uint256 _callNumber) internal {
        MethodCall storage mc = methodCalls[_callNumber];

        if (msg.sender == cosignerA) {
            mc.sigA = true;
        } else if (msg.sender == cosignerB) {
            mc.sigB = true;
        } else if (msg.sender == cosignerC) {
            mc.sigC = true;
        }

    }

    /**
     * Check if there are two signatures 
     */
    function thresholdMet(uint256 _callNumber) public view returns (bool) {
        MethodCall storage mc = methodCalls[_callNumber];
        return (mc.sigA && mc.sigB) || (mc.sigA && mc.sigC) || (mc.sigB && mc.sigC);
    }

    /**
     * Update the given call to complete state.
     */
    function complete(uint256 _callNumber) internal {
        methodCalls[_callNumber].status = CallStatus.Complete;
    }

    /**
     * Abort the named call if it is incomplete
     */
    function abortCall(uint256 _callNumber, uint256 _callRef) public {
        setup(
            _callNumber, 
            Operation.AbortCall, 
            keccak256(abi.encodePacked(_callRef))
        );

        addSig(_callNumber);

        if (
            thresholdMet(_callNumber) &&
            methodCalls[_callRef].status == CallStatus.Open
           ) 
        {

            complete(_callRef);
            complete(_callNumber);

        }
    }

    /**
     * Bind the contract to an S3 token front - token logic pair.
     */
    function bind(uint256 _callNumber, SimplifiedLogic _tokenLogic, TokenFront _tokenFront) public {
        setup(
            _callNumber, 
            Operation.Bind, 
            keccak256(abi.encodePacked(_tokenLogic, _tokenFront))
        );

        addSig(_callNumber);

        if (thresholdMet(_callNumber)) {
            
            bound = true;
            targetLogic = _tokenLogic;
            targetFront = _tokenFront;

            complete(_callNumber);

        }
    }

    /**
     * SimplifiedLogic.setResolver
     */
    function setResolver(uint256 _callNumber, address _resolver) public {

        setup(
            _callNumber, 
            Operation.SetResolver, 
            keccak256(abi.encodePacked(_resolver))
        );

        addSig(_callNumber);

        if (thresholdMet(_callNumber)) {

            targetLogic.setResolver(_resolver);
            complete(_callNumber);

        }
    }

    /**
     * SimplifiedLogic.clawback
     */
    function clawback(
        uint256 _callNumber, 
        address _src, 
        address _dst, 
        uint256 _amount
    ) public {

        setup(
            _callNumber, 
            Operation.Clawback, 
            keccak256(abi.encodePacked(_src, _dst, _amount))
        );

        addSig(_callNumber);

        if (thresholdMet(_callNumber)) {

            targetLogic.clawback(_src, _dst, _amount);
            complete(_callNumber);

        }
    }

    /**
     * SimplifiedLogic.migrate & TokenFront.newLogic
     */
    function migrate(uint256 _callNumber, DelegatedERC20 _newLogic) public {

        setup(
            _callNumber, 
            Operation.Migrate,
            keccak256(abi.encodePacked(_newLogic))
        );

        addSig(_callNumber);

        if (thresholdMet(_callNumber)) {

            targetLogic.migrate(address(_newLogic));
            targetFront.migrate(_newLogic);
            complete(_callNumber);

        }

    }

    /**
     * SimplifiedLogic.transferOwnership & TokenFront.transferOwnership
     */
    function newAdmin(uint256 _callNumber, address _newOwner) public {

        setup(
            _callNumber, 
            Operation.NewAdmin,
            keccak256(abi.encodePacked(_newOwner))
        );

        addSig(_callNumber);

        if (thresholdMet(_callNumber)) {

            targetLogic.transferOwnership(_newOwner);
            targetFront.transferOwnership(_newOwner);
            complete(_callNumber);

        }

    }

    /**
     * Change a signer
     */
    function rotate(uint256 _callNumber, Signer _s, address _newSigner) public {

        setup(
            _callNumber, 
            Operation.Rotate,
            keccak256(abi.encodePacked(_s, _newSigner))
        );

        addSig(_callNumber);

        if (thresholdMet(_callNumber)) {

            if (_s == Signer.A) {
                cosignerA = _newSigner;
            } else if (_s == Signer.B) {
                cosignerB = _newSigner;
            } else if (_s == Signer.C) {
                cosignerC = _newSigner;
            }
            complete(_callNumber);

        }


    }

}
