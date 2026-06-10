# 02 - Cast 学习指南

## 什么是 Cast

**Cast** 是 Foundry 工具链中的命令行工具，用于链上交互和数据查询。可以理解为 Ethereum 的"瑞士军刀"——查余额、调用合约、发送交易、解码事件、验证合约，统统搞定。

不需要打开 Etherscan，不用写 JavaScript/Python 脚本，一个终端命令全部搞定。

---

## 理念：Cast 让你站在链上思考

```
不用 Cast：
  打开 Etherscan → 粘贴合约地址 → 点击 "Read Contract" → 一个一个查

用 Cast：
  cast call <addr> <func> <args>... → 一个命令搞定所有
```

Cast 的核心价值：
- **快速调试**：部署合约后立即验证行为
- **数据查询**：不写代码就能读链上任何数据
- **自动化脚本**：配合 Shell 脚本做批量操作
- **调试交易**：手动模拟和回放交易

---

## 基础命令

### cast — 查看版本和帮助

```bash
cast --version
cast --help
cast call --help    # 查看具体子命令帮助
```

### cast balance — 查余额

```bash
# 查 ETH 余额
cast balance <address>

# 查余额（以 ether 为单位）
cast balance <address> --ether

# 查多个地址
cast balance 0x... 0x... 0x...
```

### cast chain-id / cast block-number

```bash
# 查看当前链 ID
cast chain-id

# 查看当前区块高度
cast block-number

# 查看最新区块信息
cast block latest
```

---

## 合约交互

### cast call — 读合约（不签名）

```bash
# 调用 ERC20 的 name()
cast call <token-address> "name()" --rpc-url $ETH_RPC_URL

# 调用 balanceOf
cast call <token-address> "balanceOf(address)" <owner-address>

# 调用 balanceOf，结果转成 ether 单位
cast call <token-address> "balanceOf(address)(uint256)" <owner-address> --from <owner-address>
```

### cast send — 发送交易（签名）

```bash
# 发送 ETH
cast send <to-address> --value 0.1ether --private-key $PK --rpc-url $ETH_RPC_URL

# 调用合约函数（如 transfer）
cast send <token-address> \
  "transfer(address,uint256)" \
  <recipient> <amount> \
  --private-key $PK \
  --rpc-url $ETH_RPC_URL
```

### cast estimate — 估算 Gas

```bash
cast estimate <to-address> "transfer(address,uint256)" <recipient> <amount> \
  --value 0 \
  --from <sender> \
  --rpc-url $ETH_RPC_URL
```

### cast gas-price / cast gas-cap

```bash
# 当前 gas price
cast gas-price --rpc-url $ETH_RPC_URL

# 查看 EIP-1559 费用
cast fee-history 1 latest --rpc-url $ETH_RPC_URL
```

---

## 数据转换与编码

### cast abi-encode / cast abi-decode

```bash
# 编码函数调用数据（用于手动构造交易 data）
cast abi-encode "transfer(address,uint256)" <recipient> <amount>

# 解码返回值
cast abi-decode "function name()(string)" <encoded-data>

# 解码事件日志
cast abi-decode "event Transfer(address,address,uint256)" <hex-data>
```

### cast sig — 获取函数签名

```bash
cast sig "transfer(address,uint256)"
# 输出: 0xa9059cbb

cast sig "balanceOf(address)"
# 输出: 0x70a08231
```

### cast 4byte — 从 4byte 数据库查询函数名

```bash
cast 4byte 0xa9059cbb
# 输出: transfer(address,uint256)
```

### cast keccak — 哈希计算

```bash
cast keccak "hello"
cast keccak "$(cast parse-bytes32-string 0x... )"
```

### cast to-... — 类型转换

```bash
cast to-uint256 100
cast to-address 0x...
cast to-bytes32 "hello"
cast to-hexdata "0x1234"
cast to-string 0x...
```

---

## 事件与日志

