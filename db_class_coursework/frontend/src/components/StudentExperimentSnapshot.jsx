import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-dark.css';

export default function StudentExperimentSnapshot() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [code, setCode] = useState('');
    const [logs, setLogs] = useState([]);
    const [teacherScore, setTeacherScore] = useState('');

    useEffect(() => {
        if (!id) return;
        async function fetchProject() {
            try {
                const docRef = doc(db, 'projects', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setProject({ id: docSnap.id, ...data });
                    setCode(data.latest_code || '# No code found');
                    setTeacherScore(data.teacherScore || '');
                } else {
                    alert("Project not found");
                    navigate('/teacher-dashboard');
                }
            } catch (err) {
                console.error(err);
                navigate('/teacher-dashboard');
            }
        }
        fetchProject();
    }, [id, navigate]);

    // Logs Listener
    useEffect(() => {
        const q = query(collection(db, 'experiment_results'), where('experimentId', '==', id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newLogs = snapshot.docs.map(doc => doc.data()).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setLogs(newLogs);
        });
        return () => unsubscribe();
    }, [id]);

    const handleGrade = async () => {
        if (!project) return;
        try {
            await updateDoc(doc(db, 'projects', id), {
                teacherScore: Number(teacherScore),
                status: 'graded'
            });
            alert('评分保存成功');
            setProject(prev => ({ ...prev, teacherScore: Number(teacherScore), status: 'graded' }));
        } catch (e) {
            console.error(e);
            alert('评分失败');
        }
    };

    const handleDelete = async () => {
        if (window.confirm("确定要删除该学生的实验记录吗？")) {
            await deleteDoc(doc(db, 'projects', id));
            navigate('/teacher-dashboard');
        }
    };

    if (!project) return <div className="p-10 text-center">Loading snapshot...</div>;

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col font-sans text-[#1d1d1f]">
            {/* Header */}
            <header className="bg-[#1d1d1f] text-white px-6 py-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/teacher-dashboard')} className="text-white/80 hover:text-white flex items-center gap-1 font-medium">
                        ← 返回监控台
                    </button>
                    <div className="h-6 w-px bg-white/20 mx-2"></div>
                    <div>
                        <h1 className="text-lg font-bold">{project.title}</h1>
                        <div className="text-xs text-white/50 flex items-center gap-2">
                            <span>Student: {project.owner || 'Unknown'}</span>
                            <span className="bg-blue-500/20 text-blue-300 px-1.5 rounded uppercase font-bold tracking-wider">Snapshot View</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDelete} className="bg-red-500/20 text-red-300 hover:bg-red-500/30 px-3 py-1.5 rounded text-sm transition-colors">
                        删除记录
                    </button>
                </div>
            </header>

            <div className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Code Snapshot */}
                <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-sm flex flex-col h-[80vh]">
                    <div className="px-4 py-2 bg-[#2d2d2d] border-b border-black/20 text-xs text-gray-400 font-mono">
                        LATEST CODE SNAPSHOT
                    </div>
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                        <Editor
                            value={code}
                            onValueChange={() => { }}
                            highlight={code => highlight(code, languages.python)}
                            padding={10}
                            style={{
                                fontFamily: '"Fira Code", monospace',
                                fontSize: 13,
                                backgroundColor: 'transparent',
                                color: '#f8f8f2', // Ensure text is visible
                                minHeight: '100%',
                                pointerEvents: 'none' // Strict Read-Only
                            }}
                        />
                    </div>
                </div>

                {/* Right: Results & Grading */}
                <div className="space-y-6 flex flex-col h-[80vh]">
                    {/* Grading Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100 flex flex-col gap-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">教师评分 (Grading)</h2>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="block text-xs text-gray-400 mb-1">Student Self-Score</label>
                                <div className="text-2xl font-bold text-gray-800">{project.selfScore || 'N/A'}</div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-gray-400 mb-1">Teacher Score</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={teacherScore}
                                        onChange={e => setTeacherScore(e.target.value)}
                                        className="w-20 px-2 py-1 text-xl font-bold border-b-2 border-orange-200 focus:border-orange-500 outline-none bg-transparent"
                                        placeholder="-"
                                    />
                                    <span className="text-gray-400">/ 100</span>
                                </div>
                            </div>
                            <button
                                onClick={handleGrade}
                                className="bg-black text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md hover:scale-105 transition-transform"
                            >
                                保存评分
                            </button>
                        </div>
                    </div>

                    {/* Logs Output */}
                    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                            Execution Logs & Results
                        </div>
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {logs.length === 0 && <div className="text-center text-gray-400 italic py-10">No execution logs found.</div>}
                            {logs.map((log, i) => (
                                <div key={i} className="bg-gray-50 rounded-lg p-3 text-xs border border-gray-100">
                                    <div className="flex justify-between mb-2 text-gray-400">
                                        <span>Run #{logs.length - i}</span>
                                        <span>{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : ''}</span>
                                    </div>
                                    {log.output && <pre className="font-mono bg-white p-2 rounded border border-gray-200 mb-2 overflow-x-auto">{log.output}</pre>}
                                    {log.image && <img src={`data:image/png;base64,${log.image}`} className="max-w-full rounded border border-gray-200" />}
                                    {log.error && <pre className="text-red-500 font-mono bg-red-50 p-2 rounded">{log.error}</pre>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
