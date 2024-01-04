// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {PlaceVerifier} from "../src/PlaceVerifier.sol";


contract TestContract is Test {
    PlaceVerifier c;

    function setUp() public {
        c = new PlaceVerifier();
    }

    function testBar() public {
        assertEq(uint256(1), uint256(1), "ok");
    }

    function testFoo(uint256 x) public {
        vm.assume(x < type(uint128).max);
        assertEq(x + x, x * 2);
    }
}
