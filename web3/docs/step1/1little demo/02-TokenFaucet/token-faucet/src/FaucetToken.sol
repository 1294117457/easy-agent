// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract FaucetToken is ERC20{
    uint256 public constant CLAIM_AMOUNT=100*10**18;
    uint256 public constant MAX_CLAIMS=1000;
    uint256 public claimedCount;
    mapping(address=>bool) public claimed;

    constructor() ERC20("Faucet Token","FCT"){
        _mint(address(this),1_000_000*10**decimals());
    }

    function claim() external {
        require(!claimed[msg.sender],"Already claimed");
        require(claimedCount < MAX_CLAIMS,"All tokens claimed");

        claimed[msg.sender]=true;
        claimedCount+=1;

        _transfer(address(this),msg.sender,CLAIM_AMOUNT);
    }

    function getBalance() external view returns (uint256){
        return balanceOf(msg.sender);
    }

}
