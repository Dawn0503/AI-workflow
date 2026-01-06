// ==========================================
// 模板插值工具
// 文件作用：提供模板字符串插值和对象路径设置功能
// 关键点：支持 {{variable}} 和嵌套路径 {{a.b.c}}
// ==========================================

// 执行上下文类型：键值对对象，值可以是任意类型
export type ExecutionContext = Record<string, unknown>;

/**
 * 模板字符串插值函数
 * 作用：将模板中的 {{variable}} 替换为上下文中的实际值
 * 
 * @param template - 模板字符串，支持 {{key}} 或 {{path.to.value}} 格式
 * @param context - 执行上下文对象，包含所有可用的变量
 * @returns 替换后的字符串
 * 
 * 示例：
 * interpolateTemplate("Hello {{name}}", { name: "World" }) => "Hello World"
 * interpolateTemplate("{{user.name}}", { user: { name: "Alice" } }) => "Alice"
 */
export function interpolateTemplate(template: string, context: ExecutionContext): string {
  // 将模板转换为字符串（处理 null/undefined）
  // 使用正则表达式查找所有 {{...}} 格式的变量
  return String(template ?? "").replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,  // 正则：匹配 {{变量名}} 或 {{a.b.c}}，允许空格
    (_, key: string) => {          // 替换函数：第一个参数是完整匹配，第二个是捕获的变量名
      // 按点号分割路径，支持嵌套访问
      const parts = key.split(".");  // 例如："user.name" => ["user", "name"]
      let value: unknown = context;       // 从上下文对象开始查找
      
      // 遍历路径的每一部分
      for (const p of parts) {
        // 如果当前值为 null 或 undefined，返回空字符串
        if (value == null) return "";
        // 获取下一层的值
        value = value[p as keyof typeof value];
      }
      
      // 如果最终值为 null 或 undefined，返回空字符串；否则转换为字符串
      return value == null ? "" : String(value);
    }
  );
}

/**
 * 按路径设置对象属性值
 * 作用：在对象中按路径设置值，支持嵌套路径
 * 
 * @param target - 目标对象（执行上下文）
 * @param path - 属性路径，支持点号分隔的嵌套路径
 * @param value - 要设置的值
 * @returns 新的对象（不修改原对象，使用浅拷贝）
 * 
 * 示例：
 * setByPath({}, "name", "Alice") => { name: "Alice" }
 * setByPath({}, "user.name", "Bob") => { user: { name: "Bob" } }
 */
export function setByPath(target: ExecutionContext, path: string, value: unknown): ExecutionContext {
  // 按点号分割路径
  const parts = path.split(".");  // 例如："user.name" => ["user", "name"]
  
  // 创建目标对象的浅拷贝（不修改原对象）
  const clone: any = { ...target };
  
  // 游标：指向当前正在处理的对象
  let cursor: any = clone;
  
  // 遍历路径的每一部分（除了最后一个）
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];  // 当前路径部分
    
    // 如果当前键已存在且是对象，则复制它；否则创建新对象
    // 作用：确保中间路径存在，支持嵌套
    cursor[key] = cursor[key] && typeof cursor[key] === "object" ? { ...cursor[key] } : {};
    
    // 移动游标到下一层
    cursor = cursor[key];
  }
  
  // 设置最后一个键的值
  cursor[parts[parts.length - 1]] = value;
  
  // 返回修改后的对象
  return clone;
}


