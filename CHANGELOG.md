# 愛車紀錄 MyGarage — 變更記錄

個人車輛管理 PWA。前端 GitHub Pages + 後端 Google Apps Script + 資料存 Google Sheets,
iPhone 連線經由 Cloudflare Worker 代理。

- 線上網址:https://188subd.github.io/MyGarage/
- 資料庫:Google Sheets「愛車紀錄」(分頁:車輛 / 加油紀錄 / 保養維修)
- 各服務網址存放於 index.html 與 Worker 設定中,此文件不重複記載

---

## 版本編號說明

開發過程中因多方協作,版本號一度混亂(前端曾排到 v3.0,後由 v2.4 重新編號)。
**自 v3.0.0 起統一往上遞增,v2.4–v2.6 視為過渡期編號。**

---

## v2.6.0 — 2026-08-19 「圖表期間 + 預算線」

**新增**
- 「每月支出」與「行駛里程」圖表加入期間切換:近 12 月 / 近 24 月 / 全部
- 期間超過 24 個月時自動改為按季彙總,避免柱狀圖過密
- 支出圖加入每月預算線(預設 NT$8,000,於程式碼 `MONTHLY_BUDGET` 調整)
  - 超出預算時 tooltip 顯示超額金額
  - 圖表下方統計此期間超支月數
- 分析頁新增「長期累計油耗」卡(總里程 ÷ 總公升),不受單次是否加滿影響

**修正**
- iPhone 版面右側凸出/被切掉:診斷框中的超長網址撐破版面
  - 診斷框改用 `overflow-wrap:anywhere`
  - 全域加入 `overflow-x:hidden`、`*{min-width:0}`、卡片 `max-width:100%`

## v2.5.0 — 2026-08-19 「存檔加速」

**修正(重要)**
- 手機新增紀錄時出現「儲存成功卻顯示讀取失敗」
  - 原因:每次寫入後會重新讀取整份試算表,該次讀取超過 15 秒逾時
  - 對策一:逾時 15 秒 → 45 秒(Apps Script 實測需 4–8 秒,行動網路更久)
  - 對策二:寫入成功後改為本地即時更新畫面,不再重讀全部資料

**新增**
- 右上角里程膠囊改為可點擊,用於手動重新讀取試算表
  (手動編輯試算表後使用)

## v2.4.0 — 2026-08 「iOS 連線修正」(由 ChatGPT 協助完成)

**修正**
- iPhone / iPad Safari 無法連線後端
  - 根因:Safari「防止跨網站追蹤」(ITP)阻擋跨站請求
  - 對策:新增 Cloudflare Worker 作為 CORS 代理,iOS 改連 Worker
  - 連線層改為多通道容錯:proxy-fetch → direct-fetch → iframe → JSONP
- 加入 `?debug=1` 診斷模式與畫面版本標示

## v2.2 — 「iframe 通道」(未解決 iOS)

- 後端加入 `mode=frame`,回傳以 postMessage 傳值的 HTML 頁
- 修正 postMessage 層級:`parent` → `window.top`
  (Apps Script 外層另有一層 Google 框架,parent 只到包裝層)
- 寫入加入 `reqId` 唯一編號 + CacheService 防重複記帳

## v2.1 — 「JSONP 通道」

- 後端 doGet 支援 `callback` 參數回傳 JSONP,解決桌機 CORS
- 桌機恢復正常,iOS 仍失敗

## v2.0 — 「多車輛」

- 新增「車輛」分頁,支援多台汽車/機車,可命名與切換
- 加油/保養兩張表尾端新增「車輛」欄,既有資料自動歸入第一台車
- 提供 `升級到多車版()` 函式供既有使用者一鍵升級
- 機車油耗刻度自動放大至 60 km/L
- 平板響應式版面(寬螢幕時統計卡改四欄)

## v1.2 — 「車齡與支出分類」

- 總覽頁加入車齡卡(年/月/累計天數)
- 支出類型新增:保險、稅金、罰單
- 新增「分析」分頁:月均/年均里程與花費、每月里程圖、
  年度花費堆疊圖、花費比例甜甜圈圖

## v1.0 — 「初版」

- 深色霓虹風格 PWA,底部五分頁
- 加油紀錄(加滿法油耗計算)、保養維修紀錄
- 總覽儀表環、油耗走勢、每月支出圖
- Google Apps Script 後端 + Google Sheets 資料庫

---

## 維護備忘

**改前端**
GitHub → index.html → 編輯 → Commit。Commit 訊息請寫明版本與變更內容。

**改後端**
Google Sheets → 擴充功能 → Apps Script → 編輯 Code.gs → Ctrl+S →
部署 → 管理部署作業 → 鉛筆 → 版本選「新增版本」→ 填說明 → 部署。
**務必用「編輯現有部署」,若用「新增部署作業」會產生新網址。**

**改 Worker**
Cloudflare → Workers & Pages → 編輯 → 部署。
改完請同步更新本倉庫的 `cloudflare-worker.js` 備份。

**還原舊版**
GitHub → 檔案 → History → 選任一版本 → View file → 複製貼回。

**資料備份**
Google Sheets → 檔案 → 建立副本(建議每半年一次)。

---

## 待辦功能

- [ ] 保養提醒:機油、輪胎、驗車、保險、牌照稅/燃料費,
      以「里程或日期先到者」觸發,總覽頁顯示倒數
- [ ] 紀錄的修改/刪除(目前需至試算表手動處理)
- [ ] 收據拍照連結(照片存 Drive,表中存連結)
- [ ] 寫入 API 加簽章權杖(目前寫入端點為公開網址)
