# MyGarage 通行碼上線步驟（v3.2.0）

**由你操作；我（Claude）沒有 Google、Cloudflare 權限，也不會看到你的兩把秘密。**
我沒辦法在你的 iPhone 與真實 Google 試算表上測試，所以每個「驗證」步驟請你實際做。
全程約 20~30 分鐘；步驟 2 與 3 要**緊接著**做（中間舊版 App 會暫時讀不到資料）。

## 0. 動手前準備
0. **先檢查試算表有沒有可疑內容**（鎖門前網址是公開的，任何人都可能寫進資料）：在「加油紀錄」「保養維修」「車輛」三個分頁用 Ctrl+F 搜尋 `<`、`script`、`onerror`、`http`，在「車輛」分頁特別看名稱欄。有看到不是你自己輸入的內容，先刪除或告訴我。（新版前端已把顯示的文字跳脫，但舊資料仍建議清乾淨。）
1. **備份試算表**：Google 試算表「愛車紀錄」→ 檔案 → 建立副本。
2. **備份現行程式**（我已替你留著，請不要刪）：
   - Apps Script：`Apps Script\20261022\程式碼.gs`（v2.5.0）
   - Worker：`cloudflare\20261022\worker.js`（舊版）
   - 前端：GitHub 上目前的 `index.html`（v3.1.0），任何時候可用 `git revert` 回復
3. **產生兩把秘密**（用密碼管理器，各至少 **16 個隨機字元**，建議 32 以上；**不要貼給任何人包括我**）：
   - `PASSCODE`：通行碼。你會在手機輸入一次，所以請選你能輸入的（例如 4 個隨機單字連在一起，至少 16 字元）。
   - `APPS_SCRIPT_KEY`：內部金鑰。只存在 Cloudflare 與 Apps Script，不用輸入，越長越好。

## 1. Apps Script（相容模式，不會讓現有 App 壞掉）
1. 開啟 Apps Script 專案 → 把 `build\20261023\deploy\程式碼.gs` 的**全部內容**貼上，取代舊的 → 儲存。
   - 確認檔案裡是 `var ALLOW_UNLOCKED_WHEN_NO_KEY = true;`（目前還沒設金鑰，所以先維持 true）。
2. 部署 → **管理部署作業** → 按現有部署右邊的鉛筆（編輯）→ 版本選「**新版本**」→ 部署。**網址不會變。**
3. 驗證：瀏覽器開 `你的/exec網址?action=ping` → 應顯示 `"version":"2.6.0"` 和 `"locked":false`。

## 2. Cloudflare Worker
1. Worker → 設定 → 變數和密碼 → 新增兩個**密碼（Secret）**：`PASSCODE`、`APPS_SCRIPT_KEY`（值是步驟 0 的兩把）。
2. 編輯程式碼 → 把 `build\20261023\deploy\worker.js` 的**全部內容**貼上 → 部署。
   - 這個檔案已含你現有的 Apps Script 網址，**不要上傳到 GitHub**（GitHub 用的是 `repo\cloudflare-worker.js`，只有佔位網址）。
3. 驗證（任意終端機）：
   - `curl "https://你的worker網址/?action=ping"` → 應回 401 `unauthorized`。
   - `curl -H "Authorization: Bearer 你的通行碼" "https://你的worker網址/?action=ping"` → 應回 `"ok":true`、`"version":"2.6.0"`、`"locked":false`。

## 3. 前端（GitHub Pages）
- 這一步我會先給你看差異，**你同意我才推送到公開儲存庫**（`index.html`、`cloudflare-worker.js`、`CHANGELOG.md`、`DEPLOY_STEPS.md`）。
- 推送後 GitHub Pages 約 1~2 分鐘更新。

## 4. 手機實測（你的 iPhone）
1. 完全關掉 App 再開（桌面圖示版要上滑關閉）；若版本標籤還是 v3.1.0，等 2 分鐘或清除 Safari 網站資料再開。**版本標籤要顯示 v3.2.0 才是新頁面。**
2. 出現通行碼視窗 → 輸入通行碼 → 資料應正常載入。
3. 新增一筆測試加油紀錄，確認成功；到試算表看有沒有那一列；再用「撤銷」收回。
4. 按「更換通行碼」輸入一個**錯誤**的通行碼 → 應提示「通行碼不正確」並再問一次（不會一直自動重試）；再輸入正確的。
5. 以上都正常才進行步驟 5。

