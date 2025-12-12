// src/components/MailboxPanel.jsx
import { useEffect, useState } from "react";
import { fetchMails, markMailRead } from "../api/mailboxApi";

export default function MailboxPanel({ open, onClose }) {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeId, setActiveId] = useState(null);

  // 打开时加载信件列表
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        const list = await fetchMails();
        if (cancelled) return;

        setMails(list);

        // 如果当前没有选中的邮件，默认选中第一封
        if (list.length > 0 && !activeId) {
          setActiveId(list[0].id);
        }
      } catch (err) {
        console.error("fetchMails error:", err);
        if (!cancelled) {
          setErrorMsg("获取信箱内容时遇到了一点问题，请稍后再试。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // 打开时重新加载

  if (!open) return null;

  const activeMail = mails.find((m) => m.id === activeId) || null;

  async function handleSelectMail(mail) {
    setActiveId(mail.id);

    // 如果是未读，则尝试标记为已读并更新本地状态
    if (mail.unread) {
      try {
        const ok = await markMailRead(mail.id);
        if (ok) {
          setMails((prev) =>
            prev.map((m) => (m.id === mail.id ? { ...m, unread: false } : m))
          );
        }
      } catch (err) {
        console.error("markMailRead error:", err);
        // 标记失败也不影响阅读，只是不更新未读状态
      }
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
      }}
    >
      <div
        style={{
          width: 640,
          maxWidth: "95%",
          maxHeight: "82%",
          background: "rgba(21,21,34,0.97)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          padding: "16px 18px 14px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.75)",
          color: "#fff",
          fontSize: 13,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              心情邮局 · Mailbox
            </div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              把一些话寄给过去、现在和未来的自己。
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "#ccc",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 错误 / loading 提示 */}
        {loading && (
          <div
            style={{
              fontSize: 12,
              opacity: 0.9,
              marginBottom: 6,
            }}
          >
            正在整理你的来信，请稍候……
          </div>
        )}
        {errorMsg && (
          <div
            style={{
              fontSize: 12,
              color: "#ffb3b3",
              marginBottom: 6,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* 主体：左侧列表 + 右侧正文 */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.7fr)",
            gap: 10,
            minHeight: 0,
          }}
        >
          {/* 左侧：列表 */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              padding: 8,
              overflowY: "auto",
            }}
          >
            {mails.length === 0 && !loading && (
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  opacity: 0.85,
                  textAlign: "center",
                }}
              >
                这里暂时还没有来信。
                <br />
                如果你在难过的时候记录过心情，
                到第二天凌晨四点之后再来看看，或许会有一些回信在等你。
              </div>
            )}

            {mails.map((mail) => {
              const isActive = mail.id === activeId;
              const preview =
                (mail.content || "").replace(/\s+/g, " ").slice(0, 40) +
                (mail.content && mail.content.length > 40 ? "..." : "");

              return (
                <div
                  key={mail.id}
                  onClick={() => handleSelectMail(mail)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    marginBottom: 6,
                    cursor: "pointer",
                    background: isActive
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.25)",
                    border: isActive
                      ? "1px solid rgba(255,255,255,0.25)"
                      : "1px solid transparent",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {/* 未读小圆点 */}
                      {mail.unread && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: "rgba(255,204,102,1)",
                            display: "inline-block",
                          }}
                        />
                      )}
                      {mail.title || "农场的来信"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.75,
                        marginLeft: 8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {mail.created_at
                        ? mail.created_at.replace("T", " ").slice(0, 16)
                        : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{preview}</div>
                </div>
              );
            })}
          </div>

          {/* 右侧：正文 */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(0,0,0,0.35)",
              padding: "10px 12px",
              overflowY: "auto",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {!activeMail && (
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.85,
                  textAlign: "center",
                  marginTop: 20,
                }}
              >
                左边是你的来信列表，点开一封，就可以在这里阅读完整内容。
              </div>
            )}

            {activeMail && (
              <>
                <div
                  style={{
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {activeMail.title || "来自稻草人的来信"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    {activeMail.created_at
                      ? activeMail.created_at.replace("T", " ").slice(0, 16)
                      : ""}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.9,
                    marginBottom: 6,
                  }}
                >
                  {activeMail.event || activeMail.emotion ? (
                    <>
                      {activeMail.event && (
                        <div>
                          <span style={{ opacity: 0.75 }}>相关事件：</span>
                          {activeMail.event}
                        </div>
                      )}
                      {activeMail.emotion && (
                        <div>
                          <span style={{ opacity: 0.75 }}>当时心情：</span>
                          {activeMail.emotion}
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ opacity: 0.75 }}>
                      这封信是稻草人根据你的某次记录自动写下的安慰。
                    </span>
                  )}
                </div>

                <hr
                  style={{
                    border: "none",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    margin: "8px 0 10px",
                  }}
                />

                <div style={{ whiteSpace: "pre-wrap" }}>
                  {activeMail.content || "（这封信没有正文。）"}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 底部操作区 */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "#ccc",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            先关上
          </button>
          <button
            type="button"
            style={{
              border: "none",
              background: "rgba(255,204,102,1)",
              color: "#402000",
              fontWeight: 600,
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            写一封信（待实现）
          </button>
        </div>
      </div>
    </div>
  );
}