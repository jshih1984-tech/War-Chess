# 西洋棋大師

一款以 HTML、CSS、JavaScript 製作的像素風西洋棋遊戲。

## 特色

- 8x8 傳統棋盤與 8x12 戰棋棋盤
- 戰棋棋盤可重新布置棋子後開局
- 三種 AI 等級與雙方自動對戰
- 村莊、湖泊、森林、塔樓地形模組
- 吃子計分、投降宣告、玩家勝利提示
- 無需安裝套件，使用本機靜態伺服器即可遊玩

## 啟動方式

在 Windows 上可直接執行：

```bat
start-game.cmd
```

或使用 Node.js：

```powershell
node dev-server.js
```

然後開啟：

```text
http://127.0.0.1:8765/
```

## 專案結構

- `index.html`: 遊戲頁面
- `styles.css`: 版面與像素風格
- `src/app.js`: 遊戲流程、AI、地形生成、UI 狀態
- `src/board.js`: 棋盤渲染
- `src/rules.js`: 棋子規則、地形規則、勝負判定
- `assets/pieces/`: 棋子 SVG 圖像
- `dev-server.js`: 本機靜態伺服器
- `start-game.cmd`: Windows 啟動檔
