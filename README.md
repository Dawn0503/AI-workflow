This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## AI Workflow (FlowGram.AI-inspired)

参考 FlowGram.AI 的“插件化流程引擎”理念（参考官网 `https://flowgram.ai/`），本项目提供了最小可用的 AI 工作流能力：

- 模型：`Workflow / WorkflowNode / WorkflowEdge / Run / Step`（见 `prisma/schema.prisma`）
- 执行：拓扑排序（DAG）、节点操作器（含 `openai.chat`）、上下文聚合（见 `src/lib/engine.ts`）
- 接口：
  - `GET/POST /api/workflows`
  - `GET/PUT/DELETE /api/workflows/[id]`
  - `POST /api/workflows/[id]/run`

### 节点类型
- `input`：初始化上下文为 `POST /run` 的 `input`
- `openai.chat`：调用 OpenAI Chat Completions
  - config 示例：
    ```json
    {
      "model": "gpt-4o-mini",
      "system": "You are a helpful assistant",
      "promptTemplate": "Summarize: {{text}}",
      "outputKey": "summary"
    }
    ```

### 快速开始
1. 设置环境变量：在 `.env` 增加 `OPENAI_API_KEY=sk-...`
2. 数据库迁移：
   ```bash
   npx prisma migrate dev --name workflow_init
   npx prisma generate
   ```
3. 启动：
   ```bash
   npm run dev
   ```
4. 创建工作流（示例请求体）
   ```json
   {
     "name": "Summarizer",
     "description": "Summarize input text via OpenAI",
     "nodes": [
       { "type": "input", "label": "Input" },
       {
         "type": "openai.chat",
         "label": "Summarize",
         "config": {
           "model": "gpt-4o-mini",
           "system": "You are a helpful assistant",
           "promptTemplate": "Summarize: {{text}}",
           "outputKey": "summary"
         }
       }
     ],
     "edges": [
       { "sourceNodeId": "<id of input node>", "targetNodeId": "<id of summarize node>" }
     ]
   }
   ```
   提示：也可以先创建后再 `PUT` 根据返回的 node id 追加连线。

5. 运行：
   ```json
   POST /api/workflows/{id}/run
   { "input": { "text": "your text here" } }
   ```

### 亮点与后续想法
- 模块化节点定义，可扩展更多节点（HTTP 请求、条件分支、变量映射、多路并行）
- 上下文插值支持 `{{path.to.value}}`
- 可视化日志：`Run/Step` 记录输入输出，后续在前端页面以时间线/图方式展示
- 模板库：常见 AI 场景模板化

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
