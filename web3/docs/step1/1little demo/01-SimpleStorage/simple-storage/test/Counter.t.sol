// // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test,console} from "forge-std/Test.sol";
import {SimpleStorage} from "../src/SimpleStorage.sol";

contract SimpleStorageTest is Test{
    SimpleStorage public simpleStorage;

    function setUp() public {
        simpleStorage = new SimpleStorage();
    }
    function test_initialValueIsZero() public {
        uint256 expectedValue = 0 ;
        assertEq(simpleStorage.get(),expectedValue);
    }
    function test_setPositiveNumber() public{
        simpleStorage.set(1);
        assertEq(simpleStorage.get(),1);
    }
    function test_setZero() public{
        simpleStorage.set(0);
        assertEq(simpleStorage.get(),0);
    }
    function test_setMaxUint256() public{
        simpleStorage.set(type(uint256).max);
        assertEq(simpleStorage.get(),type(uint256).max);
    }
    function test_overwrite() public {
        simpleStorage.set(10);
        simpleStorage.set(99);
        assertEq(simpleStorage.get(),99);
    }
}