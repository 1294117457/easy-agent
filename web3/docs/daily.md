##### 1.init

```
  git bash中
    # 1. 下载并运行安装脚本
    curl -L https://foundry.paradigm.xyz | bash

    # 2. 安装完成后，重新加载你的环境配置
    source ~/.bashrc
    
    # 3. 运行 foundryup 来安装 forge, cast, anvil 等工具
    foundryup

  which forge
    配置环境变量
    C:\Users\你的用户名\.foundry\bin


```

##### 2.step1-demo1

```
实现一个contract，简单的方法、部署、forge test、cast交互
```



```
简单熟悉spdx，pragma，contrat，uint256，assertEq
配置SEPOLIA_RPC_URL、PRIVATE_KEY

部署
	forge create --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY src/SimpleStorage.sol:SimpleStorage --broadcast
	不加--broadcast用于检查、预测gas
	
部署后
	No files changed, compilation skipped
    Deployer: 0x22082139749383146C76cFDBf4F54291cE023cd1
    Deployed to: 0x8b6584c3e7A0E0a629262FbD470F3db91ac2da6F
    Transaction hash: 0xb6a40f33f0d37d30ee0a7bf71d9ee1f8a1a5c75b533789230597c9c731b13113
    
cast的使用
	cast call <CONTRACT_ADDRESS> "get()" --rpc-url $SEPOLIA_RPC_URL
	cast send <CONTRACT_ADDRESS> "set(uint256)" 100 \
    	--private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
    cast receipt <TX_HASH>
```





```
contract

public private internal external 

view pure payable

int uint address bool btye byes string uint256[] mapping structenum 

```

##### 3.step1-demo2

```
openzeppelin ERC20 interface
	name(),symbol(),decimals()
	totalSupply,balanceOf(address account),allowance(address owner,addreee spender)
	trabsfer(address to,address from),transferFrom(address from,address to,uint256 value),approve(address onwer,uint256 value)
	
	_mint(address account,uint256),_burn(address account, uint256),_transfer(address from,address to,uint256 value),_update(address from,address uint256 value),_approve(address owner,address spender,uint256 value),_spendAllowance(address owner,address spender,uint256 value)
```

```
内部核心
	_update--:_mint,_burn,_transfer
```

```
元交易

用户 address（名义上的操作者）
中继器 address（实际的 Gas 支付者）
中继器合约（验证签名的中间层）
目标合约（最终业务逻辑）

	用户钱包 → 链下签名（免费）→ 中继器收集签名
         ↓
	中继器钱包 → 调用中继器合约（支付 Gas）→ 验证签名 → 调用目标合约
```

```
总的
	ERC20继承了IERC20和IERC20Metadata的接口，实现相关的公共方法,
	然后ERC20内部还额外实现了_update等内部核心方法；
	另外Context实现签名的功能，
	IERC20Errors定义错误类型
```

```
额外概念
	event和emit、unchecked，revert就是solidity的底层方法，	
	不需要额外引入什么包
	然后revert就是直接抛出一个日志记录
	event就是定义一个事件，emit就是在合适的位置发送这个事件

FaucetTokenTest中
	faucet只是个对象，对应的faucet.approve方法的调用者都是FaucetTokenTest	
	除了vm.prank修改调用者为user1将自身额度授权给FaucetTokenTest
		vm.prank(user1);
		faucet.approve(address(this),50*10**18);
```

##### 4.step1-demo3

```
ERC20，
	里面是有一个_balances记录了token，
	核心在_update的时候修改，然后_mint,_burn,_transfer都是基于这个

balanceOf在此基础上读取_balances的值
```

