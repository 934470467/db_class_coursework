# 数据库课程作业项目 (DB Class Coursework)

这是一个包含前端 (React + Vite) 和后端 (FastAPI) 的全栈项目，集成了 Firebase Firestore 和 Google Analytics。

## 目录结构

- `frontend/`: 基于 React 和 Vite 构建的前端应用
- `backend/`: 基于 FastAPI 构建的后端 API 服务

## 前置要求

- Node.js (v18+)
- Python (v3.9+)
- Firebase 项目账号

## 快速开始

### 1. 配置密钥 (重要)

为了保护隐私，本项目中的密钥已被移除。在运行项目前，你需要配置自己的 Firebase 密钥。

#### 后端配置
1. 在 Firebase 控制台生成一个新的 Service Account Key。
2. 下载 JSON 文件。
3. 将其重命名为 `serviceAccountKey.json` 并放置在 `backend/` 目录下。
   - 参考 `backend/serviceAccountKey.json` (模板文件) 了解格式。

#### 前端配置
1. 在 `frontend/src/firebase.js` 中找到 `firebaseConfig` 对象。
2. 用你的 Firebase 项目配置替换其中的占位符 (`YOUR_API_KEY` 等)。

### 2. 后端启动 (Backend)

```bash
cd backend
# 建议创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# .\venv\Scripts\activate  # Windows

# 安装依赖
pip install fastapi uvicorn firebase-admin pandas numpy scikit-learn matplotlib

# 启动服务
python main.py
```

服务将在 `http://0.0.0.0:8000` 启动。

### 3. 前端启动 (Frontend)

```bash
cd frontend
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 技术栈

- **Frontend**: React 19, Vite, TailwindCSS, Firebase SDK
- **Backend**: FastAPI, Firebase Admin SDK, Pandas, Matplotlib, Scikit-learn

## 功能特性

- **代码执行沙箱**: 后端支持运行 Python 代码 (主要用于数据分析与绘图)。
- **数据一致性演示**: 包含 Firestore 事务处理 (`/consistency_challenge`)。
- **数据集上传与预览**: 支持上传与预览 CSV/Excel 文件。
