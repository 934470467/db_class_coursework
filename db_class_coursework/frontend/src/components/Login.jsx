import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLogin, setIsLogin] = useState(true);
    const [role, setRole] = useState("student"); // 'student' | 'teacher'
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { signup, login, googleSignIn } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (role === "teacher") {
            // Hardcoded Teacher Verification
            if (email === "admin" && password === "admin123456") {
                try {
                    // Shadow Login: Authenticate as a special "teacher" user in Firebase
                    // to satisfy "allow read: if request.auth != null" rules.
                    const shadowEmail = "teacher@system.local";
                    const shadowPwd = "teacher_secure_access_key_2024";

                    try {
                        await login(shadowEmail, shadowPwd);
                    } catch (loginErr) {
                        // If teacher account doesn't exist, create it once
                        if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
                            await signup(shadowEmail, shadowPwd);
                            // Need to sign out and sign in? Signup usually signs in automatically.
                        } else {
                            throw loginErr;
                        }
                    }

                    navigate("/teacher-dashboard");
                } catch (err) {
                    console.error("Teacher Shadow Auth failed", err);
                    setLoading(false);
                    // Fallback: If firebase fails, maybe we still navigate? 
                    // But then Firestore will fail. Better to show error.
                    setError("教师端系统认证失败，请联系管理员");
                }
            } else {
                console.log("Admin auth failed");
                setLoading(false);
            }
            return;
        }

        // Student Logic (Firebase)
        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await signup(email, password);
            }
            navigate("/workspace");
        } catch (err) {
            console.error(err);
            setError("验证失败，请检查账号密码");
        }
        setLoading(false);
    }

    async function handleGoogleSignIn() {
        try {
            setError("");
            setLoading(true);
            await googleSignIn();
            navigate("/workspace");
        } catch (err) {
            console.error(err);
            setError("Google 登录失败");
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] p-4 font-sans animate-fade-in">
            <div className="w-full max-w-[440px] px-8 py-10 sm:px-12 bg-white rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.08)]">

                <div className="mb-8 text-center">
                    <h2 className="text-[28px] font-bold tracking-tight text-[#1d1d1f] mb-6">
                        {role === "teacher" ? "教师入口" : "数据科学教学平台"}
                    </h2>

                    {/* Role Segmented Control */}
                    <div className="inline-flex bg-[#f5f5f7] p-1 rounded-lg w-full mb-2">
                        <button
                            onClick={() => { setRole("student"); setError(""); }}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${role === "student"
                                ? "bg-white text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:text-[#1d1d1f]"
                                }`}
                        >
                            学生
                        </button>
                        <button
                            onClick={() => { setRole("teacher"); setError(""); }}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${role === "teacher"
                                ? "bg-white text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:text-[#1d1d1f]"
                                }`}
                        >
                            教师
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="group relative">
                        <input
                            type={role === "teacher" ? "text" : "email"}
                            required
                            className="peer w-full rounded-xl border border-[#d2d2d7] bg-transparent px-4 pt-6 pb-2 text-[17px] text-[#1d1d1f] outline-none transition-all focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/10"
                            placeholder=" "
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <label className="absolute left-4 top-4 text-[15px] text-[#86868b] transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-[17px] peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-[#0071e3] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]">
                            {role === "teacher" ? "管理员账号" : "电子邮箱"}
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

                    <button
                        disabled={loading}
                        className="w-full rounded-full bg-[#0071e3] py-3 text-[17px] font-medium text-white transition-transform hover:bg-[#0077ED] active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
                    >
                        {loading ? <div className="h-5 w-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : "继续"}
                    </button>
                </form>

                {role === "student" && (
                    <>
                        <div className="my-6 border-t border-[#d2d2d7]/30 relative">
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-[#86868b]">或</span>
                        </div>

                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="group flex w-full items-center justify-center gap-3 rounded-full border border-[#d2d2d7] bg-white py-3 text-[17px] text-[#1d1d1f] transition-all hover:bg-gray-50 active:bg-gray-100 active:scale-[0.99]"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            通过 Google 继续
                        </button>
                    </>
                )}

                {role === "student" && (
                    <div className="mt-8 text-center text-[13px] text-[#86868b]">
                        尚未拥有账号?
                        <button
                            onClick={() => navigate('/register')}
                            className="text-[#0071e3] hover:underline ml-1"
                        >
                            点击注册
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
