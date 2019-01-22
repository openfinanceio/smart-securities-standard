pragma solidity ^0.5.0;

import { DelegatedERC20 } from "./interfaces/DelegatedERC20.sol";
import { SimplifiedLogic } from "./SimplifiedLogic.sol";
import { TokenFront } from "./TokenFront.sol";

/**
 * This contract adds a 2-of-3 signature requirement to administrative calls.
 */
contract Administer {

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
        NewLogic,
        Rotate
    }

    struct MethodCall {
        CallStatus status;
        Operation op;
        bool sigA;
        bool sigB;
        bool sigC;
        bytes32 argHash;
    }

    enum Signer { A, B, C }


    SimplifiedLogic targetLogic;
    TokenFront targetFront;

    address cosignerA;
    address cosignerB;
    address cosignerC;

    mapping(uint256 => MethodCall) methodCalls;
    

    constructor(
        SimplifiedLogic _targetLogic,
        TokenFront _targetFront,
        address _cosignerA,
        address _cosignerB,
        address _cosignerC
    ) public {
        targetLogic = _targetLogic;
        targetFront = _targetFront;
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

        require(
            _argHash == mc.argHash,
            "same arguments must be passed"
        );

        if (mc.status == CallStatus.None) {

            mc.status = CallStatus.Open;
            mc.op = _op;
            mc.argHash = _argHash;

        } else {
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
     * SimplifiedLogic.migrate
     */
    function migrate(uint256 _callNumber, address _newLogic) public {

        setup(
            _callNumber, 
            Operation.Migrate,
            keccak256(abi.encodePacked(_newLogic))
        );

        addSig(_callNumber);

        if (thresholdMet(_callNumber)) {

            targetLogic.migrate(_newLogic);
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
     * Migrate the front to new logic.
     */
    function newLogic(uint256 _callNumber, DelegatedERC20 _newLogic) public {

        setup(
            _callNumber, 
            Operation.NewLogic,
            keccak256(abi.encodePacked(_newLogic))
        );

        addSig(_callNumber);

        if (thresholdMet(_callNumber)) {

            targetFront.migrate(_newLogic);
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
