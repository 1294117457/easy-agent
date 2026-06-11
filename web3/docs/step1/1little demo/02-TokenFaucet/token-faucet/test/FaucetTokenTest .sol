// // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test,console} from "forge-std/Test.sol";
import {FaucetToken} from "../src/FaucetToken.sol";

contract FaucetTokenTest is Test{
  FaucetToken public faucet;

  address public user1 = address(0x1);
  address public user2 = address(0x2);
  address public user3 = address(0x3);

  function setUp() public {
    faucet=new FaucetToken();
  }
//test ERC20's constructor
  function test_tokenMetadata() public {
    assertEq(faucet.name(),"Faucet Token");
    assertEq(faucet.symbol(),"FCT");
    assertEq(faucet.decimals(),18);
  }

  function test_totalSupply() public {
    uint256 expectedSupply = 1_000_000*10**18;
    assertEq(faucet.totalSupply(),expectedSupply);
  }
  function test_deployerHoldsAllSupply() public {
    assertEq(faucet.balanceOf(address(this)),faucet.totalSupply());
  }

}