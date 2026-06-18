// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BulletinBoard{
    struct Message{
        address author;
        string content;
        uint256 timestamp;
    }

    Message[] public messages;
    //event，watching outside the chain
    event Posted(uint256 indexed messageId,address indexed author,string content);
    //post message
    function post(string calldata content) external{
        require(bytes(content).length>0,"Content cannot be empty");
        require(bytes(content).length<=1000,"Content too long");

        messages.push(Message({
            author:msg.sender,
            content:content,
            timestamp:block.timestamp
        }));

        emit Posted(messages.length-1,msg.sender,content);
    }

    // pagenation get messages
    function getMessages(uint256 page,uint256 pageSize) external view returns (Message[] memory){
        require(page>0,"Page must be greater than 0");
        require(pageSize>0&&pageSize<=100,"Invalid page size");

        uint256 totalMessages=messages.length;
        uint256 startIndex=(page-1)*pageSize;
        //Boundary check
        if(startIndex>=totalMessages){
            return new Message[](0);
        }
        //Calculate actual return size
        uint256 endIndex=startIndex+pageSize;
        if(endIndex>totalMessages){
            endIndex=totalMessages;
        }

        //Allocate memory array(only in memory,not in storage)
        uint256 returnSize = endIndex-startIndex;
        Message[] memory result=new Message[](returnSize);
        for(uint256 i=0;i<returnSize;i++){
            result[i]=messages[startIndex+i];
        }

        return result;
    }

    //get total messages count
    function getMessageCount() external view returns(uint256){
        return messages.length;
    }

    function getMessage(uint256 messageId) external view returns(address,string memory,uint256){
        require(messageId<messages.length,"Message not found");
        Message memory m=messages[messageId];

        return (m.author,m.content,m.timestamp);
    }
}