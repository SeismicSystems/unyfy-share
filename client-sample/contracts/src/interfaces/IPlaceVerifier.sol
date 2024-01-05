// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IPlaceVerifier {
    function verifyProof(
        uint256[2] memory _pA,
        uint256[2][2] memory _pB,
        uint256[2] memory _pC,
        uint256[2] memory _pubSignals
    ) external view returns (bool);
}
