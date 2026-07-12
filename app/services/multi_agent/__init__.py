"""多智能体协同资源生成系统

基于 LangGraph StateGraph 构建 4 个核心 Agent：
1. SchedulerAgent — 任务入口、参数校验、状态初始化
2. ProfileAgent — 读取学生画像、薄弱点、认知风格
3. ResourceGenAgent — 并行生成 5 类多模态资源
4. PathPushAgent — 学习路径规划、资源绑定、推送入库
"""
