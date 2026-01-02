# 📄 Prisma 迁移文件说明

## 🎯 文件作用

`prisma/migrations/20250925063537_workflow_init/migration.sql` 是一个 **数据库迁移文件**，它的作用是：

**将 Prisma Schema 中的模型定义转换为实际的数据库表结构**

---

## 📋 工作流程

```
1. 开发者修改 schema.prisma
   ↓
2. 运行命令：npx prisma migrate dev --name workflow_init
   ↓
3. Prisma 自动生成 migration.sql 文件
   ↓
4. Prisma 执行 SQL 语句，创建数据库表
   ↓
5. 数据库结构更新完成
```

---

## 🔍 这个文件做了什么？

### 1. 创建了 5 个数据表

#### 表 1：Workflow（工作流表）
```sql
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,           -- 主键：工作流ID
    "name" TEXT NOT NULL,                       -- 工作流名称（必填）
    "description" TEXT,                         -- 工作流描述（可选）
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    "updatedAt" DATETIME NOT NULL               -- 更新时间
);
```

**作用：** 存储工作流的基本信息

---

#### 表 2：WorkflowNode（工作流节点表）
```sql
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL PRIMARY KEY,             -- 主键：节点ID
    "workflowId" TEXT NOT NULL,                 -- 外键：所属工作流ID
    "type" TEXT NOT NULL,                       -- 节点类型（如 "input", "openai.chat"）
    "label" TEXT,                               -- 节点显示名称（可选）
    "positionX" REAL NOT NULL DEFAULT 0,         -- 节点在画布上的 X 坐标
    "positionY" REAL NOT NULL DEFAULT 0,        -- 节点在画布上的 Y 坐标
    "config" JSONB NOT NULL,                    -- 节点配置（JSON格式）
    CONSTRAINT "WorkflowNode_workflowId_fkey" FOREIGN KEY ("workflowId") 
        REFERENCES "Workflow" ("id") 
        ON DELETE CASCADE ON UPDATE CASCADE     -- 级联删除：删除工作流时自动删除节点
);
```

**作用：** 存储工作流中的每个处理节点

---

#### 表 3：WorkflowEdge（工作流连接线表）
```sql
CREATE TABLE "WorkflowEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,             -- 主键：连接线ID
    "workflowId" TEXT NOT NULL,                 -- 外键：所属工作流ID
    "sourceNodeId" TEXT NOT NULL,               -- 外键：起始节点ID
    "targetNodeId" TEXT NOT NULL,               -- 外键：目标节点ID
    "label" TEXT,                               -- 连接线标签（可选）
    "condition" JSONB,                          -- 条件表达式（可选，用于条件分支）
    -- 三个外键约束
    CONSTRAINT "WorkflowEdge_workflowId_fkey" FOREIGN KEY ("workflowId") 
        REFERENCES "Workflow" ("id") ON DELETE CASCADE,
    CONSTRAINT "WorkflowEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") 
        REFERENCES "WorkflowNode" ("id") ON DELETE CASCADE,
    CONSTRAINT "WorkflowEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") 
        REFERENCES "WorkflowNode" ("id") ON DELETE CASCADE
);
```

**作用：** 存储节点之间的连接关系，定义数据流向

---

#### 表 4：Run（运行记录表）
```sql
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,             -- 主键：运行记录ID
    "workflowId" TEXT NOT NULL,                 -- 外键：执行的工作流ID
    "status" TEXT NOT NULL DEFAULT 'PENDING',   -- 运行状态（PENDING/RUNNING/SUCCEEDED/FAILED）
    "startedAt" DATETIME,                       -- 开始执行时间（可选）
    "finishedAt" DATETIME,                      -- 执行结束时间（可选）
    "input" JSONB,                               -- 输入数据（JSON格式）
    "context" JSONB,                              -- 执行上下文（累积的所有数据）
    "error" TEXT,                                -- 错误信息（如果执行失败）
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    "updatedAt" DATETIME NOT NULL,               -- 更新时间
    CONSTRAINT "Run_workflowId_fkey" FOREIGN KEY ("workflowId") 
        REFERENCES "Workflow" ("id") ON DELETE CASCADE
);
```

**作用：** 记录工作流的每次执行情况

---

