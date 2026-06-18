// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test,console} from "forge-std/Test.sol";
import {SimpleAuction} from "../src/SimpleAuction.sol";

contract SimpleAuctionTest is Test{
    SimpleAuction public auction;
    address public beneficiary = makeAddr("beneficiary");
    address public bidder1 = makeAddr("bidder1");
    address public bidder2 = makeAddr("bidder2");
    address public bidder3 = makeAddr("bidder3");

    uint256 constant BIDDING_TIME=1 hours;

    function setUp() public{
        auction=new SimpleAuction(BIDDING_TIME,beneficiary);
    }

    function test_init() public{
        assertEq(auction.beneficiary(),beneficiary);
        assertEq(auction.highestBidder(),address(0));
        assertEq(auction.highestBid(),0);
        assertEq(uint256(auction.getAuctionState()),uint256(SimpleAuction.AuctionState.ACTIVE));
    }

    function test_Bid() public{
        vm.deal(bidder1,10 ether);
        vm.deal(bidder2,10 ether);

        //test bid
        vm.prank(bidder1);
        auction.bid{value:1 ether}();
        assertEq(auction.highestBidder(),bidder1);
        assertEq(auction.highestBid(),1 ether);
        //test higher bid
        vm.prank(bidder2);
        auction.bid{value:2 ether}();
        assertEq(auction.highestBidder(),bidder2);
        assertEq(auction.highestBid(),2 ether);
        assertEq(auction.getPendingReturn(bidder1), 1 ether);
        //test lower bid        
        vm.prank(bidder1);
        vm.expectRevert("Bid must be higher than current highest");
        auction.bid{value:1 ether}();
        //test equal bid
        vm.prank(bidder1);
        vm.expectRevert("Bid must be higher than current highest");
        auction.bid{value:2 ether}();
    }

    function test_withdraw() public{
        vm.deal(bidder1,10 ether);
        vm.deal(bidder2,10 ether);

        uint256 initialBalance = bidder1.balance;

        vm.prank(bidder1);
        auction.bid{value: 1 ether}();

        vm.prank(bidder2);
        auction.bid{value: 2 ether}();

        vm.prank(bidder1);
        auction.withdraw();

        assertEq(bidder1.balance, initialBalance);
        assertEq(auction.getPendingReturn(bidder1), 0);
    }

    function test_timeout() public{
        vm.deal(bidder1,10 ether);
        vm.prank(bidder1);
        auction.bid{value:5 ether}();

        vm.warp(auction.auctionEndTime()+1);
        vm.prank(bidder1);
        vm.expectRevert("Auction already ended");
        auction.bid{value:1 ether}();

        vm.prank(beneficiary);
        auction.endAuction();
        assertEq(beneficiary.balance, 5 ether);
    }

    
}