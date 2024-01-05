// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.13;

import {IPlaceVerifier} from "./interfaces/IPlaceVerifier.sol";
import {ICancelVerifier} from "./interfaces/ICancelVerifier.sol";
import {IFillVerifier} from "./interfaces/IFillVerifier.sol";

contract UnyfyDev {

    IPlaceVerifier placeVerifier;
    ICancelVerifier cancelVerifier;
    IFillVerifier fillVerifier;

    address enclave;

    constructor(address _placeContractAddress, address _cancelContractAddress, address _fillContractAddress, address _enclave) {
        placeVerifier = IPlaceVerifier(_placeContractAddress);
        cancelVerifier = ICancelVerifier(_cancelContractAddress);
        fillVerifier = IFillVerifier(_fillContractAddress);
        enclave = _enclave;
       emit constructed(_placeContractAddress, _cancelContractAddress, _fillContractAddress, _enclave);
    }

    event orderPlaced(address indexed pubaddr, uint256 indexed orderhash);

    event orderCancelled(address indexed pubaddr, uint256 indexed orderhash);

    event orderDelete(uint256 indexed orderhash);

    event orderFilled(address indexed pubaddr, uint256 indexed orderhash, uint256[] indexed filledorderhashes);

    event constructed(address indexed placeVerifier, address indexed cancelVerifier, address indexed fillVerifier, address enclave);


    function verifyMessage(
        address _signer,
        string memory _message,
        bytes memory _signature
    ) public pure returns (bool) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n", uint2str(bytes(_message).length), _message)
        );
        return recoverSigner(ethSignedMessageHash, _signature) == _signer;
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature)
        public
        pure
        returns (address)
    {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        public
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        return (r, s, v);
    }

    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

     function place(
        string memory _message,
        bytes memory _signature,
        uint256[2] memory _pA,
        uint256[2][2] memory _pB,
        uint256[2] memory _pC,
        uint256[2] memory _pubSignals
    ) external{

    require(verifyMessage(enclave, _message, _signature), "Invalid signature");

        if(placeVerifier.verifyProof(_pA, _pB, _pC, _pubSignals)){
            emit orderPlaced(msg.sender, _pubSignals[1]);
        }
        
    }

    function cancel(
        uint256[2] memory _pA,
        uint256[2][2] memory _pB,
        uint256[2] memory _pC,
        uint256[2] memory _pubSignals
    ) external{

        if(cancelVerifier.verifyProof(_pA, _pB, _pC, _pubSignals)){
            emit orderCancelled(msg.sender, _pubSignals[1]);
        }
        

    }

    function fill(
        uint256[2] memory _pA,
        uint256[2][2] memory _pB,
        uint256[2] memory _pC,
        uint256[22] memory _pubSignals
    ) external{

        if(fillVerifier.verifyProof(_pA, _pB, _pC, _pubSignals)){

            uint256[] memory filledorderhashes = new uint256[](10);
            
            deleteOrderFromTree(_pubSignals[11]);

            for (uint i=12;i<22;i++){
                filledorderhashes[i-12]=_pubSignals[i];
                deleteOrderFromTree(_pubSignals[i]);
            }

            emit orderFilled(msg.sender, _pubSignals[11], filledorderhashes);
        }
        
    }

    function deleteOrderFromTree(uint256 _orderhash) public {
        if(_orderhash == 0){
            return;
        }
            emit orderDelete(_orderhash);
}

}
