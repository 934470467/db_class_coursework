import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { signup } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();

        if (password !== confirmPassword) {
            return setError("两次输入的密码不一致");
        }

        try {
            setError("");
            setLoading(true);
            await signup(email, password);
            navigate("/");
        } catch (err) {
            console.error(err);
            setError("注册失败: " + err.message);
        }
        setLoading(false);
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] p-4 font-sans animate-fade-in">
            <div className="w-full max-w-[440px] px-8 py-10 sm:px-12 bg-white rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.08)]">

                <div className="mb-8 text-center">
                    <h2 className="text-[28px] font-bold tracking-tight text-[#1d1d1f] mb-2">
                        创建新账号
                    </h2>
                    <p className="text-[#86868b]">
                        已有账号？ <Link to="/login" className="text-[#0071e3] hover:underline">立即登录</Link>
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="group relative">
                        <input
                            type="email"
                            required
                            className="peer w-full rounded-xl border border-[#d2d2d7] bg-transparent px-4 pt-6 pb-2 text-[17px] text-[#1d1d1f] outline-none transition-all focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                            placeholder=" "
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <label className="absolute left-4 top-4 text-[15px] text-[#86868b] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[17px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#0071e3] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]">
                            电子邮箱
                        </label>
                    </div>

                    <div className="group relative">
                        <input
                            type="password"
                            required
                            className="peer w-full rounded-xl border border-[#d2d2d7] bg-transparent px-4 pt-6 pb-2 text-[17px] text-[#1d1d1f] outline-none transition-all focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                            placeholder=" "
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <label className="absolute left-4 top-4 text-[15px] text-[#86868b] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[17px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#0071e3] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]">
                            密码
                        </label>
                    </div>

                    <div className="group relative">
                        <input
                            type="password"
                            required
                            className="peer w-full rounded-xl border border-[#d2d2d7] bg-transparent px-4 pt-6 pb-2 text-[17px] text-[#1d1d1f] outline-none transition-all focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                            placeholder=" "
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <label className="absolute left-4 top-4 text-[15px] text-[#86868b] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[17px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#0071e3] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]">
                            确认密码
                        </label>
                    </div>

                    <button
                        disabled={loading}
                        className="w-full rounded-full bg-[#0071e3] py-3 text-[17px] font-medium text-white transition-transform hover:bg-[#0077ED] active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
                    >
                        {loading ? <div className="h-5 w-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : "注册账号"}
                    </button>
                </form>
            </div>
        </div>
    );
}
