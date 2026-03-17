## 改动规划

- 1) JSON 按 object 拆分（替代暴力 token chunk）
- 现状：JSON 先被整体 stringify，再按 token 切块， json.parser.ts + chunker.ts 。
- 问题：一个 chunk 里会混入多个对象，语义污染，像“玫瑰”这种检索会漂移。
- 改法：
  
  - 对 Array<Object> 类型 JSON，按“每个 object 一条 chunk”入库；
  - 每条 chunk 生成结构化文本（如 name / olfactory_family / description / impact_level... ）；
  - 超长字段（例如 description 太长）再做二次小切分；
  - payload 增加结构化字段（name/category/family），用于后续关键词过滤。
- 验收：查询“玫瑰”时，Top-K 前几条显著提升相关性。
- 2) 混合检索（关键词 + 向量）
- 现状：只有向量检索， retrieval.service.ts 。
- 改法（推荐）：
  
  - 增加关键词召回通道（先用 Postgres FTS/BM25 风格，或 Qdrant payload 文本检索）；
  - 并行拿到 keyword_topk 与 vector_topk ；
  - 用 RRF（Reciprocal Rank Fusion）融合排名；
  - 支持 query 类型策略：短词（如“玫瑰”）加大关键词权重，长自然语言加大向量权重。
- 验收：单关键词查询不再“语义跑偏”，长问句仍保持语义召回能力。
- 3) Evaluation 后“反向优化”
- 先纠正一个关键点： Qdrant 本身不能被“训练” ，它是向量索引库，不是模型。
- 你要的“反向训练”应做成 反馈闭环 ：
  
  - Evaluation 结果写入失败样本池（已存在评估存储能力， evaluation.service.ts ）；
  - 依据失败样本自动产出优化建议（chunk 参数、关键词权重、过滤规则）；
  - 可选：后续引入可训练 embedding/reranker 模型时再做模型微调；
  - 执行“重嵌入 + 重建索引”流水线（不是训练 Qdrant）。
- 验收：每轮 Evaluation 后给出可执行优化项，并可触发自动再索引任务。