import { useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  Assets,
  Texture,
  Rectangle,
  Sprite,
  Graphics,
} from "pixi.js";
import ScarecrowChat from "./ScarecrowChat";
import MailboxPanel from "./MailboxPanel";

const API_PREFIX = "/api";
const DEFAULT_SCALE = 0.88;

const LS_KEY_HISTORIES = "moodfarm_chat_histories_v1";
const LS_KEY_SHARED = "moodfarm_chat_shared_v1";

function createFlowerSpriteForSlot(slotObj, flowerGid, gidTextureMap) {
  const tex = gidTextureMap.get(flowerGid);
  if (!tex) return null;

  const flowerSprite = new Sprite(tex);
  flowerSprite.anchor.set(0.5, 1.0);

  const cx =
    slotObj.width && slotObj.height ? slotObj.x + slotObj.width / 2 : slotObj.x;
  const cy =
    slotObj.width && slotObj.height ? slotObj.y + slotObj.height : slotObj.y;

  flowerSprite.x = cx;
  flowerSprite.y = cy;

  const BASE_FLOWER_SCALE = 0.45;
  let slotScale = 1;

  if (Array.isArray(slotObj.properties)) {
    const p = slotObj.properties.find((pp) => pp.name === "scale");
    if (p && typeof p.value === "number") slotScale = p.value;
  }

  const randomFactor = 0.9 + Math.random() * 0.2;
  flowerSprite.scale.set(BASE_FLOWER_SCALE * slotScale * randomFactor);
  flowerSprite.zIndex = flowerSprite.y;

  return flowerSprite;
}