## 5. 鎖門（設定內部金鑰）
1. Apps Script → 專案設定（齒輪）→ **指令碼屬性** → 新增：`API_KEY` = `APPS_SCRIPT_KEY` 的同一個值 → 儲存。
2. 驗證（這一步也同時證明金鑰經過 Apps Script 的轉址後仍然有效）：
   - `curl "你的/exec網址?action=all"` → 應回 `{"ok":false,"error":"unauthorized"}`（**舊網址從此失效**）。
   - `curl "https://你的worker網址/?action=all"` → 401。
   - `curl -H "Authorization: Bearer 你的通行碼" "https://你的worker網址/?action=ping"` → `"locked":true`。
   - 手機重新整理 → 仍可讀取、新增。
   - 任一不符就**刪掉 `API_KEY` 屬性**回到相容模式，把結果告訴我。

## 6. 正式鎖定（拿掉相容模式）
1. 在 Apps Script 把 `var ALLOW_UNLOCKED_WHEN_NO_KEY = true;` 改成 `false` → 儲存 → 管理部署作業 → 編輯 → 新版本 → 部署。
2. 這之後「沒有設定 API_KEY」會一律拒絕，不會因為屬性被刪掉或打錯而重新變成公開。
3. 再驗證一次 `ping` 回 `"locked":true`，手機仍正常。

## 7. 收尾
- **檢查所有部署**：Apps Script → 部署 → 管理部署作業，列出所有部署。除了你剛更新的那個，**其他舊部署（若有）都要封存**；每個部署各自釘在某個程式版本，舊版沒有驗證的部署即使你設了 API_KEY 仍可能維持開放。
- （可選，更徹底）建立全新部署（新網址）、只放進 Worker，舊網址（已在公開 git 歷史）就完全作廢。
- 前端已加入內容安全政策（只允許連到你的 Worker）與 Chart.js 的完整性檢查；若之後換了 Worker 網址，記得同步改 `index.html` 的 `API_PROXY_URL` 與 CSP 的 `connect-src`。

## 選用：限制猜通行碼的速度
通行碼沒有內建限流（靠夠長的隨機字串）。想再加一層：Cloudflare 後台 → 你的網域或 Worker 路由 → 安全性 / WAF → 速率限制規則，對 Worker 網址設「同一 IP 每分鐘最多 N 次」。免費方案的規則數量有限，不設也可以。

## 常見問題
- **忘記通行碼**：到 Cloudflare 改 `PASSCODE` 這個 Secret，手機用「更換通行碼」輸入新的即可。
- **手機一直要求通行碼**：通行碼不符；或 Worker 的 `PASSCODE` 沒設（Worker 會回「server not configured」）。
- **讀取失敗、顯示「後端驗證失敗(內部金鑰設定不一致)」**：Worker 的 `APPS_SCRIPT_KEY` 與 Apps Script 的 `API_KEY` 不一致（你的通行碼沒有問題，手機上不會被清掉）。修正其中一邊使兩者相同即可。
- **其他 502**：Worker 與 Apps Script 之間出問題（網路、部署版本錯誤、回應不是 JSON）。
- **回復到舊版**：步驟 5 之前出問題 → 把 Worker 貼回 `cloudflare\20261022\worker.js`、GitHub 上 `git revert` 前端即可；步驟 5 之後 → 先刪 `API_KEY` 並把旗標設回 `true` 重新部署。

## 安全備註
- 通行碼存在手機瀏覽器的 localStorage；同一個網域 `188subd.github.io` 底下的其他專案頁面也讀得到。不要在同網域放不信任的頁面。
- 兩把秘密請存在密碼管理器，不要寫在任何檔案或對話裡。
- 即使有通行碼保護，仍建議定期從試算表匯出備份。
