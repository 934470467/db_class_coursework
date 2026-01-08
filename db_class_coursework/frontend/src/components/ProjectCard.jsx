import React from "react";
import { motion } from "framer-motion";

export default function ProjectCard({ project, onDelete }) {
    const statusColors = {
        "In Progress": "bg-yellow-100 text-yellow-700",
        "Completed": "bg-green-100 text-green-700",
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4, boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.1)" }}
            transition={{ duration: 0.2 }}
            className="group relative flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm shadow-black/5 border border-transparent hover:border-black/5 transition-all h-[180px]"
        >
            <div>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="text-xl font-semibold text-[#1d1d1f] line-clamp-1 group-hover:text-[#0071e3] transition-colors">
                            {project.title}
                        </h3>
                        <p className="mt-2 text-sm text-[#86868b] line-clamp-2 leading-relaxed">
                            {project.description || "暂无描述"}
                        </p>
                    </div>
                    <button
                        onClick={(e) => onDelete(project.id, e)} // Pass event to stop propagation
                        className="ml-4 rounded-full p-2 text-[#86868b] opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 z-10 relative" // Added z-index and relative position
                        title="删除实验"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                        </svg>
                    </button>
                </div>

            </div>
            <div className="mt-auto flex flex-wrap gap-2 items-center justify-between w-full">
                <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[project.status] || "bg-gray-100 text-gray-800"
                        }`}
                >
                    {project.status === "In Progress" ? "进行中" : "已完成"}
                </span>
                <span className="text-xs text-[#86868b]">
                    {project.createdAt?.seconds ? new Date(project.createdAt.seconds * 1000).toLocaleDateString() : '刚刚'}
                </span>
            </div>
        </motion.div>
    );
}
