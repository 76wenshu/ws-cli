# HandSome - 个人终端智能助手

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="version">
  <img src="https://img.shields.io/badge/Node.js-18%2B-green" alt="node">
  <img src="https://img.shields.io/badge/License-MIT-orange" alt="license">
</p>

## 介绍

HandSome 是你的**个人终端智能助手**，一个真正能记住你、与你一起成长的 AI 伙伴。

- 🤖 **智能对话** - 接通大模型，理解你的意图
- 🧠 **长期记忆** - 记住你的名字、偏好、习惯
- 🔌 **插件系统** - 扩展各种能力
- 💾 **本地部署** - 数据全在自己电脑上，隐私安全

---

## 能力一览

### 核心能力

| 能力 | 说明 |
|------|------|
| 智能对话 | 接通 MiniMax/OpenAI/硅基流动等大模型 |
| 长期记忆 | 分层存储，自动压缩，支持无限扩展 |
| 自进化 | 从对话中学习你的偏好，记录反馈，追踪成长 |
| 规则匹配 | 快速响应的内置命令 |
| 插件系统 | 可扩展的功能模块 |

### 内置插件

| 插件 | 触发词 | 功能 |
|------|--------|------|
| 🌐 web | 搜索、查一下 | 网页信息搜索 |
| 📝 notes | 记个笔记、记录 | 保存和查看笔记 |
| ✅ todo | 任务、待办 | 管理待办事项 |
| 🧮 calc | 计算、等于 | 数学计算 |
| ⚡ shell | 运行、执行 | 执行终端命令 |
| ⏰ time | 时间、日期 | 查看时间日期 |

### 命令列表

| 命令 | 功能 |
|------|------|
| `:q`, `quit`, `exit` | 退出程序 |
| `:who` | 查看你是谁 |
| `:memory`, `:记忆` | 查看记忆状态 |
| `:search <关键词>` | 搜索记忆 |
| `:forget` | 清除所有记忆 |
| `:plugins` | 查看已加载插件 |
| `:good`, `:好`, `:棒` | 好评反馈 |
| `:bad`, `:不好`, `:差` | 差评反馈 |
| `:evolve`, `:进化`, `:成长` | 查看进化历程 |

---

## 安装

```bash
# 1. 克隆项目
git clone <repo-url>
cd ws-cli

# 2. 安装依赖
npm install

# 3. 编译
npm run build

# 4. 链接命令
npm link
```

---

## 配置

配置文件位于 `~/.handsome-cli/config.yaml`

### 完整配置示例

```yaml
# 助手名称
name: HandSome

# API 配置
api:
  # 当前使用: openai / siliconflow / anthropic / custom
  provider: custom

  # 硅基流动 (备用)
  siliconflow:
    api_key: ${SILICONFLOW_API_KEY}
    base_url: "https://api.siliconflow.cn/v1"
    model: "Qwen/Qwen2.5-7B-Instruct"

  # OpenAI (备用)
  openai:
    api_key: ${OPENAI_API_KEY}
    base_url: "https://api.openai.com/v1"
    model: "gpt-4o"

# 模型参数
model:
  temperature: 0.7
  max_tokens: 500
  system_prompt: |
    你是 HandSome，一个专业、简洁的个人终端助手。
    你记得住用户告诉你的事情。
    回答要简洁，不要太啰嗦。
    用中文回复。

# 插件配置
plugins:
  enabled:
    - web
    - notes
    - todo
    - calc
    - shell
    - time
  custom: []
```

### 自定义插件

```yaml
plugins:
  custom:
    - name: 翻译助手
      trigger: 翻译
      enabled: true
      prompt: |
        你是一个翻译助手，把用户输入翻译成英文。
        只返回翻译结果，不要多余的话。
```

---

## 使用

```bash
# 启动助手
handsome
```

### 对话示例

```
HandSome > 你好
  [思考中...]
你好！我是 HandSome，很高兴见到你。你叫什么名字？

HandSome > 我叫张三
  [思考中...]
好的，我记住你了，张三！很高兴认识你。

HandSome > 今天天气不错
  [思考中...]
是的，天气很好！适合出去走走。你今天有什么安排吗？

HandSome > 记个笔记：今天很重要
  [思考中...]
已保存笔记: 今天很重要

HandSome > 添加任务：写代码
  [思考中...]
已添加任务 [1]: 写代码

HandSome > 现在几点
  [思考中...]
现在是 14:30:25

HandSome > :memory
短期记忆: 8 条
中期记忆: 0 个摘要
长期记忆: 0 个摘要
总对话数: 8
```

---

## 记忆系统架构

```
┌─────────────────────────────────────────┐
│           短期记忆 (Hot)                 │
│  - 最近 20 条对话                        │
│  - 完整存储                              │
├─────────────────────────────────────────┤
│           中期记忆 (Warm)                │
│  - 1000条后压缩的重要摘要                │
│  - 关键词索引                            │
├─────────────────────────────────────────┤
│           长期记忆 (Cold)                │
│  - 按月份分片存储                        │
│  - 可扩展到无限大                        │
└─────────────────────────────────────────┘
```

存储位置：`~/.handsome-cli/memory/`

---

## 自进化系统

HandSome 会随着使用不断成长，了解你的喜好，成为你的专属伙伴。

### 三大进化机制

| 机制 | 说明 | 示例 |
|------|------|------|
| 偏好学习 | 自动从对话中提取你的喜好 | "我喜欢简洁的回答" → 记住偏好 |
| 反馈学习 | 你可以手动给出好评/差评 | `:good` / `:bad` |
| 成长追踪 | 记录每次进化，查看成长历程 | `:evolve` |

### 偏好提取

HandSome 会自动识别以下模式的句子并学习：

```
我喜欢简洁的回答   → 记住"喜欢简洁"
我讨厌啰嗦         → 记住"讨厌啰嗦"
不要长篇大论       → 记住"避免长篇大论"
回答要专业         → 记住"喜欢专业"
```

### 对话示例

```
HandSome > 我喜欢简洁的回答
收到，以后尽量简洁。

HandSome > 这个回答太长了
明白了，我会记住这个反馈，下次更简洁一些。

HandSome > :good
谢谢你的认可！我会继续努力的 💪

HandSome > :evolve
📊 进化历程
🧬 成长值: 30
🧠 [2026/4/21] 新对话
🎯 [2026/4/21] 偏好学习
💬 [2026/4/21] 获得表扬
```

### 进化数据

所有进化数据存储在 `~/.handsome-cli/evolve/`

```
~/.handsome-cli/evolve/
├── preferences.json   # 用户偏好
├── feedback.json      # 用户反馈
└── history.json       # 进化历史
```

---

## 项目结构

```
ws-cli/
├── src/
│   ├── cli/           # CLI 交互层
│   ├── config/        # 配置系统
│   ├── core/          # 核心引擎
│   ├── evolve/        # 自进化系统
│   ├── llm/           # LLM 接口层
│   ├── memory/        # 记忆系统
│   └── plugins/       # 插件系统
│       └── built-in/  # 内置插件
├── bin/               # 入口文件
└── package.json
```

---

## License

MIT
