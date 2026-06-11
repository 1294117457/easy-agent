// // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test,console} from "forge-std/Test.sol";
import {FaucetToken} from "../src/FaucetToken.sol";

contract ClaimTest is Test {
    FaucetToken public faucet;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    function setUp() public {
      faucet=new FaucetToken();
    }

    function test_firstClaim() public {
      vm.prank(user1);
      faucet.claim();
      uint256 claimAmount = faucet.CLAIM_AMOUNT();
      assertEq(faucet.balanceOf(user1),claimAmount);
      assertTrue(faucet.claimed(user1));
    }
}