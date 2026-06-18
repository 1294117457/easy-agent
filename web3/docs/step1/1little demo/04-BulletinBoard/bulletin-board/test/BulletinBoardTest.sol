// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test,console} from "forge-std/Test.sol";
import {BulletinBoard} from "../src/BulletinBoard.sol";

contract BulletinBoardTest is Test{
    BulletinBoard public board;
    address user1=makeAddr("user1");
    address user2=makeAddr("user2");
    address user3=makeAddr("user3");
    function setUp() public {
        board=new BulletinBoard();
    }

    function test_postMessage() public{
        vm.prank(user1);
        board.post("Hello, Blockchain!");
        uint256 count=board.getMessageCount();
        assertEq(count,1);

        (address author,string memory content,uint256 timestamp)=board.getMessage(0);

        assertEq(author,address(user1));
        assertEq(content,"Hello, Blockchain!");
        assertEq(timestamp,1);
    }
    
    function test_postEmpty() public{
        vm.prank(user1);
        vm.expectRevert("Content cannot be empty");
        board.post("");
    }

    function test_TooLong() public {
        vm.prank(user1);
        string memory longContent=new string(1001);//create a 1001 bytes string
        vm.expectRevert("Content too long");
        board.post(longContent);
    }

    function test_multipleUsersPost() public {
        vm.prank(user1);
        board.post("Message from user1");
        vm.prank(user2);
        board.post("Message from user2");
        vm.prank(user3);
        board.post("Message from user3");

        assertEq(board.getMessageCount(),3);
    }

    function test_getMessages_page1() public {
        for(uint256 i=0;i<15;i++){
            vm.prank(user1);
            board.post(string.concat("Message ",vm.toString(i)));
            // solidity's Design philosophy:string\uint type processing in frontend,no in contract,saving gas
        }

        BulletinBoard.Message[] memory page1=board.getMessages(1,10);
        assertEq(page1.length,10);
        assertEq(page1[0].author,user1);
        assertEq(page1[0].content,"Message 0");

        BulletinBoard.Message[] memory page2=board.getMessages(2,10);
        assertEq(page2.length,5);

        BulletinBoard.Message[] memory page3=board.getMessages(3,10);
        assertEq(page3.length,0);
    }

    function test_getMessages_invalidPageSize() public{
        vm.prank(user1);
        board.post("test");

        vm.expectRevert("Invalid page size");
        board.getMessages(1,0);
        vm.expectRevert("Invalid page size");
        board.getMessages(1,101);

        vm.expectRevert("Page must be greater than 0");
        board.getMessages(0,10);
    }

    function test_Foundry() public{
        vm.expectRevert("Message not found");
        board.getMessage(0);

        for(uint256 i=0;i<50;i++){
            vm.prank(user1);
            board.post(string.concat("Msg ",vm.toString(i)));
        }

        assertEq(board.getMessageCount(),50);
    }

    
}