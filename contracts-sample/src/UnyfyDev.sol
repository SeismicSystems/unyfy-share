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
    
    /*
     * Takes in the contract addresses of the verifier contracts and the enclave address and sets them.
     */
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

    /*
     * Verifies the received signature with the
     * enclave's public address.
     */
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

    /*
     * Helper function to split recover the signer from the signature.
     */
    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature)
        public
        pure
        returns (address)
    {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    /*
     * Helper function to split the signature into r, s and v variables.
     */
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

    /*
     * Helper function to convert uint to string.
     * Taken from:
     * https://stackoverflow.com/questions/47129173/how-to-convert-uint-to-string-in-solidity
     */
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

    /*
     * Verifies the place proof and emits the orderPlaced event if valid.
     */
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

    /*
     * Verifies the cancel proof and emits the orderCancelled event if valid.
     */
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

    /*
     * Verifies the fill proof and emits the orderFilled event if valid.
     */
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

    /*
     * Emits function to delete order from the bid/ask tree in the matching engine.
     */
    function deleteOrderFromTree(uint256 _orderhash) public {
        if(_orderhash == 0){
            return;
        }
            emit orderDelete(_orderhash);
}

}
