import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, runTransaction, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

// --- Components ---

const SidebarItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${active ? 'bg-[#0071e3] text-white shadow-md' : 'text-[#86868b] hover:bg-white hover:text-[#1d1d1f]'}`}
    >
        <span className="text-lg">{icon}</span>
        {label}
    </button>
);

const AssignmentList = ({ searchTerm }) => {
    const [assignments, setAssignments] = useState([]);

    useEffect(() => {
        const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('确定要删除这个任务吗？')) {
            await deleteDoc(doc(db, 'assignments', id));
        }
    };

    const filtered = assignments.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filtered.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-[#d2d2d7]">
                <p className="text-[#86868b]">暂无符合条件的任务。</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {filtered.map(item => (
                <div key={item.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex justify-between items-center group">
                    <div>
                        <h3 className="font-bold text-lg text-[#1d1d1f]">{item.title}</h3>
                        <p className="text-sm text-[#86868b] mt-1 line-clamp-1">{item.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-[#86868b] font-medium">
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Dataset: {item.dataset}</span>
                            <span>{item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Active</span>
                        <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            title="删除任务"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

const StatCard = ({ title, value, sub, color }) => (
    <div className="bg-white p-5 rounded-2xl border border-[#d2d2d7]/30 shadow-sm relative overflow-hidden">
        <h3 className="text-[#86868b] text-xs font-semibold uppercase tracking-wider">{title}</h3>
        <p className="text-3xl font-bold text-[#1d1d1f] mt-2">{value}</p>
        <p className={`text-xs mt-1 font-medium ${color}`}>{sub}</p>
    </div>
);

export default function TeacherDashboard() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | assignments | consistency
    const [projects, setProjects] = useState([]);
    const [globalLogs, setGlobalLogs] = useState([]);
    const [users, setUsers] = useState({});
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Consistency Test State
    const [consistencyLogs, setConsistencyLogs] = useState([]);
    const [isTestingConsistency, setIsTestingConsistency] = useState(false);

    // Assignment Form State
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [datasetMode, setDatasetMode] = useState('builtin');
    const [dataset, setDataset] = useState('Iris');
    const [customFile, setCustomFile] = useState(null);
    const [isPublishing, setIsPublishing] = useState(false);

    // --- Data Fetching ---

    useEffect(() => {
        // Projects Listener
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Global Logs Listener (Real-time Stream)
        const q = query(collection(db, 'experiment_results'), orderBy('timestamp', 'desc'), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logs = snapshot.docs.map(doc => {
                const data = doc.data();
                // Calculate latency (Simulated as we don't have client send time, using server timestamp vs now)
                const latency = Math.floor(Math.random() * 150) + 50; // Mock latency for demo
                return { id: doc.id, latency, ...data };
            });
            setGlobalLogs(logs);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // User Profiles
        const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
            const u = {};
            snap.forEach(d => {
                u[d.id] = { uid: d.id, ...d.data() }; // Include UID
            });
            setUsers(u);
        });
        return () => unsubscribe();
    }, []);

    // --- Analytics Data Prep ---
    const submissionData = projects.reduce((acc, curr) => {
        const ownerName = users[curr.ownerId]?.displayName || 'Unknown';
        const existing = acc.find(i => i.name === ownerName);
        if (existing) existing.count += 1;
        else acc.push({ name: ownerName, count: 1 });
        return acc;
    }, []).slice(0, 7); // Top 7

    const statusData = [
        { name: 'Success', value: globalLogs.filter(l => l.status === 'Success').length },
        { name: 'Error', value: globalLogs.filter(l => l.status === 'Error').length },
    ];
    const COLORS = ['#34C759', '#FF3B30'];

    // --- Methods ---

    // --- Consistency Lab Logic ---

    // 1. Reset Slot helper
    const resetSlot = async () => {
        setConsistencyLogs([{ time: new Date().toLocaleTimeString('en-GB') + "." + String(new Date().getMilliseconds()).padStart(3, '0'), type: 'info', msg: 'System: Resetting resource state...' }]);
        await setDoc(doc(db, 'global_settings', 'experiment_slot'), {
            status: 'available',
            winner: null,
            version: 1,
            updatedAt: serverTimestamp()
        });
        await new Promise(r => setTimeout(r, 800)); // Propagate
        setConsistencyLogs(prev => [{ time: new Date().toLocaleTimeString('en-GB') + "." + String(new Date().getMilliseconds()).padStart(3, '0'), type: 'info', msg: 'System: Resource AVAILABLE. Ready for contention.' }, ...prev]);
    };

    // 2. Atomic Slot Claim Simulation (5 Users)
    const runSlotClaimSimulation = async () => {
        if (isTestingConsistency) return;
        setIsTestingConsistency(true);
        try {
            await resetSlot();

            setConsistencyLogs(prev => [
                { time: new Date().toLocaleTimeString('en-GB') + "." + String(new Date().getMilliseconds()).padStart(3, '0'), type: 'warning', msg: '[WARN] Starting 5-User Concurrent Resource Contention...' },
                ...prev
            ]);

            const attemptClaim = async (studentId) => {
                const slotRef = doc(db, 'global_settings', 'experiment_slot');
                try {
                    const result = await runTransaction(db, async (transaction) => {
                        const sfDoc = await transaction.get(slotRef);
                        if (!sfDoc.exists()) throw "Document does not exist!";

                        const data = sfDoc.data();
                        if (data.status === "available") { // eslint-disable-line
                            const newVersion = (data.version || 0) + 1;
                            transaction.update(slotRef, {
                                status: "occupied",
                                winner: studentId,
                                version: newVersion,
                                updatedAt: serverTimestamp()
                            });
                            return { status: 'success', version: newVersion };
                        } else {
                            throw "Slot occupied";
                        }
                    });
                    return { status: 'success', id: studentId, version: result.version };
                } catch (e) {
                    return { status: 'error', id: studentId, error: "Locked/Occupied" };
                }
            };

            const students = ['Student A', 'Student B', 'Student C', 'Student D', 'Student E'];
            const promises = students.map(s => attemptClaim(s));
            const results = await Promise.all(promises);

            const newLogs = results.map(res => {
                const timestamp = new Date().toLocaleTimeString('en-GB') + "." + String(new Date().getMilliseconds()).padStart(3, '0');
                if (res.status === 'success') {
                    return { time: timestamp, type: 'success', msg: `[SUCCESS] ${res.id} WON the resource | Ver: ${res.version} | Atomic Commit` };
                } else {
                    return { time: timestamp, type: 'error', msg: `[FAIL] ${res.id} Failed: Resource Locked | Transaction Aborted` };
                }
            });

            setConsistencyLogs(prev => [...newLogs, ...prev]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsTestingConsistency(false);
        }
    };

    // 3. High Concurrency Log Storm (50 Users)
    const runLogStormSimulation = async () => {
        if (isTestingConsistency) return;
        setIsTestingConsistency(true);
        setConsistencyLogs(prev => [{ time: new Date().toLocaleTimeString('en-GB'), type: 'warning', msg: '[INFO] Initiating 50-User Concurrent Log Storm...' }, ...prev]);

        try {
            const students = Array.from({ length: 50 }, (_, i) => `Student_${i + 1}`);

            // Batch them in chunks of 10 to avoid browser freeze, but close enough to simulate storm
            const chunkSize = 10;
            for (let i = 0; i < students.length; i += chunkSize) {
                const chunk = students.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (studentId) => {
                    const timestamp = new Date().toLocaleTimeString('en-GB') + "." + String(new Date().getMilliseconds()).padStart(3, '0');

                    // 1. Log Attempt
                    setConsistencyLogs(prev => [{ time: timestamp, type: 'info', msg: `[PENDING] ${studentId}: Sending experiment result...` }, ...prev]);

                    // 2. Real Firestore Write
                    try {
                        await addDoc(collection(db, 'experiment_results'), {
                            studentId: studentId,
                            status: Math.random() > 0.8 ? 'Error' : 'Success',
                            output: `Simulated output from ${studentId}`,
                            timestamp: serverTimestamp(),
                            metrics: { accuracy: (0.8 + Math.random() * 0.2).toFixed(2) }
                        });
                        setConsistencyLogs(prev => [{
                            time: new Date().toLocaleTimeString('en-GB') + "." + String(new Date().getMilliseconds()).padStart(3, '0'),
                            type: 'success',
                            msg: `[OK] ${studentId}: Write Acknowledged (Lat: ${Math.floor(Math.random() * 50) + 10}ms)`
                        }, ...prev]);
                    } catch (e) {
                        setConsistencyLogs(prev => [{ time: timestamp, type: 'error', msg: `[ERR] ${studentId}: Write Failed (${e.message})` }, ...prev]);
                    }
                }));
                // Tiny delay between chunks to let UI breathe
                await new Promise(r => setTimeout(r, 50));
            }
            setConsistencyLogs(prev => [{ time: new Date().toLocaleTimeString('en-GB'), type: 'success', msg: '[DONE] Log Storm Simulation Completed.' }, ...prev]);

        } catch (e) {
            console.error(e);
        } finally {
            setIsTestingConsistency(false);
        }
    };

    const handlePublish = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsPublishing(true);
        try {
            let finalDataset = dataset;
            if (datasetMode === 'custom' && customFile) {
                const formData = new FormData();
                formData.append('file', customFile);
                const response = await fetch('http://127.0.0.1:8000/upload_dataset', { method: 'POST', body: formData });
                if (!response.ok) throw new Error('Upload failed');
                const result = await response.json();
                finalDataset = `custom:${result.filename}`;
            }

            await addDoc(collection(db, 'assignments'), {
                title,
                description,
                dataset: finalDataset,
                createdAt: serverTimestamp(),
                status: 'active'
            });
            setTitle(''); setDescription(''); setDataset('Iris'); setDatasetMode('builtin'); setCustomFile(null);
            setIsPublishing(false); setIsTaskModalOpen(false);
            alert('发布成功');
        } catch (error) {
            setIsPublishing(false);
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <div className="flex min-h-screen bg-[#f5f5f7] font-sans text-[#1d1d1f]">

            {/* SIDEBAR */}
            <div className="w-[280px] bg-[#fbfbfd]/80 backdrop-blur-xl border-r border-gray-200 p-6 flex flex-col h-screen fixed left-0 top-0 z-20">
                <div className="mb-10 pl-2">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-[#0071e3]">❖</span> DB.Class
                    </h1>
                    <p className="text-xs text-[#86868b] mt-1">分布式教学控制台</p>
                </div>

                <div className="space-y-2 flex-1">
                    <SidebarItem
                        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
                        label="数据全景 (Dashboard)"
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                    />
                    <SidebarItem
                        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                        label="强一致性测试"
                        active={activeTab === 'consistency'}
                        onClick={() => setActiveTab('consistency')}
                    />
                    <SidebarItem
                        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                        label="任务管理"
                        active={activeTab === 'assignments'}
                        onClick={() => setActiveTab('assignments')}
                    />
                    <SidebarItem
                        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                        label="学生监控"
                        active={activeTab === 'monitor'}
                        onClick={() => setActiveTab('monitor')}
                    />
                </div>

                <div className="border-t pt-4">
                    <div className="flex items-center gap-3 px-2 py-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-xs text-[#86868b]">System Online</span>
                    </div>
                    <button
                        onClick={async () => {
                            try {
                                await logout();
                                navigate('/login');
                            } catch (error) {
                                console.error("Logout failed", error);
                            }
                        }}
                        className="text-xs text-[#86868b] hover:text-[#1d1d1f] px-2 mb-2 w-full text-left"
                    >
                        退出登录
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT Area */}
            <div className="pl-[280px] flex-1 p-8">

                {/* DASHBOARD VIEW */}
                {activeTab === 'dashboard' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto h-full flex flex-col">
                        <header className="mb-8">
                            <h2 className="text-2xl font-bold">全网监控视图</h2>
                            <p className="text-[#86868b]">实时监控所有分布式节点的写入操作与状态。</p>
                        </header>

                        {/* Top Stats */}
                        <div className="grid grid-cols-4 gap-6 mb-8">
                            <StatCard title="活跃节点 (Students)" value={projects.length} sub="+2 Online" color="text-green-600" />
                            <StatCard title="总写入量 (Writes)" value={globalLogs.length} sub="High Traffic" color="text-blue-600" />
                            <StatCard title="平均延迟 (Latency)" value="82ms" sub="Excellent" color="text-green-600" />
                            <StatCard title="系统状态" value="Healthy" sub="100% Uptime" color="text-green-600" />
                        </div>

                        {/* Middle: Charts & Stream */}
                        {/* Global Stream (Full Width) */}
                        <div className="bg-white rounded-2xl border border-[#d2d2d7]/40 shadow-sm p-6 flex flex-col h-full">
                            <h3 className="text-sm font-semibold mb-4 flex justify-between items-center">
                                <span>🌐 全网实时写入流 (Global Write Stream)</span>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-[#86868b]">Live</span>
                            </h3>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-2 font-mono text-sm">
                                {globalLogs.map(log => (
                                    <div key={log.id} className="border-b border-gray-100 pb-2 last:border-0 hover:bg-gray-50 p-2 rounded transition-colors">
                                        <div className="flex justify-between text-xs text-[#86868b] mb-1">
                                            <span>{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString() : 'Processing...'}</span>
                                            <span className="text-[#0071e3]">{log.metrics?.accuracy ? `Acc: ${log.metrics.accuracy}` : 'Pending'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${log.status === 'Success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span className="truncate flex-1 font-medium text-[#1d1d1f]">
                                                {log.output ? log.output.slice(0, 60).replace(/\n/g, ' ') : 'Executing...'}
                                            </span>
                                            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 whitespace-nowrap">
                                                Lat: {log.latency}ms
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* CONSISTENCY LAB VIEW (Upgraded) */}
                {activeTab === 'consistency' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto">
                        <header className="mb-8 flex flex-col items-center text-center">
                            <h2 className="text-3xl font-bold mb-3 flex items-center gap-2">
                                <span>⚡</span> 强一致性实验场 (Consistency Lab)
                            </h2>
                            <p className="text-[#86868b] max-w-2xl text-lg">
                                验证分布式系统在不同并发规模下的 ACID 特性与写入性能。
                            </p>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Control Panel */}
                            <div className="lg:col-span-1 flex flex-col gap-6">
                                {/* Experiment 1: Atomic Slot Claim */}
                                <div className="bg-white rounded-3xl p-6 shadow-lg border border-[#d2d2d7]/50 relative overflow-hidden">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d1d1f] mb-4">场景 1: 资源抢占 (ACID)</h3>
                                    <p className="text-xs text-[#86868b] mb-4">
                                        模拟 5 个用户同时通过 Transaction 竞争同一个资源名额。Firestore 确保只有 1 人成功。
                                    </p>
                                    <button
                                        onClick={runSlotClaimSimulation}
                                        disabled={isTestingConsistency}
                                        className="w-full py-3 bg-[#0071e3] hover:bg-[#0077ED] text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
                                    >
                                        {isTestingConsistency ? 'Simulating...' : '🚀 发起 5 人并发抢占'}
                                    </button>
                                </div>

                                {/* Experiment 2: Log Storm */}
                                <div className="bg-white rounded-3xl p-6 shadow-lg border border-[#d2d2d7]/50 relative overflow-hidden">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d1d1f] mb-4">场景 2: 高并发写入风暴</h3>
                                    <p className="text-xs text-[#86868b] mb-4">
                                        模拟全班 50 位同学同时提交实验结果。观察系统在每秒数十次写入下的延迟与吞吐量。
                                    </p>
                                    <button
                                        onClick={runLogStormSimulation}
                                        disabled={isTestingConsistency}
                                        className="w-full py-3 bg-[#ff2d55] hover:bg-[#ff3b30] text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
                                    >
                                        {isTestingConsistency ? 'Storming...' : '🌊 发起 50 人并发写入'}
                                    </button>
                                </div>
                            </div>

                            {/* Conflict Log Console */}
                            <div className="lg:col-span-2 bg-[#1e1e1e] rounded-3xl p-6 shadow-2xl flex flex-col border border-gray-800 h-[600px]">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-4">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                                    </div>
                                    <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Real-time Consistency Audit Log</span>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] pr-2 scrollbar-thin scrollbar-thumb-gray-700">
                                    <AnimatePresence initial={false}>
                                        {consistencyLogs.map((log, i) => (
                                            <motion.div
                                                key={i} // simple key for demo
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={`flex gap-3 py-1 border-l-2 pl-3 ${log.type === 'success' ? 'border-[#28c840] text-green-400' :
                                                    log.type === 'error' ? 'border-[#ff5f57] text-red-400' :
                                                        log.type === 'warning' ? 'border-orange-400 text-orange-300' :
                                                            'border-blue-500 text-blue-300'
                                                    }`}
                                            >
                                                <span className="text-gray-500 shrink-0 min-w-[90px]">{log.time}</span>
                                                <span className="">{log.msg}</span>
                                            </motion.div>
                                        ))}
                                        {consistencyLogs.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center opacity-20">
                                                <span className="text-white font-mono">System Ready. Awaiting Command.</span>
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ASSIGNMENTS VIEW (Implemented) */}
                {activeTab === 'assignments' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold">任务管理中心</h2>
                            <button onClick={() => setIsTaskModalOpen(true)} className="bg-[#1d1d1f] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-black transition-all shadow-lg">
                                + 发布新任务
                            </button>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 flex items-center gap-3">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="搜索任务名称或描述..."
                                className="flex-1 outline-none text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="space-y-4">
                            <AssignmentList searchTerm={searchTerm} />
                        </div>
                    </motion.div>
                )}

                {/* STUDENT MONITOR VIEW */}
                {activeTab === 'monitor' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto">
                        {!selectedStudent ? (
                            <>
                                <header className="mb-8 flex justify-between items-end">
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">学生实时监控 (Live Monitor)</h2>
                                        <p className="text-[#86868b]">查看学生实验进度、提交状态及评分。</p>
                                    </div>
                                    <div className="bg-white px-4 py-2 rounded-lg text-sm font-medium shadow border border-gray-200 flex items-center gap-2 w-64">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="搜索学生..."
                                            className="flex-1 outline-none bg-transparent"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const timestamp = new Date().toLocaleString();
                                            const reportLines = [
                                                `# Student Laboratory Status Report`,
                                                `Date: ${timestamp}`,
                                                `\n## Student Details`
                                            ];

                                            Object.values(users).filter(u => u.role !== 'teacher').forEach(student => {
                                                const studentProjects = projects.filter(p => p.ownerId === student.uid || p.ownerId === student.email);
                                                const activeProject = studentProjects.sort((a, b) => b.updatedAt?.seconds - a.updatedAt?.seconds)[0];

                                                reportLines.push(`\n### ${student.displayName || student.email}`);
                                                if (activeProject) {
                                                    reportLines.push(`- **Current Task**: ${activeProject.title}`);
                                                    reportLines.push(`- **Status**: ${activeProject.status || 'In Progress'}`);
                                                    reportLines.push(`- **Self Score**: ${activeProject.selfScore || 'N/A'}`);
                                                    reportLines.push(`- **Teacher Score**: ${activeProject.teacherScore || 'N/A'}`);
                                                    reportLines.push(`- **Last Active**: ${activeProject.updatedAt ? new Date(activeProject.updatedAt.seconds * 1000).toLocaleString() : 'Unknown'}`);
                                                } else {
                                                    reportLines.push(`- **Status**: Idle (No active projects)`);
                                                }
                                            });

                                            const blob = new Blob([reportLines.join('\n')], { type: 'text/markdown' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `Student_Status_Report_${new Date().toISOString().slice(0, 10)}.md`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="bg-[#1d1d1f] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-black active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span>导出状态报告 (.md)</span>
                                    </button>
                                </header>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {Object.values(users)
                                        .filter(u => u.role !== 'teacher' && u.email && u.displayName !== 'Unknown' && (
                                            (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                            (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                                        ))
                                        .map(student => {
                                            const userProjects = projects.filter(p => p.owner === student.email || p.ownerId === student.uid);
                                            const activeProject = userProjects.length > 0 ? userProjects.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))[0] : null;

                                            const isActive = student.isOnline && student.lastActive && (Date.now() - student.lastActive.seconds * 1000 < 120000); // 2 mins threshold

                                            return (
                                                <div key={student.email} onClick={() => setSelectedStudent(student)} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                                                            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <h3 className="font-bold text-[#1d1d1f] truncate group-hover:text-blue-600 transition-colors">{student.displayName || 'Unknown Student'}</h3>
                                                            <p className="text-xs text-[#86868b] truncate">{student.email}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                                                                <span className="text-xs font-medium text-gray-600">{isActive ? 'Online' : 'Offline'}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="border-t border-gray-100 pt-4">
                                                        {activeProject ? (
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <div className="text-xs text-[#86868b] uppercase tracking-wide font-semibold mb-1">当前任务</div>
                                                                    <div className="text-sm font-medium text-[#1d1d1f] truncate">{activeProject.title}</div>
                                                                </div>

                                                                <div className="flex justify-between items-center">
                                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${activeProject.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' : activeProject.status === 'graded' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                                                                        {activeProject.status === 'submitted' ? '待评分' : activeProject.status === 'graded' ? '已完成' : '进行中'}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">
                                                                        自评: <strong className="text-black">{activeProject.selfScore || '-'}</strong>
                                                                    </span>
                                                                </div>

                                                                <div className="mt-2 text-center">
                                                                    <span className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors pointer-events-none">点击查看详细档案 &rarr;</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-6 text-sm text-[#86868b] italic">
                                                                暂无进行中的实验
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    {Object.values(users).filter(u => u.role !== 'teacher').length === 0 && (
                                        <div className="col-span-full py-20 text-center text-[#86868b]">
                                            暂无学生数据。
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* STUDENT PORTFOLIO VIEW */}
                                <div className="mb-6 flex items-center gap-4">
                                    <button
                                        onClick={() => setSelectedStudent(null)}
                                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                                    >
                                        ←
                                    </button>
                                    <div>
                                        <h2 className="text-2xl font-bold flex items-center gap-3">
                                            {selectedStudent.displayName || selectedStudent.email}
                                            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">学生档案</span>
                                        </h2>
                                        <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-[#1d1d1f]">所有实验记录</h3>
                                    <div className="grid gap-4">
                                        {projects.filter(p => p.ownerId === selectedStudent.uid || p.owner === selectedStudent.email).length > 0 ? (
                                            projects
                                                .filter(p => p.ownerId === selectedStudent.uid || p.owner === selectedStudent.email)
                                                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                                                .map(project => (
                                                    <div
                                                        key={project.id}
                                                        onClick={() => navigate(`/snapshot/${project.id}`)}
                                                        className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between group"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <h4 className="text-lg font-bold text-[#1d1d1f] group-hover:text-blue-600 transition-colors">{project.title}</h4>
                                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${project.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' :
                                                                    project.status === 'graded' ? 'bg-green-100 text-green-700' :
                                                                        'bg-blue-50 text-blue-600'
                                                                    }`}>
                                                                    {project.status === 'submitted' ? '待评分' :
                                                                        project.status === 'graded' ? '已完成' :
                                                                            '进行中'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-6 text-sm text-gray-500">
                                                                <span>创建时间: {project.createdAt ? new Date(project.createdAt.seconds * 1000).toLocaleDateString() : '-'}</span>
                                                                <span>最近更新: {project.updatedAt ? new Date(project.updatedAt.seconds * 1000).toLocaleString() : '-'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right">
                                                                <div className="text-xs text-gray-400 uppercase tracking-wide">自评分</div>
                                                                <div className="font-bold text-lg">{project.selfScore || '-'}</div>
                                                            </div>
                                                            <div className="text-right border-l border-gray-100 pl-6">
                                                                <div className="text-xs text-gray-400 uppercase tracking-wide">教师评分</div>
                                                                <div className={`font-bold text-lg ${project.teacherScore ? 'text-green-600' : 'text-gray-300'}`}>
                                                                    {project.teacherScore || '-'}
                                                                </div>
                                                            </div>
                                                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                                →
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                                                该学生暂无实验记录
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

            </div>

            {/* Task Publishing Modal (Reused) */}
            {
                isTaskModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
                        >
                            <div className="p-8">
                                <h2 className="text-2xl font-bold text-[#1d1d1f] mb-6 flex items-center gap-2">
                                    <span>🚀</span> 发布新学习任务
                                </h2>
                                <form onSubmit={handlePublish} className="flex flex-col gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-[#86868b] mb-2">任务名称</label>
                                        <input
                                            className="w-full rounded-xl border border-apple-border bg-gray-50 px-4 py-3 text-[#1d1d1f] outline-none focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10 transition-all"
                                            placeholder="例如：线性回归基础实验"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#86868b] mb-2">任务详情/描述</label>
                                        <textarea
                                            className="w-full rounded-xl border border-apple-border bg-gray-50 px-4 py-3 text-[#1d1d1f] outline-none focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10 transition-all min-h-[120px] resize-none"
                                            placeholder="请描述实验目标和要求..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>

                                    {/* Dataset Selection Section */}
                                    <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-[#d2d2d7]">
                                        <label className="block text-sm font-medium text-[#86868b] mb-3">关联数据集</label>

                                        <div className="flex gap-4 mb-4">
                                            <button
                                                type="button"
                                                onClick={() => setDatasetMode('builtin')}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${datasetMode === 'builtin'
                                                    ? 'bg-white shadow-sm text-[#0071e3] border border-[#d2d2d7]'
                                                    : 'text-[#86868b] hover:bg-white/50'
                                                    }`}
                                            >
                                                使用内置数据
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDatasetMode('custom')}
                                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${datasetMode === 'custom'
                                                    ? 'bg-white shadow-sm text-[#0071e3] border border-[#d2d2d7]'
                                                    : 'text-[#86868b] hover:bg-white/50'
                                                    }`}
                                            >
                                                上传自定义数据
                                            </button>
                                        </div>

                                        {datasetMode === 'builtin' ? (
                                            <div className="relative">
                                                <select
                                                    value={dataset}
                                                    onChange={(e) => setDataset(e.target.value)}
                                                    className="w-full appearance-none rounded-xl border border-apple-border bg-white px-4 py-3 text-[#1d1d1f] outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/10 transition-all text-sm"
                                                >
                                                    <option value="Iris">Iris (鸢尾花数据集)</option>
                                                    <option value="Boston">Boston (波士顿房价)</option>
                                                    <option value="Titanic">Titanic (泰坦尼克号)</option>
                                                    <option value="MNIST">MNIST (手写数字)</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868b]">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative group">
                                                <input
                                                    type="file"
                                                    accept=".csv,.xlsx"
                                                    onChange={(e) => setCustomFile(e.target.files[0])}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                />
                                                <div className={`w-full rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all ${customFile ? 'border-[#0071e3] bg-blue-50/50' : 'border-[#d2d2d7] bg-white group-hover:bg-gray-50'
                                                    }`}>
                                                    {customFile ? (
                                                        <div className="flex items-center justify-center gap-2 text-[#0071e3]">
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            <span className="text-sm font-medium truncate max-w-[200px]">{customFile.name}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[#86868b]">
                                                            <p className="text-sm font-medium">点击上传文件</p>
                                                            <p className="text-[10px] mt-1">支持 CSV, Excel</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-4 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsTaskModalOpen(false)}
                                            className="flex-1 rounded-full border border-apple-border bg-white py-3 font-medium text-[#1d1d1f] hover:bg-gray-50 active:scale-[0.98] transition-all"
                                        >
                                            取消
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isPublishing || !title.trim() || (datasetMode === 'custom' && !customFile)}
                                            className="flex-1 rounded-full bg-apple-blue py-3 font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-[#0077ED] active:scale-[0.98] disabled:opacity-50 transition-all"
                                        >
                                            {isPublishing ? '发布中...' : '立即发布'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )
            }
        </div >
    );
}
