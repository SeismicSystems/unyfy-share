// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IFillVerifier {
    function verifyProof(
        uint256[2] memory _pA,
        uint256[2][2] memory _pB,
        uint256[2] memory _pC,
        uint256[22] memory _pubSignals
    ) external view returns (bool);
}
