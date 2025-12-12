// src/App.jsx
import { useEffect, useState } from "react";
import "./App.css";
import LoginView from "./components/LoginView";
import MapView from "./components/MapView";

function App() {
  const [user, setUser] = useState(null); // 当前登录用户
  const [initializing, setInitializing] = useState(true); // 首次加载中

  // 启动时尝试从 localStorage 恢复登录状态
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mv_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        // 简单校验一下结构
        if (parsed && parsed.username) {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.warn("load mv_user from localStorage error:", e);
    } finally {
      setInitializing(false);
    }
  }, []);

  // 登录成功后的回调（LoginView 会调用 onLogin）
  const handleLogin = (userInfo) => {
    setUser(userInfo);
  };

  // 退出登录逻辑
  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem("mv_user");
    } catch (e) {
      console.warn("remove mv_user error:", e);
    }
  };

  // 首次加载时可以什么都不渲染，避免闪一下
  if (initializing) {
    return null;
    // 或者：
    // return <div style={{ color: "#fff" }}>加载中...</div>;
  }

  return (
    <div className="app-root">
      {/* 未登录：展示登录界面 */}
      {!user ? (
        <LoginView onLogin={handleLogin} />
      ) : (
        <>
          {/* 已登录：进入农场主界面 */}
          <MapView currentUser={user} />

          {/* 右上角一个小用户条（可按需保留/删除） */}
          <div
            style={{
              position: "fixed",
              top: 12,
              right: 12,
              zIndex: 1200,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily:
                "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            <span>当前用户：{user.username}</span>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 12,
                cursor: "pointer",
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
            >
              退出
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;