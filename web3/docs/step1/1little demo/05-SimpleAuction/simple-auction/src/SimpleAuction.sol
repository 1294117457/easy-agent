// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleAuction{
    address public beneficiary;         
    uint256 public auctionStartTime;
    uint256 public auctionEndTime;

    address public highestBidder;
    uint256 public highestBid;

    mapping(address=>uint256) public pendingReturns;

    enum AuctionState{
        PENDING,
        ACTIVE,
        ENDED,
        COMPLETED
    }

    event AuctionCreated(uint256 endTime);
    event HighestBidIncreased(address bidder,uint256 amount);
    event AuctionEnded(address winner,uint256 amount);
    event BidWithdraw(address bidder,uint256 amount);


    constructor(uint256 _biddingTime, address _beneficiary){
        require(_biddingTime>0,"Bidding time must be positive");
        beneficiary=_beneficiary;
        auctionStartTime=block.timestamp;
        auctionEndTime=block.timestamp+_biddingTime;
        highestBid=0;

        emit AuctionCreated(auctionEndTime);
    }
    
    function bid() external payable{
        require(block.timestamp>=auctionStartTime,"Auction not started");
        require(block.timestamp<auctionEndTime,"Auction already ended");
        require(msg.value>highestBid,"Bid must be higher than current highest");
        
        if(highestBidder!=address(0)){
            pendingReturns[highestBidder]+=highestBid;
        }

        highestBid=msg.value;
        highestBidder=msg.sender;

    }

    function endAuction() external{
        require(block.timestamp>=auctionEndTime,"Auction not yet ended");
        require(msg.sender==beneficiary,"Only beneficiary can end");

        uint256 amount = highestBid;
        highestBid = 0;

        if(amount>0){
            (bool success,)= beneficiary.call{value:amount}("");
            require(success,"Transfer to beneficiary failed");
            emit AuctionEnded(highestBidder, amount);
        }
    }

    function withdraw() external returns(bool){
        uint256 amount=pendingReturns[msg.sender];
        require(amount>0,"No funds to withdraw");

        pendingReturns[msg.sender]=0;
        (bool success,) = msg.sender.call{value:amount}("");

        require(success,"Withdraw failed");

        emit BidWithdraw(msg.sender,amount);
        return success;
    }
    
    function getPendingReturn(address bidder) external view returns(uint256){
        return pendingReturns[bidder];
    }

    function getAuctionState() external view returns (AuctionState){
        if(block.timestamp<auctionEndTime){
            return AuctionState.ACTIVE;
        } else if (highestBid>0){
            return AuctionState.ENDED;
        } else {
            return AuctionState.PENDING;
        }
    }

    function getContractBalance() external view returns(uint256){
        return address(this).balance;
    }
}