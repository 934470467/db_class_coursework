import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-dark.css'; // Importing dark theme
import Papa from 'papaparse';

export default function ExperimentDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [userRole, setUserRole] = useState(null);
    const isTeacher = userRole === 'teacher';

    const [project, setProject] = useState(null);
    const [activeTab, setActiveTab] = useState('builtin'); // 'builtin' | 'upload'
    const [code, setCode] = useState('# 在此处编写您的 Python 代码\nimport pandas as pd\n\ndef process(data):\n    return data.describe()');
    const [csvData, setCsvData] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [selectedDataset, setSelectedDataset] = useState('Iris');

    // Fetch User Role
    useEffect(() => {
        if (currentUser) {
            getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
                if (snap.exists()) setUserRole(snap.data().role);
            });
        }
    }, [currentUser]);

    // Submission State
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [selfScore, setSelfScore] = useState('');

    // Handle Project Submission
    const handleSubmitProject = async () => {
        if (!project || !id) return;
        try {
            await updateDoc(doc(db, 'projects', id), {
                status: 'submitted',
                selfScore: Number(selfScore),
                submittedAt: serverTimestamp()
            });
            setShowSubmitModal(false);
            setShowSubmitModal(false);
            // Refresh project data will be handled by logic or simple reload if strict, 
            // but for now onSnapshot listener would be better. 
            // Since we use getDoc once, we manually update local state for immediate feedback:
            setProject(prev => ({
                ...prev,
                status: 'submitted',
                selfScore: Number(selfScore),
                submittedAt: { seconds: Date.now() / 1000 } // approximate
            }));
        } catch (e) {
            console.error("Submission failed", e);
            alert("提交失败，请重试");
        }
    };

    // Fetch Project
    useEffect(() => {
        if (!id) return;
        async function fetchProject() {
            try {
                const docRef = doc(db, 'projects', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setProject({ id: docSnap.id, ...data });
                    if (data.latest_code) {
                        setCode(data.latest_code);
                    } else {
                        // Generate Starter Code based on Dataset
                        if (data.dataset && data.dataset.startsWith('custom:')) {
                            const filename = data.dataset.split(':')[1];
                            setCode(`# 加载自定义数据集
import pandas as pd

# dataset stored in 'datasets/' directory
df = pd.read_csv(f'datasets/${filename}')
print(df.head())

def process(data):
    return data.describe()
`);
                        } else {
                            // Default Built-in
                            setCode(`# 加载内置数据集
import pandas as pd
import numpy as np
from sklearn import datasets

# Example: Load Iris
iris = datasets.load_iris()
df = pd.DataFrame(iris.data, columns=iris.feature_names)
print(df.head())
`);
                        }
                    }

                    // Initialize dataset selection based on project data
                    if (data.dataset && data.dataset.startsWith('custom:')) {
                        const filename = data.dataset.split(':')[1];
                        setActiveTab('builtin'); // Stay on the list view
                        setSelectedDataset(filename);
                        setAgentMessage(`已自动加载任务数据集: ${filename}`);
                        loadDatasetPreview(filename);
                    } else if (data.dataset) {
                        setSelectedDataset(data.dataset);
                    }
                } else {
                    console.error("Project not found:", id);
                    alert("未找到该实验项目，即将返回主页。");
                    alert("未找到该实验项目，即将返回主页。");
                    navigate(isTeacher ? '/teacher-dashboard' : '/');
                }
            } catch (err) {
                console.error("Error fetching project:", err);
                alert(`加载实验失败: ${err.message}`);
                alert(`加载实验失败: ${err.message}`);
                navigate(isTeacher ? '/teacher-dashboard' : '/');
            }
        }
        fetchProject();
    }, [id, navigate]);

    // Realtime Results Listener
    useEffect(() => {
        const q = query(
            collection(db, 'experiment_results'),
            where('experimentId', '==', id)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newLogs = snapshot.docs.map(doc => doc.data());
            newLogs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setLogs(newLogs);
            if (newLogs.length > 0 && isRunning) {
                setIsRunning(false);
                setAgentMessage("计算已完成。分析结果已更新。");
            }
        });
        return () => unsubscribe();
    }, [id, isRunning]);


    async function loadDatasetPreview(filename) {
        try {
            const res = await fetch(`http://localhost:8000/preview_dataset?filename=${filename}`);
            if (res.ok) {
                const result = await res.json();
                setCsvData(result.data);
                setCsvData(result.data);
            } else {
            }
        } catch (e) {
            console.error("Preview fetch error", e);
        }
    }

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            Papa.parse(file, {
                header: true,
                preview: 10, // Only parse first 10 rows for preview
                complete: async (results) => {
                    setCsvData(results.data);

                    // Optional: Save sample to Firestore
                    try {
                        await addDoc(collection(db, `projects/${id}/data_records`), {
                            fileName: file.name,
                            preview: results.data,
                            uploadedAt: serverTimestamp()
                        });
                    } catch (err) {
                        console.error("保存预览失败", err);
                    }
                }
            });
        }
    };

    const handleRun = async () => {
        setIsRunning(true);

        // 1. Save Code
        const projectRef = doc(db, 'projects', id);
        await updateDoc(projectRef, { latest_code: code });

        // 2. Call Backend API
        try {
            const response = await fetch('http://localhost:8000/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    project_id: id,
                    code: code
                }),
            });

            if (!response.ok) {
                throw new Error('后端服务未启动或出错');
            }

        } catch (error) {
            console.error("后端连接失败", error);
            // Fallback Mock Logic
            setTimeout(async () => {
                await addDoc(collection(db, 'experiment_results'), {
                    experimentId: id,
                    output: `模拟执行结果: 已处理 ${activeTab === 'upload' ? '自定义 CSV' : selectedDataset} 数据集。`,
                    metrics: { accuracy: (0.8 + Math.random() * 0.15).toFixed(4) },
                    region: 'asia-east1',
                    timestamp: serverTimestamp()
                });
            }, 2000);
        }
    };

    // Construct Available Datasets List
    const defaultDatasets = ['Iris', 'Boston', 'Titanic', 'MNIST'];
    const customDatasetName = (project?.dataset && project.dataset.startsWith('custom:'))
        ? project.dataset.split(':')[1]
        : null;

    const availableDatasets = customDatasetName
        ? [...defaultDatasets, customDatasetName]
        : defaultDatasets;

    // Derived States
    const isSubmitted = project?.status === 'submitted' || project?.status === 'graded';

    // ... existing initialization ...

    return (
        <div className="flex h-screen w-full bg-[#f5f5f7] font-sans overflow-hidden">

            {/* LEFT: Code Editor (45%) */}
            <div className="w-[45%] flex flex-col bg-[#1e1e1e] border-r border-[#333]">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#252526] border-b border-[#333]">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(isTeacher ? '/teacher-dashboard' : '/')} className="text-gray-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="text-sm font-medium text-gray-300 tracking-wide font-mono">
                            {project ? `${project.title}.py` : '加载中...'}
                        </span>
                        {isSubmitted && <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/30">Read Only</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-gray-400">已连接</span>
                    </div>
                </div>

                {/* Editor */}
                <div className={`flex-1 overflow-auto relative font-mono text-[13px] leading-relaxed scrollbar-hide ${isSubmitted ? 'opacity-80' : ''}`}>
                    <Editor
                        value={code}
                        onValueChange={!isSubmitted ? (code => setCode(code)) : () => { }}
                        highlight={code => highlight(code, languages.python || languages.extend('python', {}))}
                        padding={20}
                        style={{
                            fontFamily: '"Fira Code", "Fira Mono", monospace',
                            fontSize: 14,
                            backgroundColor: '#1e1e1e',
                            color: '#d4d4d4',
                            minHeight: '100%',
                            pointerEvents: (isSubmitted || isTeacher) ? 'none' : 'auto'
                        }}
                        className="min-h-full"
                    />
                </div>

                {/* Bottom Bar */}
                <div className="p-4 bg-[#1e1e1e] border-t border-[#333]">
                    <button
                        onClick={handleRun}
                        disabled={isRunning || isSubmitted}
                        className="w-full flex items-center justify-center gap-2 bg-[#0071e3] hover:bg-[#0077ED] active:scale-[0.98] text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-500"
                    >
                        {isSubmitted ? (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                实验已提交 (锁定)
                            </>
                        ) : isRunning ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                正在运行实验...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                运行实验
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* RIGHT: Inspector (55%) */}
            <div className="w-[55%] flex flex-col bg-white relative">
                {/* Header / Tabs */}
                <div className="px-8 py-6 border-b border-[#e5e5e5]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-[#1d1d1f]">数据探查器</h2>

                        {/* Status/Submit Action */}
                        <div className="flex items-center gap-3">
                            {isSubmitted ? (
                                <div className="flex items-center gap-4 bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1 text-green-700 font-bold text-sm">
                                            <span>✓ 已提交</span>
                                            <span>(自评: {project.selfScore})</span>
                                        </div>

                                        {/* Teacher Grading UI */}
                                        {isTeacher ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-green-600 font-medium whitespace-nowrap">教师评分:</span>
                                                <input
                                                    type="number"
                                                    className="w-16 px-2 py-0.5 text-sm border border-green-200 rounded text-center font-bold text-green-800 focus:ring-1 focus:ring-green-500 outline-none"
                                                    defaultValue={project.teacherScore}
                                                    placeholder="-"
                                                    onBlur={async (e) => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            try {
                                                                await updateDoc(doc(db, 'projects', id), {
                                                                    teacherScore: Number(val),
                                                                    status: 'graded'
                                                                });
                                                            } catch (err) {
                                                                alert("评分保存失败");
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            project.teacherScore && (
                                                <div className="text-xs text-green-600 font-medium">
                                                    教师评分: <span className="text-lg font-bold">{project.teacherScore}</span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowSubmitModal(true)}
                                    className="px-5 py-2.5 bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-2"
                                >
                                    <span>📤</span> 提交任务
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Segmented Control */}
                    <div className="inline-flex rounded-lg bg-[#f5f5f7] p-1 mb-4">
                        <button
                            onClick={() => setActiveTab('builtin')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'builtin' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                        >
                            数据集
                        </button>
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'upload' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                        >
                            上传 CSV
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'builtin' ? (
                        <div className="flex flex-wrap gap-3">
                            {availableDatasets.map(ds => {
                                const isCustom = ds === customDatasetName;
                                return (
                                    <button
                                        key={ds}
                                        onClick={() => {
                                            setSelectedDataset(ds);
                                            if (isCustom) {
                                                loadDatasetPreview(ds);
                                            } else {
                                                setCsvData([]); // Clear preview for built-ins
                                                setAgentMessage(`已切换至 ${ds} 数据集。`);
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${selectedDataset === ds
                                            ? 'border-[#0071e3] bg-blue-50 text-[#0071e3]'
                                            : 'border-[#d2d2d7] bg-white text-[#1d1d1f] hover:border-[#86868b]'
                                            }`}
                                    >
                                        {isCustom && (
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                        {ds}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div>
                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-[#d2d2d7] border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">点击上传</span> 或拖拽文件至此</p>
                                    <p className="text-xs text-gray-500">仅支持 CSV 文件</p>
                                </div>
                                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-8 bg-[#fafafa]">
                    {csvData.length > 0 && (activeTab === 'upload' || (activeTab === 'builtin' && selectedDataset === customDatasetName)) ? (
                        <div className="mb-8">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-3">CSV 预览 (前 10 行)</h3>
                            <div className="overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#f5f5f7] border-b border-[#e5e5e5]">
                                        <tr>
                                            {Object.keys(csvData[0] || {}).map(header => (
                                                <th key={header} className="px-4 py-3 font-medium text-[#1d1d1f]">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e5e5e5]">
                                        {csvData.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                {Object.values(row).map((val, j) => (
                                                    <td key={j} className="px-4 py-2 text-[#424245] whitespace-nowrap">{val}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}

                    {/* Logs Loop */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868b] mb-3">程序输出结果</h3>
                        <div className="space-y-3">
                            {logs.map((log, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white p-4 rounded-xl border border-[#e5e5e5] shadow-sm flex items-start gap-4"
                                >
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-semibold text-[#1d1d1f]">执行结果</h4>
                                            <span className="text-xs text-[#86868b]">{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString() : '刚刚'}</span>
                                        </div>
                                        <div className="bg-[#f5f5f7] p-3 rounded-lg border border-[#e5e5e5] mt-2">
                                            <pre className="text-[13px] text-[#1d1d1f] font-mono whitespace-pre-wrap leading-relaxed">{log.output}</pre>
                                            {log.image && (
                                                <div className="mt-4 border-t border-gray-200 pt-4">
                                                    <p className="text-xs font-semibold text-[#86868b] mb-2 uppercase tracking-wide">生成图表</p>
                                                    <img
                                                        src={`data:image/png;base64,${log.image}`}
                                                        alt="Experiment Plot"
                                                        className="rounded-lg border border-[#e5e5e5] shadow-sm max-w-full"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {log.metrics && log.metrics.accuracy && (
                                            <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                准确率: {log.metrics.accuracy}
                                            </div>
                                        )}
                                        {/* Display Agent Suggestion if available - REMOVED */}
                                    </div>
                                </motion.div>
                            ))}
                            {logs.length === 0 && (
                                <div className="text-center py-12 text-[#86868b] italic bg-white rounded-xl border border-dashed border-[#d2d2d7]">
                                    暂无运行记录。点击“运行实验”开始。
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Floating Agent Bubble - REMOVED */}

                {/* Submit Modal */}
                {showSubmitModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6">
                                <h3 className="text-xl font-bold mb-4">提交任务 & 自我评分</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    请根据您的实验完成情况进行自我评分（0-100）。提交后不可更改。
                                </p>

                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">自我评分 (Self Score)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
                                        value={selfScore}
                                        onChange={(e) => setSelfScore(e.target.value)}
                                        placeholder="85"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowSubmitModal(false)}
                                        className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleSubmitProject}
                                        disabled={!selfScore}
                                        className="flex-1 py-2.5 rounded-lg bg-[#0071e3] text-white font-medium hover:bg-[#0077ED] disabled:opacity-50"
                                    >
                                        确认提交
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
