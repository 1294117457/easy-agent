// // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract VendingMachineToken is ERC20 ,Ownable{
  receive() external payable{}

  uint256 public constant RATE = 1000;
  constructor(address initialOwner) Ownable(initialOwner) ERC20("VendingToken","VTK"){}
/**
 * _mint,_transfer,_burn基于ERC20的方法
 * 然后实现铸造Token，存ETH获取token,销毁token获取ETH
 * owner提取ETH，提取Token
 */
  function mintToContract(uint256 amount) external onlyOwner{
    _mint(address(this),amount*10**decimals());
  }

  function depositETH() external payable{
    require(msg.value>0,"Must send ETH");
    uint256 tokenAmount = msg.value*RATE;
    require(
      balanceOf(address(this))>=tokenAmount,
      "Contract does not have enough tokens"
    );
    _transfer(address(this),msg.sender,tokenAmount);
  }
  
  function withdrawETH(uint256 tokenAmount) external{
    require(tokenAmount>0,"Must withdraw positive amount");
     uint256 ethAmount=tokenAmount/RATE;
     require(ethAmount>0,"Token amount too small");
     require(
      address(this).balance>=ethAmount,
      "Contract does not have enough ETH"
     );

     _burn(msg.sender,tokenAmount);
     (bool success,)=msg.sender.call{value:ethAmount}("");
     require(success,"ETH transfer failed");
  }

  function withdrawETHByOwner(uint256 amount) external onlyOwner{
    require(amount<=address(this).balance,"Insufficient balance");
    (bool success,)= owner().call{value:amount}("");
    require(success,"ETH transfer failed");
  }
  function withdrawTokensByOwner(uint256 amount) external onlyOwner{
    _transfer(address(this),owner(),amount);
  }

}