### cast logs — 查询历史事件

```bash
# 查询 Transfer 事件（用函数选择子过滤）
cast logs --from-block 0 --to-block latest \
  --address <token-address> \
  --topic0 "$(cast sig 'Transfer(address,address,uint256)')"

# 查询特定地址的事件
cast logs --address <pair-address> \
  --topic0 "$(cast sig 'Swap(address,uint256,uint256,uint256,uint256,address)')"
```

### cast receipt — 查看交易回执

```bash
cast receipt <tx-hash>
```

### cast call --trace — 追踪执行

```bash
cast call <contract> "getAmountOut(uint256,uint256)" <amount> <reserve> --trace
```

---

## 合约验证

### cast verify-contract — 验证合约源码

```bash
cast verify-contract \
  <contract-address> \
  <source-name>:<contract-name> \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --optimizer \
  --constructor-args <encoded-constructor-args> \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### cast interface — 从已验证合约生成接口

```bash
# 从 Etherscan 获取并生成 Solidity 接口
cast interface <verified-contract-address> -- etherscan <etherscan-api-key>
```

---

## 实用脚本场景

### 查询某池子的 TVL（Uniswap V2）

```bash
# 获取池子储备量
RESERVE0=$(cast call <pair-address> "getReserves()(uint256,uint256,uint32)" | cast to-decimal --shift-by 0 | awk '{print $1}')
RESERVE1=$(cast call <pair-address> "getReserves()(uint256,uint256,uint32)" | awk '{print $1}')

# 计算 TVL（需要代币价格，这里假设已知）
echo "Reserve0: $RESERVE0, Reserve1: $RESERVE1"
```

### 批量查多个地址的 ERC20 余额

```bash
for addr in 0x... 0x... 0x...; do
  balance=$(cast call <token-addr> "balanceOf(address)(uint256)" $addr)
  echo "$addr: $(cast to-decimal $balance 18)"
done
```

### 手动模拟闪电贷

```bash
# 用 cast call 模拟调用（不会真正发送交易）
cast call <flashloan-contract> \
  "flash(address,uint256,bytes)" \
  <token> <amount> <data> \
  --from <borrower> \
  --rpc-url $ETH_RPC_URL
```

---

## 环境变量配置

```bash
# .env 文件
export ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
export PRIVATE_KEY=0x...
export ETHERSCAN_API_KEY=YOUR_API_KEY
```

在项目根目录放 `.env`，用 `source .env` 加载。

---

## 常用 RPC 节点

| 网络 | RPC URL |
|---|---|
| Ethereum Mainnet | Alchemy / Infura / Cloudflare Ethereum Gateway |
| Sepolia (测试网) | 同上，通常有免费额度 |
| Base | https://mainnet.base.org |
| Arbitrum | https://arb1.arbitrum.io/rpc |

---

## 学到什么程度算过关

| 任务 | 说明 |
|---|---|
| 用 Cast 查询任意 ERC20 代币余额 | 不打开 Etherscan |
| 用 Cast 调用 Uniswap V2 的 getAmountsOut | 计算交易滑点 |
| 用 Cast 手动发送一笔 ETH 转账交易 | 验证签名流程 |
| 用 Cast 解析一个合约的事件日志 | 理解 topic0 过滤 |
| 用 Cast 从 Etherscan 拉取已验证合约的 ABI | 生成接口文件 |
| 用 Shell 脚本批量查询多个地址的余额 | 提升效率 |

---

## Cast vs Etherscan

| 场景 | 推荐工具 |
|---|---|
| 快速查余额、简单调用 | Cast ✅ |
| 合约有 50+ 函数，需要逐个测试 | Etherscan Read |
| 需要生成接口、验证合约 | Cast |
| 调试复杂交易（多步调用） | cast call --trace 或 Tenderly |
| 查历史事件、分析数据 | Cast + 链上数据平台（ Dune / Nansen ） |
