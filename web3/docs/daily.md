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

address(this).balance/balanceOf(address(this))

```
ERC20，
	里面是有一个_balances记录了token，
	核心在_update的时候修改，然后_mint,_burn,_transfer都是基于这个

balanceOf在此基础上读取_balances的值
```

Ownable

```
核心围绕address private _owner
	_transferOwnership,将_owner更换成新值
		constructor,renounceOwnership,transferOwnership都是基于_transferOnwership
	owner()，就是返回_owner
		_checkOwner就是基于owner()是否等于msg.sender
```

ReentrancyGuard

```
基于 _status,实现
	进入前检查
	进入后标记
	退出后恢复
```

```
额外
	1 ether等于10**18wei

转账
	(bool success,)=recipient.call{value:1 ether}("");
	//调用对方合约方法
	(bool success,bytes memory data)=recipient.call{value:1 ether}("foo(uint256)",123);
```

```
EOA
	Externally Owned Account，
	外部账户，没有代码，不能执行逻辑，不响应call，
	被动接收ETH
CA
	Contract Account
	合约账户，有代码，有函数，有状态
账户通用属性
	nonce
	balance
	codeHash
	storageRoot
receive()
	Contract需要接收ETH时必须声明receive，
	比如receive payable external()
```

```
payable
自定义方法
	deposit方法声明了payable，
	比如function deposit ()external payable{}
	然后调用这个方法就是需要转入eth，
	调用contract.deposit{value:1 ether}
call/receive
	1.call{value: 1 ether}(""),调用receive()，不能携带参数
	2.call{value: 1 ether}(abi.encodeWithSignature("foo()")),调用foo()
	3.contract.deposit{value: 1 ether}(),调用deposit
```

```
部署
forge create --broadcast  
--rpc-url $SEPOLIA_RPC_URL              
--private-key $PRIVATE_KEY              src/VendingMachineToken.sol:VendingMachineToken              
--constructor-args $DEPLOYER_ADDRESS

Deployer: 0x22082139749383146C76cFDBf4F54291cE023cd1
Deployed to: 0x23d18a812439aBfF47553325915e32C1E082a622
Transaction hash: 0x9ac5f277b1a403f6b6200f398797e593a17b28bcfb47ed52a5d9efe4f3170701 

调用
cast send <CONTRACT_ADDRESS> "mintToContract(uint256)" 100000 \
    --private-key $PRIVATE_KEY --rpc-url $SEPOLIA_RPC_URL
```



#### DOS攻击

```
ReentrancyGuard，CEI，Pull
```

```
也就是说，
	push，pull实际对balance，pending，合约总ETH的影响效果是一样的，

区别在于
	push只有一个withdraw操作，攻击者给出大量高价gas的withdraw，导致其他人的withdraw卡住

	pull则requestWithdraw不是转账操作，先记录用户已经操作了，
	后续用户在合适的时候pull就好，
	等于用户的买入卖出操作不被攻击者影响，只是用户实际提取ETH的操作额在合适时间进行就好了
```

```
// 这就是你理解的“买入卖出操作不被影响”
function requestWithdraw(uint amount) external {
    // 1. 即使现在网络拥堵，这一步也绝对安全，因为没有任何外部调用
    balances[msg.sender] -= amount;
    pendingWithdrawals[msg.sender] += amount;
}

// 这就是你理解的“用户合适的时候pull就好”
function claimWithdraw() external {
    uint amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    // 2. 哪怕现在Gas费贵，或者攻击者捣乱，最坏的结果就是“这次领钱失败”
    //    用户的资产依然安全地记录在 pending 里，下次再试就行
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}
```

##### step1-demo4

```
string/bytes/bytes1...32
	知道明确长度的二进制值 → bytes1 到 bytes32
	不知道明确长度的二进制数据 → bytes
	文本数据 → string
	
┌─────────────────────────────┐
│   需要存储什么数据？          │
└─────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ 是文本吗？     │
    └───────────────┘
       │        │
      YES       NO
       │        │
       ▼        ▼
   string    ┌───────────────┐
             │ 长度固定吗？   │
             └───────────────┘
                │        │
               YES       NO
                │        │
                ▼        ▼
            bytesN     bytes
```

```
存储空间
	calldata/memory，stack，storage
	public ,external,private,internal

1.状态变量都存储在 storage 中
2.基本类型无论入参还是局部变量都是 stack
3.方法的入参
	external	calldata 或 memory
    public		memory 或 calldata
    internal / private	memory、storage、calldata
不能用的组合：
	external/public 的入参不能用 storage，因为外部调用者没法直接传一个 storage 引用。
返回值交给调用者，不能是storage或calldata
```

```
design philosophy of solodity 
	type transfer no in solidity,in frontend
            
    board.post(string.concat("Msg ",vm.toString(i)));
```