#### 表 5：Step（执行步骤表）
```sql
CREATE TABLE "Step" (
    "id" TEXT NOT NULL PRIMARY KEY,             -- 主键：步骤ID
    "runId" TEXT NOT NULL,                      -- 外键：所属运行记录ID
    "nodeId" TEXT NOT NULL,                     -- 外键：执行的节点ID
    "status" TEXT NOT NULL DEFAULT 'PENDING',  -- 步骤状态
    "startedAt" DATETIME,                       -- 开始执行时间（可选）
    "finishedAt" DATETIME,                      -- 执行结束时间（可选）
    "input" JSONB,                               -- 输入数据（JSON格式）
    "output" JSONB,                              -- 输出结果（JSON格式）
    "error" TEXT,                                -- 错误信息（如果执行失败）
    CONSTRAINT "Step_runId_fkey" FOREIGN KEY ("runId") 
        REFERENCES "Run" ("id") ON DELETE CASCADE,
    CONSTRAINT "Step_nodeId_fkey" FOREIGN KEY ("nodeId") 
        REFERENCES "WorkflowNode" ("id") ON DELETE CASCADE
);
```

**作用：** 记录每个节点的执行详情

---

### 2. 创建了 8 个索引（加速查询）

```sql
-- 加速按工作流ID查询节点
CREATE INDEX "WorkflowNode_workflowId_idx" ON "WorkflowNode"("workflowId");

-- 加速按工作流ID查询连接线
CREATE INDEX "WorkflowEdge_workflowId_idx" ON "WorkflowEdge"("workflowId");
CREATE INDEX "WorkflowEdge_sourceNodeId_idx" ON "WorkflowEdge"("sourceNodeId");
CREATE INDEX "WorkflowEdge_targetNodeId_idx" ON "WorkflowEdge"("targetNodeId");

-- 加速按工作流ID查询运行记录
CREATE INDEX "Run_workflowId_idx" ON "Run"("workflowId");
-- 加速按状态查询运行记录（如查询所有失败的任务）
CREATE INDEX "Run_status_idx" ON "Run"("status");

-- 加速按运行记录ID查询步骤
CREATE INDEX "Step_runId_idx" ON "Step"("runId");
-- 加速按节点ID查询步骤
CREATE INDEX "Step_nodeId_idx" ON "Step"("nodeId");
```

**作用：** 提高数据库查询性能，特别是按外键查询时

---

## 🔗 表之间的关系图

```
Workflow (1) ─┬─> (N) WorkflowNode
              │       ├─> (N) WorkflowEdge (sourceNodeId)
              │       └─> (N) WorkflowEdge (targetNodeId)
              │
              ├─> (N) WorkflowEdge (workflowId)
              │
              └─> (N) Run
                      └─> (N) Step
                              └─> (1) WorkflowNode (nodeId)
```

**关系说明：**
- 一个工作流可以有多个节点（1对多）
- 一个工作流可以有多个连接线（1对多）
- 一个工作流可以有多个运行记录（1对多）
- 一个运行记录可以有多个步骤（1对多）
- 一个节点可以有多条输入连接线和输出连接线（1对多）

---

## 📝 文件命名规则

```
20250925063537_workflow_init
│           │    │
│           │    └─ 迁移名称（自定义）
│           └─ 时间戳（精确到秒）
└─ 日期（2025年9月25日）
```

**时间戳的作用：**
- 确保迁移文件按时间顺序执行
- 避免迁移冲突
- 可以追踪数据库结构变更历史

---

## 🚀 如何使用这个文件？

### 1. 自动执行（推荐）

当你运行迁移命令时，Prisma 会自动执行这个文件：

```bash
# 开发环境：创建并执行迁移
npx prisma migrate dev --name workflow_init

# 生产环境：只执行迁移（不创建新迁移）
npx prisma migrate deploy
```

### 2. 手动执行（不推荐）

如果你需要手动执行 SQL：

```bash
# 使用 SQLite 命令行工具
sqlite3 prisma/dev.db < prisma/migrations/20250925063537_workflow_init/migration.sql
```

---

## ⚠️ 重要注意事项

### 1. 不要手动修改迁移文件

**原因：**
- Prisma 会自动生成这些文件
- 手动修改可能导致迁移历史不一致
- 如果修改了，其他开发者执行迁移时可能出错

**正确做法：**
- 修改 `schema.prisma`
- 运行 `npx prisma migrate dev` 生成新的迁移文件

