# 基于分布式数据库的数据科学教学系统
# (Data Science Teaching System Based on Distributed Database)

本仓库包含了“分布式数据库开发”课程大作业的完整产出，涵盖了从系统架构设计、核心算法实现到最终实验报告的全过程。项目通过集成 **Google Cloud Firestore**，成功构建了一个具备高扩展性与强一致性的分布式教学实验平台。

## 项目摘要 (Abstract)

随着教育数字化的深入发展，传统单机实验环境在高并发协同与数据一致性维护方面面临显著瓶颈。本文旨在探讨分布式数据库在实验教学平台中的应用，通过集成 **Google Cloud Firestore** 构建了一个具备高度扩展性与观测性的分布式教学系统。研究重点聚焦于分布式环境下的强一致性控制、多租户隔离机制以及高并发处理策略。

系统采用计算与存储分离的解耦架构，利用分布式事务机制解决了多节点并发场景下的资源竞态问题，确保了关键业务逻辑的原子性。同时，通过设计细粒度的安全规则，实现了多租户环境下的逻辑隔离与物理同步。实验结果表明，该平台能够有效规避分布式写热点，在模拟大规模并发抢占时表现出优异的一致性保障能力。本研究不仅为分布式数据库的教学应用提供了实践参考，更通过可视化手段直观展示了分布式系统内核的运行机制。

## 仓库结构 (Repository Structure)

* **Project_Report/**: 存放项目的技术设计报告。包含基于 **LaTeX (XeLaTeX)** 编写的源码及最终生成的 PDF 文档。
* **db_class_coursework/**: 存放系统的核心源代码。包含基于 **FastAPI** 的后端服务、**Swift (iOS)** 前端应用以及相关数据库安全规则配置文件。
* **分布式数据库开发答辩情况记录表.pdf/docx**: 此课程打败你的记录表
## 技术栈 (Technical Stack)

* **后端 (Backend)**: Python / FastAPI
* **前端 (Frontend)**: Swift (iOS)
* **数据库 (Database)**: Google Cloud Firestore (NoSQL 分布式数据库)
* **报告排版 (Typesetting)**: LaTeX / XeLaTeX (字体方案：PingFang SC)

## 核心研究内容 (Core Research)

1.  **强一致性保障**: 通过分布式事务机制确保数据原子性。
2.  **架构解耦**: 实现计算与存储分离，提升系统扩展性。
3.  **多租户隔离**: 结合数据库安全规则实现逻辑隔离。
4.  **一致性观测**: 包含针对 Distributed Register 的 Linearizability 和 RYW 一致性检查器。

---

## 作者信息 (Author)

* **姓名**: 王凌宇乐 张又琰 周煜
* **学校**: 常州工学院 (Changzhou Institute of Technology)
* **专业**: 软件工程（中英合作）
* **提交日期**: 2026 年 1 月 9 日
