// src/components/LoginView.jsx
import { useState } from "react";

const API_PREFIX = "/api"; // 和后端反向代理一致

export default function LoginView({ onLogin }) {
  const [username, setUsername] = useState("");
  const [loadingAction, setLoadingAction] = useState(null); // "register" | "login" | null
  const [errorMsg, setErrorMsg] = useState("");

  async function callAuthApi(path) {
    const name = username.trim();
    if (!name) {
      setErrorMsg("请输入用户名");
      return;
    }

    setErrorMsg("");
    setLoadingAction(path === "/auth/register" ? "register" : "login");
    try {
      const res = await fetch(`${API_PREFIX}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        // 尝试从后端 detail / message 里拿错误
        const detail =
          data.detail ||
          data.message ||
          (res.status === 409
            ? "该用户名已被注册"
            : res.status === 404
            ? "该用户名尚未注册，请先注册"
            : "请求失败，请稍后再试");
        setErrorMsg(detail);
        return;
      }

      const user = data.user;
      if (!user) {
        setErrorMsg("返回数据异常");
        return;
      }

      // 简单存一份本地，方便后续使用
      try {
        localStorage.setItem("mv_user", JSON.stringify(user));
      } catch (e) {
        console.warn("save user to localStorage error:", e);
      }

      // 通知父组件：登录成功
      if (onLogin) {
        onLogin(user);
      }
    } catch (err) {
      console.error("auth error:", err);
      setErrorMsg("网络错误，请稍后重试");
    } finally {
      setLoadingAction(null);
    }
  }

  const registering = loadingAction === "register";
  const logining = loadingAction === "login";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: 'url("/images/login-map.png")', // 根据你的路径调整
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 80,
      }}
    >
      {/* 半透明遮罩，弱化背景，让输入框更清晰 */}
      <div
        style={{
          backdropFilter: "blur(6px)",
          background: "rgba(0, 0, 0, 0.45)",
          borderRadius: 16,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          padding: "16px 20px 14px",
          width: "min(420px, 90vw)",
          color: "#fff",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          心情农场 · 入口
        </div>
        <div
          style={{
            fontSize: 13,
            opacity: 0.85,
            marginBottom: 12,
          }}
        >
          请输入一个用户名，用来在农场里标记你的足迹。
          用户名全局唯一，先注册成功后才能使用登录。
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="例如：小麦田、StardewFan"
            maxLength={20}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              padding: "0 10px",
              outline: "none",
              background: "rgba(5,5,10,0.85)",
              color: "#fff",
              fontSize: 14,
            }}
          />
        </div>

        {errorMsg && (
          <div
            style={{
              fontSize: 12,
              color: "#ffb3b3",
              marginBottom: 8,
              minHeight: 16,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            disabled={registering || logining}
            onClick={() => callAuthApi("/auth/register")}
            style={{
              minWidth: 80,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: registering ? "#777" : "rgba(255, 204, 102, 1)",
              color: "#402000",
              fontWeight: 600,
              fontSize: 13,
              cursor: registering || logining ? "default" : "pointer",
            }}
          >
            {registering ? "注册中…" : "注册"}
          </button>
          <button
            type="button"
            disabled={registering || logining}
            onClick={() => callAuthApi("/auth/login")}
            style={{
              minWidth: 80,
              height: 32,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.5)",
              background: logining ? "rgba(0,0,0,0.4)" : "transparent",
              color: "#fff",
              fontWeight: 500,
              fontSize: 13,
              cursor: registering || logining ? "default" : "pointer",
            }}
          >
            {logining ? "登录中…" : "登录"}
          </button>
        </div>
      </div>
    </div>
  );
}