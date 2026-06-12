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
    assertEq(faucet.balanceOf(address(faucet)),faucet.totalSupply());
  }

    function test_firstClaim() public {
      vm.prank(user1);  //只影响下一次调用
      faucet.claim();
      uint256 claimAmount = faucet.CLAIM_AMOUNT();
      assertEq(faucet.balanceOf(user1),claimAmount);
      assertTrue(faucet.claimed(user1));
    }
  function test_scondClaim_reverts() public {
    vm.startPrank(user1);
    faucet.claim();
    vm.expectRevert("Already claimed");
    faucet.claim();
    vm.stopPrank();
  }
  function test_claimAmountCorrect() public{
    vm.prank(user1);
    faucet.claim();

    uint256 expected = 100*10**18;
    assertEq(faucet.balanceOf(user1),expected);
  }
  function test_mutiClaim() public {
    vm.prank(user1);
    faucet.claim();
    vm.prank(user2);
    faucet.claim();
    vm.prank(user3);
    faucet.claim();
    
    uint256 expected = 100*10**18;
    assertEq(faucet.balanceOf(user1),expected);
    assertEq(faucet.balanceOf(user2),expected);
    assertEq(faucet.balanceOf(user3),expected);
    assertEq(faucet.claimedCount(),3);
  }
  /**
   * 这里的faucet只是个对象，
   * 这里的方法都是FaucetTokenTest通过faucet调用，调用者都是FaucetTokenTest，
   * 只有vm.prank使用时会修改调用者对吗
   * 然后这里修改为user1是为了将user1的额度授权给FaucetTokenTest
   */
  function test_tramsfer() public{
    vm.prank(user1);
    faucet.claim();
    vm.prank(user2);
    faucet.claim();

    vm.prank(user1);
    faucet.approve(address(this),50*10**18);
    faucet.transferFrom(user1,user2,50*10**18);

    assertEq(faucet.balanceOf(user1),50*10**18);
    assertEq(faucet.balanceOf(user2),150*10**18);
    assertEq(faucet.claimedCount(),2);
  }
}