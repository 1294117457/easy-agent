// // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleStorage{
    uint256 private storedData;

    function set(uint256 x)public{
        storedData=x;
    }

    function get() public view returns (uint256){
        return storedData;
    }

}