---

### 2. 迁移文件是版本控制的

**原因：**
- 确保所有开发者的数据库结构一致
- 新成员可以快速搭建数据库
- 可以追踪数据库结构变更历史

**Git 提交：**
```bash
git add prisma/migrations/
git commit -m "Add workflow tables migration"
```

---

### 3. 级联删除（CASCADE）

**注意：** 所有外键都设置了 `ON DELETE CASCADE`

**含义：**
- 删除工作流时，自动删除所有节点、连接线、运行记录
- 删除运行记录时，自动删除所有步骤
- 删除节点时，自动删除所有相关的连接线

**好处：**
- 保证数据一致性
- 不会留下孤立的数据

**风险：**
- 删除工作流会删除所有相关数据（包括运行记录）
- 需要谨慎操作

---

## 🔄 迁移文件的生命周期

### 开发阶段

```
1. 修改 schema.prisma
   ↓
2. npx prisma migrate dev --name add_new_field
   ↓
3. Prisma 生成新的 migration.sql
   ↓
4. Prisma 自动执行迁移
   ↓
5. 数据库结构更新
```

### 生产部署

```
1. 代码部署到生产环境
   ↓
2. 运行 npx prisma migrate deploy
   ↓
3. Prisma 检查哪些迁移未执行
   ↓
4. 按顺序执行所有未执行的迁移
   ↓
5. 生产数据库结构更新
```

---

## 📊 迁移文件 vs Schema 文件

| 特性 | schema.prisma | migration.sql |
|------|---------------|---------------|
| **作用** | 定义数据模型（声明式） | 执行数据库变更（命令式） |
| **格式** | Prisma Schema 语言 | SQL 语句 |
| **修改方式** | 手动编写 | Prisma 自动生成 |
| **执行时机** | 不直接执行 | 迁移时执行 |
| **版本控制** | ✅ 需要提交 | ✅ 需要提交 |
| **可读性** | 高（人类友好） | 中（SQL 语法） |

**关系：**
```
schema.prisma (定义) → migration.sql (执行) → 数据库表结构
```

---

## 💡 常见问题

### Q1: 为什么有两个迁移文件？

**A:** 项目中有两个迁移文件：
1. `20250925054130_init` - 初始迁移（可能只创建了 User 表）
2. `20250925063537_workflow_init` - 工作流相关表的迁移

**原因：** 分阶段开发，先创建基础表，再添加业务表

---

### Q2: 可以删除迁移文件吗？

**A:** **不建议删除**

**原因：**
- 迁移文件记录了数据库结构变更历史
- 其他开发者需要这些文件来同步数据库结构
- 生产环境需要按顺序执行所有迁移

**例外情况：**
- 如果项目刚开始，还没有部署到生产环境
- 可以删除并重新创建（不推荐）

---

### Q3: 迁移文件执行失败怎么办？

**A:** 检查以下几点：

1. **数据库连接是否正常**
   ```bash
   # 检查 .env 文件中的 DATABASE_URL
   ```

2. **迁移文件是否有语法错误**
   ```bash
   # 查看 Prisma 生成的迁移文件
   ```

3. **数据库是否已存在表**
   ```bash
   # 如果表已存在，可能需要重置数据库
   npx prisma migrate reset  # ⚠️ 会删除所有数据
   ```

---

### Q4: 如何查看迁移历史？

**A:** 使用 Prisma Migrate 命令：

```bash
# 查看迁移状态
npx prisma migrate status

# 查看迁移历史
ls prisma/migrations/
```

---

## 🎯 总结

### 这个文件的作用：

1. ✅ **创建数据库表结构** - 将 Schema 定义转换为实际表
2. ✅ **建立表之间的关系** - 通过外键连接相关表
3. ✅ **优化查询性能** - 创建索引加速查询
4. ✅ **保证数据一致性** - 通过级联删除避免孤立数据

### 关键要点：

- 🔵 **后端文件**：这个文件只在服务器端使用
- 📝 **自动生成**：由 Prisma 自动生成，不要手动修改
- 🔄 **版本控制**：需要提交到 Git，确保团队数据库一致
- ⚠️ **谨慎操作**：迁移会影响数据库结构，需要谨慎

---

**相关文件：** `prisma/schema.prisma` - 数据模型定义