function clampMapPosition(x, y, viewW, viewH, mapPixelW, mapPixelH, scale) {
  const w = mapPixelW * scale;
  const h = mapPixelH * scale;

  let minX, maxX, minY, maxY;

  if (w <= viewW) {
    minX = maxX = (viewW - w) / 2;
  } else {
    minX = viewW - w;
    maxX = 0;
  }

  if (h <= viewH) {
    minY = maxY = (viewH - h) / 2;
  } else {
    minY = viewH - h;
    maxY = 0;
  }

  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

function safeLoadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const obj = JSON.parse(raw);
    return obj ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSaveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function ensureHistoriesShape(obj) {
  const base = { scarecrow: [], cat: [], dog: [] };
  if (!obj || typeof obj !== "object") return base;

  const out = { ...base };
  for (const k of Object.keys(base)) {
    const v = obj[k];
    out[k] = Array.isArray(v) ? v : [];
  }
  return out;
}

export default function MapView() {
  const containerRef = useRef(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatCharacter, setChatCharacter] = useState("scarecrow");

  const [histories, setHistories] = useState(() =>
    ensureHistoriesShape(safeLoadJSON(LS_KEY_HISTORIES, null))
  );

  const [sharedMemory, setSharedMemory] = useState(() =>
    safeLoadJSON(LS_KEY_SHARED, {
      lastSpeaker: null,
      lastAt: null,
      lastEvent: "",
      lastEmotion: "",
      lastSummaryText: "",
    })
  );

  const [lastSummary, setLastSummary] = useState(null);
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(false);

  const [mailboxOpen, setMailboxOpen] = useState(false);

  useEffect(() => {
    safeSaveJSON(LS_KEY_HISTORIES, histories);
  }, [histories]);

  useEffect(() => {
    safeSaveJSON(LS_KEY_SHARED, sharedMemory);
  }, [sharedMemory]);

  useEffect(() => {
    let app;
    let destroyed = false;
    let resizeHandler = null;

    let viewW = 0;
    let viewH = 0;
    let mapContainer = null;
    let currentScale = DEFAULT_SCALE;

    const getViewSize = () => {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        return {
          w: rect.width || window.innerWidth,
          h: rect.height || window.innerHeight,
        };
      }
      return { w: window.innerWidth, h: window.innerHeight };
    };

    (async () => {
      app = new Application();

      const initSize = getViewSize();
      viewW = initSize.w;
      viewH = initSize.h;

      await app.init({
        width: viewW,
        height: viewH,
        background: "#000000",
        antialias: true,
      });

      if (!containerRef.current || destroyed) {
        app.destroy(true);
        return;
      }

      containerRef.current.appendChild(app.canvas);

      const res = await fetch("/maps/mood-valley-flower.tmj");
      const mapData = await res.json();

      const tileW = mapData.tilewidth;
      const tileH = mapData.tileheight;
      const mapTilesW = mapData.width;
      const mapTilesH = mapData.height;
      const mapPixelW = mapTilesW * tileW;
      const mapPixelH = mapTilesH * tileH;

      mapContainer = new Container();
      mapContainer.sortableChildren = true;
      app.stage.addChild(mapContainer);

      const normalizePath = (p) => {
        if (!p) return "";
        const fixed = p.replace(/\\/g, "/").replace(/^(\.\.\/)+/, "");
        return "/" + fixed;
      };

      const gidTextureMap = new Map();

      for (const ts of mapData.tilesets) {
        if (ts.image) {
          const imagePath = normalizePath(ts.image);
          const atlas = await Assets.load(imagePath);
          const baseTexture = atlas.baseTexture;

          const tsTileW = ts.tilewidth || tileW;
          const tsTileH = ts.tileheight || tileH;
          const columns = ts.columns || 1;
          const tilecount =
            ts.tilecount || columns * Math.floor(ts.imageheight / tsTileH);

          for (let localId = 0; localId < tilecount; localId++) {
            const col = localId % columns;
            const row = Math.floor(localId / columns);
            const rect = new Rectangle(
              col * tsTileW,
              row * tsTileH,
              tsTileW,
              tsTileH
            );
            const tex = new Texture({ source: baseTexture, frame: rect });
            gidTextureMap.set(ts.firstgid + localId, tex);
          }
        }

        if (Array.isArray(ts.tiles) && ts.tiles.length > 0) {
          for (const t of ts.tiles) {
            if (!t.image) continue;
            const imgPath = normalizePath(t.image);
            const tex = await Assets.load(imgPath);
            gidTextureMap.set(ts.firstgid + (t.id ?? 0), tex);
          }
        }
      }

      const createTileSprite = (gid, x, y) => {
        const tex = gidTextureMap.get(gid);
        if (!tex) return null;
        const sprite = new Sprite(tex);
        sprite.x = x;
        sprite.y = y;
        return sprite;
      };

      const tileLayers = mapData.layers.filter(
        (l) => l.type === "tilelayer" && Array.isArray(l.data)
      );

      tileLayers.forEach((layer) => {
        const data = layer.data;
        for (let row = 0; row < mapTilesH; row++) {
          for (let col = 0; col < mapTilesW; col++) {
            const gid = data[row * mapTilesW + col];
            if (!gid) continue;
            const sprite = createTileSprite(gid, col * tileW, row * tileH);
            if (sprite) mapContainer.addChild(sprite);
          }
        }
      });

      const objectLayers = mapData.layers.filter(
        (l) => l.type === "objectgroup" && Array.isArray(l.objects)
      );

      const chatMaskLayers = new Set(["cat", "dog"]);

      objectLayers.forEach((layer) => {
        const isScareLayer =
          layer.name === "scarecrow" || layer.name === "speaker";
        const isChatMaskLayer = chatMaskLayers.has(layer.name);

        for (const obj of layer.objects) {
          const gid = obj.gid;

          if (!gid) {
            if (!isChatMaskLayer) continue;

            const g = new Graphics();
            g.beginFill(0x000000, 0.001);
            g.drawRect(obj.x, obj.y, obj.width ?? 0, obj.height ?? 0);
            g.endFill();

            g.eventMode = "static";
            g.cursor = "pointer";

            g.on("pointerdown", (ev) => ev.stopPropagation());
            g.on("pointertap", (ev) => {
              ev.stopPropagation();
              setChatCharacter(layer.name === "cat" ? "cat" : "dog");
              setChatOpen(true);
            });

            const baseY = (obj.y || 0) + (obj.height || 0);
            g.zIndex = baseY - 1;

            mapContainer.addChild(g);
            continue;
          }

          const tex = gidTextureMap.get(gid);
          if (!tex) continue;

          const s = new Sprite(tex);
          s.anchor.set(0.5, 1.0);

          const cx = obj.width && obj.height ? obj.x + obj.width / 2 : obj.x;
          const cy = obj.y;

          s.x = cx;
          s.y = cy;

          const texW = tex.width || 0;
          const texH = tex.height || 0;
          if (obj.width && obj.height && texW > 0 && texH > 0) {
            s.scale.set(obj.width / texW, obj.height / texH);
          }

          s.zIndex = s.y - 1;

          if (isScareLayer) {
            s.eventMode = "static";
            s.cursor = "pointer";
            s.on("pointertap", (ev) => {
              ev?.stopPropagation?.();
              setChatCharacter("scarecrow");
              setChatOpen(true);
            });
          }

          mapContainer.addChild(s);
        }
      });

      const slotLayer = mapData.layers.find(
        (l) => l.type === "objectgroup" && l.name === "flower-slot"
      );

      const flowerTileset = mapData.tilesets.find(
        (ts) => ts.name === "flowers"
      );

      const flowerGids = [];
      if (flowerTileset && Array.isArray(flowerTileset.tiles)) {
        for (const t of flowerTileset.tiles) {
          const gid = flowerTileset.firstgid + (t.id ?? 0);
          if (gidTextureMap.has(gid)) flowerGids.push(gid);
        }
      }

      if (slotLayer && Array.isArray(slotLayer.objects) && flowerGids.length) {
        try {
          const slotCount = slotLayer.objects.length;
          const resp = await fetch(`${API_PREFIX}/mood/garden/state`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slot_count: slotCount }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const flowers = Array.isArray(data.flowers) ? data.flowers : [];

            flowers.forEach((f) => {
              const idx = f.slot_index;
              if (
                typeof idx !== "number" ||
                idx < 0 ||
                idx >= slotLayer.objects.length
              ) {
                return;
              }

              const slotObj = slotLayer.objects[idx];
              const flowerGid =
                flowerGids[Math.floor(Math.random() * flowerGids.length)];
              const sprite = createFlowerSpriteForSlot(
                slotObj,
                flowerGid,
                gidTextureMap
              );
              if (sprite) mapContainer.addChild(sprite);
            });
          } else {
            const t = await resp.text();
            console.error("garden state bad status:", resp.status, t);
          }
        } catch (err) {
          console.error("fetch garden state error:", err);
        }
      }

      const mailboxLayer = mapData.layers.find(
        (l) => l.type === "objectgroup" && l.name === "mailbox-area"
      );

      if (mailboxLayer && Array.isArray(mailboxLayer.objects)) {
        for (const obj of mailboxLayer.objects) {
          const g = new Graphics();
          g.beginFill(0x000000, 0.001);
          g.drawRect(obj.x, obj.y, obj.width ?? 0, obj.height ?? 0);
          g.endFill();

          g.eventMode = "static";
          g.cursor = "pointer";

          g.on("pointerdown", (ev) => ev.stopPropagation());
          g.on("pointertap", (ev) => {
            ev.stopPropagation();
            setMailboxOpen(true);
          });

          const baseY = (obj.y || 0) + (obj.height || 0);
          g.zIndex = baseY - 1;

          mapContainer.addChild(g);
        }
      }

      const fitView = (recenter = true) => {
        if (!app || !mapContainer) return;

        const size = getViewSize();
        viewW = size.w;
        viewH = size.h;

        app.renderer.resize(viewW, viewH);

        mapContainer.scale.set(currentScale);

        if (recenter) {
          const centered = clampMapPosition(
            (viewW - mapPixelW * currentScale) / 2,
            (viewH - mapPixelH * currentScale) / 2,
            viewW,
            viewH,
            mapPixelW,
            mapPixelH,
            currentScale
          );
          mapContainer.x = centered.x;
          mapContainer.y = centered.y;
        } else {
          const clamped = clampMapPosition(
            mapContainer.x,
            mapContainer.y,
            viewW,
            viewH,
            mapPixelW,
            mapPixelH,
            currentScale
          );
          mapContainer.x = clamped.x;
          mapContainer.y = clamped.y;
        }

        app.stage.hitArea = new Rectangle(0, 0, viewW, viewH);
      };

      fitView(true);

      resizeHandler = () => fitView(false);
      window.addEventListener("resize", resizeHandler);

      let isDragging = false;
      let lastPointer = { x: 0, y: 0 };

      app.stage.eventMode = "static";
      app.stage.hitArea = new Rectangle(0, 0, viewW, viewH);

      app.stage.on("pointerdown", (event) => {
        isDragging = true;
        lastPointer = { x: event.global.x, y: event.global.y };
      });

      const endDrag = () => {
        isDragging = false;
      };

      app.stage.on("pointerup", endDrag);
      app.stage.on("pointerupoutside", endDrag);

      app.stage.on("pointermove", (event) => {
        if (!isDragging) return;

        const current = { x: event.global.x, y: event.global.y };
        const dx = current.x - lastPointer.x;
        const dy = current.y - lastPointer.y;

        const clamped = clampMapPosition(
          mapContainer.x + dx,
          mapContainer.y + dy,
          viewW,
          viewH,
          mapPixelW,
          mapPixelH,
          currentScale
        );

        mapContainer.x = clamped.x;
        mapContainer.y = clamped.y;

        lastPointer = current;
      });
    })();

    return () => {
      destroyed = true;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (app) app.destroy(true);
    };
  }, []);

  const currentMessages = histories[chatCharacter] || [];

  const updateCurrentMessages = (next) => {
    setHistories((prev) => ({
      ...prev,
      [chatCharacter]: Array.isArray(next) ? next : [],
    }));
  };

  return (
    <>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />

      <ScarecrowChat
        open={chatOpen}
        character={chatCharacter}
        messages={currentMessages}
        setMessages={updateCurrentMessages}
        sharedMemory={sharedMemory}
        setSharedMemory={setSharedMemory}
        onClose={() => setChatOpen(false)}
        onSummary={(summary) => {
          setLastSummary(summary);
          setShowSummaryPrompt(true);

          setSharedMemory((prev) => ({
            ...prev,
            lastSpeaker: chatCharacter,
            lastAt: new Date().toISOString(),
            lastEvent: summary?.event || prev.lastEvent,
            lastEmotion: summary?.emotion || prev.lastEmotion,
            lastSummaryText: `${summary?.event || ""} / ${
              summary?.emotion || ""
            }`.trim(),
          }));
        }}
      />

      <MailboxPanel open={mailboxOpen} onClose={() => setMailboxOpen(false)} />

      {showSummaryPrompt && lastSummary && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 1100,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              marginBottom: 20,
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(15,15,25,0.92)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
              maxWidth: 480,
              fontSize: 13,
              boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ marginBottom: 6, fontWeight: 600 }}>
              记录今天的“事件 + 心情”吗？
            </div>
            <div style={{ marginBottom: 6, opacity: 0.9 }}>
              <div style={{ marginBottom: 2 }}>
                <strong>事件：</strong>
                {lastSummary.event || "（模型未能提取事件）"}
              </div>
              <div>
                <strong>心情：</strong>
                {lastSummary.emotion || "（模型未能提取情绪）"}
              </div>
            </div>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                type="button"
                onClick={() => setShowSummaryPrompt(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#ccc",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                先不记录
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch(`${API_PREFIX}/mood/record`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        event: lastSummary.event || "",
                        emotion: lastSummary.emotion || "",
                      }),
                    });
                  } catch (err) {
                    console.error("record mood error:", err);
                  } finally {
                    setShowSummaryPrompt(false);
                  }
                }}
                style={{
                  border: "none",
                  background: "rgba(255,204,102,1)",
                  color: "#402000",
                  fontWeight: 600,
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                记录到农场
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
