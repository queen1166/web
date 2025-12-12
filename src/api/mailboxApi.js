// src/api/mailboxApi.js

const API_PREFIX = "/api";

/**
 * 获取 mailbox 列表，同时在后端触发：
 * - 扫描 moods
 * - 为符合条件的负向心情生成安慰信
 */
export async function fetchMails() {
  const resp = await fetch(`${API_PREFIX}/mailbox/refresh-and-list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}), // 当前接口不需要参数
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `fetchMails bad status: ${resp.status} ${resp.statusText} ${text}`
    );
  }

  const data = await resp.json();
  const mails = Array.isArray(data.mails) ? data.mails : [];
  return mails;
}

/**
 * 标记一封信为已读（可选，用来在 UI 里显示已读状态）
 */
export async function markMailRead(id) {
  if (!id) return;

  const resp = await fetch(`${API_PREFIX}/mailbox/mark-read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `markMailRead bad status: ${resp.status} ${resp.statusText} ${text}`
    );
  }

  const data = await resp.json();
  return Boolean(data.ok);
}