// // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test,console} from "forge-std/Test.sol";
import {VendingMachineToken} from "../src/VendingMachineToken.sol";

contract VendingMachineTokenTest is Test{
  VendingMachineToken public vmToken;
  address public owner;
  address public user1;
  address public user2;
receive() external payable {}
  function setUp() public {
    owner=address(this);
    user1=makeAddr("user1");
    user2=makeAddr("user2");
    vmToken=new VendingMachineToken(owner);
    // vmToken.mintToContract(1_000_000);
  }
/**
 * depositTEH,并校验
 */
  //铸币给合约，对比合约totalSupply
  function test_mintToContract() public {
    uint256 amount=1000;
    vmToken.mintToContract(amount);
    assertEq(vmToken.totalSupply(),amount*10**18);
  }

  function test_depositETH_getTokens() public{
    vmToken.mintToContract(1_000_000);
    uint256 ethAmount = 1 ether;
    vm.deal(user1,10 ether);
    
    
    uint256 tokenBefore=vmToken.balanceOf(user1);
    vm.prank(user1);
    vmToken.depositETH{value:ethAmount}();
    uint256 tokenAfter=vmToken.balanceOf(user1);

    uint256 expectedTokens = ethAmount* vmToken.RATE();
    assertEq(tokenAfter-tokenBefore,expectedTokens);
  }

  function test_depositETH_revertsIfZero() public{
    vm.prank(user1);
    vm.expectRevert("Must send ETH");
    vmToken.depositETH{value:0}();
  }
  function test_depositETH_revertsIfNoTokens() public {
    vm.deal(user1,10 ether);
    vm.prank(user1);
    vm.expectRevert("Contract does not have enough tokens");
    vmToken.depositETH{value:1 ether}();
  }

//=============withdrawETH

  function test_withdrawETH_getETH() public {
    vmToken.mintToContract(1_000_000);
    vm.deal(user1,10 ether);
    //depositETH    
    vm.prank(user1);
    vmToken.depositETH{value:1 ether}();
    uint256 tokenBalance=vmToken.balanceOf(user1);
    //withdrawETH
    uint256 beforeBalance=user1.balance;
    vm.prank(user1);
    vmToken.withdrawETH(tokenBalance);
    uint256 afterBalance=user1.balance;

    assertEq(vmToken.balanceOf(user1),0);
  }

  function test_withdrawETH_revertsIfZero() public {
    vm.prank(user1);
    vm.expectRevert("Must withdraw positive amount");
    vmToken.withdrawETH(0);  
  }

  function test_withdrawETH_revertsIfInsufficientETH() public{
      VendingMachineToken newVm = new VendingMachineToken(owner);
      newVm.mintToContract(1000);
      vm.deal(user1, 100 ether);
      vm.prank(user1);
      newVm.depositETH{value: 1 ether}();
      // owner 把全部 ETH 提走
      vm.prank(owner);
      newVm.withdrawETHByOwner(1 ether);
      // 合约 ETH 余额为 0，user1 提取会 revert
      vm.prank(user1);
      vm.expectRevert("Contract does not have enough ETH");
      newVm.withdrawETH(1000);
  }
  
  //边界测试
  function test_mutipleDeposits() public {
    vmToken.mintToContract(1_000_000);

    vm.deal(user1,10 ether);
    vm.prank(user1);
    vmToken.depositETH{value:0.45 ether}();
    vm.prank(user1);
    vmToken.depositETH{value:0.55 ether}();

    uint256 expected = 1000*10**18;//1ETH*RATE
    assertEq(vmToken.balanceOf(user1),expected);
  }

  function test_receivingETHDirectly() public {
    vm.deal(user1,10 ether);
    vmToken.mintToContract(1_000_000);
    vm.prank(user1);
    (bool success,)=address(vmToken).call{value: 1 ether}("");
    require(success);
    
    assertEq(vmToken.balanceOf(user1),0);
    assertEq(address(vmToken).balance,1 ether);
  }
}