import React, { useState, useEffect } from "react";
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy,
    getDoc,
    setDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import ProjectCard from "./ProjectCard";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function Workspace() {
    const nav = useNavigate();
    const { currentUser, logout } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Settings Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [savingSettings, setSavingSettings] = useState(false);
    const [isUsernameRequired, setIsUsernameRequired] = useState(false);

    // Fetch User Profile on Mount
    useEffect(() => {
        if (!currentUser) return;

        // Immediate Redirect for Teacher by Email
        if (currentUser.email === "teacher@system.local") {
            nav("/teacher-dashboard");
            return;
        }

        async function fetchProfile() {
            try {
                const docRef = doc(db, "users", currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Redirect Teacher immediately
                    if (data.role === "teacher") {
                        nav("/teacher-dashboard");
                        return;
                    }

                    if (data.displayName) {
                        setDisplayName(data.displayName || "");
                        // Profile exists but no name?
                        // setIsUsernameRequired(true); // User requested to remove this mandatory block
                    }
                } else {
                    // No Firestore doc yet
                    if (currentUser.displayName) {
                        // Optimistically use Auth profile name and sync to Firestore
                        setDisplayName(currentUser.displayName);
                        await setDoc(docRef, {
                            displayName: currentUser.displayName,
                            email: currentUser.email,
                            createdAt: serverTimestamp(),
                            lastActive: serverTimestamp(),
                            isOnline: true,
                            role: 'student'
                        });
                    } else {
                        // No name in Auth either -> Force setup
                        // setIsUsernameRequired(true); // User requested to remove this mandatory block
                    }
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            }
        }
        fetchProfile();

        // Heartbeat (Presence System)
        const heartbeat = setInterval(() => {
            setDoc(doc(db, "users", currentUser.uid), {
                lastActive: serverTimestamp(),
                isOnline: true
            }, { merge: true });
        }, 30000); // 30 seconds

        // Immediate update on mount
        setDoc(doc(db, "users", currentUser.uid), {
            lastActive: serverTimestamp(),
            isOnline: true
        }, { merge: true });

        return () => clearInterval(heartbeat);
    }, [currentUser]);

    // Real-time listener: My Projects
    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "projects"),
            where("ownerId", "==", currentUser.uid)
            // Removed orderBy to prevent index requirement issues. We sort client-side.
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            // Client-side sort: Newest first
            projectsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            setProjects(projectsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching projects:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Real-time listener: Published Assignments (Teachers)
    useEffect(() => {
        const q = query(
            collection(db, "assignments"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAssignments(data);
        });
        return () => unsubscribe();
    }, []);

    async function handleStartAssignment(assignment) {
        if (!confirm(`确定要开始任务 "${assignment.title}" 吗？这将会为您创建一个新的实验项目。`)) return;

        try {
            await addDoc(collection(db, "projects"), {
                title: assignment.title, // Copy title
                description: assignment.description, // Copy desc
                dataset: assignment.dataset, // Copy dataset setting
                status: "In Progress",
                ownerId: currentUser.uid,
                createdAt: serverTimestamp(),
                assignmentId: assignment.id // Link back to assignment
            });
        } catch (error) {
            console.error("Error starting assignment:", error);
            alert("创建失败: " + error.message);
        }
    }

    async function handleLogout() {
        try {
            // Set offline
            await setDoc(doc(db, "users", currentUser.uid), {
                isOnline: false,
                lastActive: serverTimestamp()
            }, { merge: true });

            await logout();
            nav("/login");
        } catch (error) {
            console.error("Logout failed", error);
        }
    }

    async function handleCreateProject(e) {
        e.preventDefault();
        if (!newTitle.trim()) return;

        try {
            await addDoc(collection(db, "projects"), {
                title: newTitle,
                description: newDesc,
                status: "In Progress",
                ownerId: currentUser.uid,
                createdAt: serverTimestamp(),
            });
            setNewTitle("");
            setNewDesc("");
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error creating project:", error);
            alert("创建失败: " + error.message);
        }
    }

    async function handleDeleteProject(id, e) {
        e.stopPropagation(); // Prevent navigation when deleting
        if (window.confirm("确定要删除此实验项目吗？")) {
            try {
                await deleteDoc(doc(db, "projects", id));
            } catch (error) {
                console.error("Error deleting project:", error);
            }
        }
    }

    async function handleSaveSettings(e) {
        e.preventDefault();
        setSavingSettings(true);
        try {
            await setDoc(doc(db, "users", currentUser.uid), {
                displayName: displayName,
                email: currentUser.email,
                lastActive: serverTimestamp()
            }, { merge: true });
            setIsSettingsOpen(false);
            setIsUsernameRequired(false); // Clear required flag
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("保存失败: " + error.message);
        } finally {
            setSavingSettings(false);
        }
    }

    return (
        <div className="min-h-screen bg-apple-bg p-6 sm:p-10 font-sans">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-[34px] font-bold text-[#1d1d1f] tracking-tight">我的实验空间</h1>
                        <p className="text-apple-gray mt-1">
                            {displayName ? `你好，${displayName}` : "管理您的实验项目"}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors rounded-full hover:bg-gray-100"
                            title="设置"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="text-[#0071e3] font-medium hover:underline text-sm"
                        >
                            退出登录
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 rounded-full bg-apple-blue px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-[#0077ED] hover:scale-105 active:scale-95"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            新建实验
                        </button>
                    </div>
                </div>

                {/* ASSIGNMENTS SECTION */}
                {/* ASSIGNMENTS SECTION */}
                {assignments.length > 0 && (
                    <div className="mb-12">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-[#1d1d1f]">最新发布的任务</h2>
                            <div className="bg-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm border border-[#d2d2d7]/50 flex items-center gap-2 w-64">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="搜索实验..."
                                    className="flex-1 outline-none bg-transparent"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {assignments.map(assign => (
                                <div key={assign.id} className="bg-white p-6 rounded-2xl shadow-sm border border-[#d2d2d7]/40 hover:shadow-md transition-all relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <svg className="w-16 h-16 text-[#0071e3]" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>
                                    </div>
                                    <h3 className="font-bold text-lg text-[#1d1d1f] pr-8">{assign.title}</h3>
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-medium mt-2 mb-3 border border-blue-100">
                                        数据集: {assign.dataset}
                                    </span>
                                    <p className="text-sm text-[#86868b] line-clamp-2 mb-6 h-10">
                                        {assign.description || "暂无描述"}
                                    </p>
                                    <button
                                        onClick={() => handleStartAssignment(assign)}
                                        className="w-full py-2 rounded-lg bg-[#f5f5f7] text-[#0071e3] text-sm font-medium hover:bg-[#0071e3] hover:text-white transition-all"
                                    >
                                        开始实验
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )} {/* Project Grid Headline */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[#1d1d1f]">我的实验项目</h2>
                </div>

                {/* Project Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                        {projects
                            .filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map((project) => (
                                <div key={project.id} onClick={() => nav(`/experiment/${project.id}`)} className="cursor-pointer">
                                    <ProjectCard
                                        project={project}
                                        onDelete={handleDeleteProject}
                                    />
                                </div>
                            ))}
                    </AnimatePresence>
                </div>

                {/* Empty State */}
                {!loading && projects.length === 0 && (
                    <div className="mt-20 flex flex-col items-center justify-center text-center">
                        <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center mb-6">
                            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-[#1d1d1f]">暂无实验</h3>
                        <p className="mt-2 max-w-sm text-[#86868b]">
                            创建您的第一个实验项目以开始收集和分析数据。
                        </p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="mt-8 text-apple-blue font-medium hover:underline"
                        >
                            创建新实验
                        </button>
                    </div>
                )}

                {/* Blocking Username Setup Modal */}
                {isUsernameRequired && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl p-8">
                            <div className="mb-6 text-center">
                                <h2 className="text-2xl font-bold text-[#1d1d1f]">欢迎加入 DB.Class</h2>
                                <p className="text-[#86868b] mt-2">为了开始您的实验之旅，请先设置一个用户名。</p>
                            </div>
                            <form onSubmit={handleSaveSettings} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-[#86868b] mb-2">用户名 (显示名称)</label>
                                    <input
                                        className="w-full rounded-xl border border-apple-border bg-gray-50 px-4 py-3 text-[#1d1d1f] outline-none focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10 transition-all font-bold text-lg text-center"
                                        placeholder="例如: 张三"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <button
                                    disabled={!displayName.trim() || savingSettings}
                                    className="w-full rounded-xl bg-[#0071e3] py-3.5 text-white font-medium shadow-lg shadow-blue-500/30 hover:bg-[#0077ED] active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none"
                                >
                                    {savingSettings ? "保存中..." : "开始使用"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Create Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
                        >
                            <div className="p-8">
                                <h2 className="text-2xl font-bold text-[#1d1d1f] mb-6">新建实验</h2>
                                <form onSubmit={handleCreateProject} className="flex flex-col gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-[#86868b] mb-2">实验标题</label>
                                        <input
                                            className="w-full rounded-xl border border-apple-border bg-gray-50 px-4 py-3 text-[#1d1d1f] outline-none focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10 transition-all"
                                            placeholder="实验名称"
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#86868b] mb-2">描述</label>
                                        <textarea
                                            placeholder="简要描述您的研究目标..."
                                            className="w-full rounded-xl border border-apple-border bg-gray-50 px-4 py-3 text-[#1d1d1f] outline-none focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10 transition-all min-h-[100px] resize-none"
                                            value={newDesc}
                                            onChange={(e) => setNewDesc(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-4 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 rounded-full border border-apple-border bg-white py-3 font-medium text-[#1d1d1f] hover:bg-gray-50 active:scale-[0.98] transition-all"
                                        >
                                            取消
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!newTitle.trim()}
                                            className="flex-1 rounded-full bg-apple-blue py-3 font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-[#0077ED] active:scale-[0.98] disabled:opacity-50 transition-all"
                                        >
                                            创建
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Settings Modal */}
                {isSettingsOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
                        >
                            <div className="p-8">
                                <h2 className="text-2xl font-bold text-[#1d1d1f] mb-6">个人设置</h2>
                                <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-[#86868b] mb-2">显示名称</label>
                                        <input
                                            className="w-full rounded-xl border border-apple-border bg-gray-50 px-4 py-3 text-[#1d1d1f] outline-none focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10 transition-all"
                                            placeholder="请输入真实姓名"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            autoFocus
                                        />
                                        <p className="mt-2 text-xs text-[#86868b]">该名称将显示在教师的监控列表中。</p>
                                    </div>
                                    <div className="flex gap-4 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsSettingsOpen(false)}
                                            className="flex-1 rounded-full border border-apple-border bg-white py-3 font-medium text-[#1d1d1f] hover:bg-gray-50 active:scale-[0.98] transition-all"
                                        >
                                            取消
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={savingSettings || !displayName.trim()}
                                            className="flex-1 rounded-full bg-apple-blue py-3 font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-[#0077ED] active:scale-[0.98] disabled:opacity-50 transition-all"
                                        >
                                            {savingSettings ? "保存中..." : "保存"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
