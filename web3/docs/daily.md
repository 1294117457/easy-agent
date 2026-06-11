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

