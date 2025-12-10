import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// Reuse browser instance for performance
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      args: [...chromium.args, "--disable-dev-shm-usage", "--no-sandbox"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  return browserInstance;
}

// HTML template generator for cards
function generateCardHTML(cardType, username, data) {
  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        width: 1080px;
        height: 1920px;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      
      .wrapped-card {
        width: 1080px;
        height: 1920px;
        padding: 20px;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        font-size: 20px;
        font-family: "Inter", "Noto Color Emoji", sans-serif;
      }
      
      .wrapped-card::before {
        content: "";
        position: absolute;
        top: -30%;
        right: -30%;
        width: 250%;
        height: 250%;
        background: radial-gradient(
          circle at 40% 40%,
          rgba(255, 255, 255, 0.35) 0%,
          rgba(255, 255, 255, 0.18) 30%,
          rgba(255, 255, 255, 0.08) 50%,
          transparent 70%
        );
        pointer-events: none;
      }
      
      .wrapped-card::after {
        content: "";
        position: absolute;
        bottom: -30%;
        left: -30%;
        width: 250%;
        height: 250%;
        background: radial-gradient(
          circle at 60% 60%,
          rgba(255, 255, 255, 0.3) 0%,
          rgba(255, 255, 255, 0.15) 30%,
          rgba(255, 255, 255, 0.06) 50%,
          transparent 70%
        );
        pointer-events: none;
      }
      
      .gradient-purple {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #5a4a9f 100%);
      }
      
      .gradient-blue {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #0ab7e0 100%);
      }
      
      .gradient-green {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 50%, #2ec9ad 100%);
      }
      
      .gradient-orange {
        background: linear-gradient(135deg, #fa709a 0%, #fee140 50%, #ffa751 100%);
      }
      
      .gradient-pink {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #d946a6 100%);
      }
      
      .card-content {
        height: 100%;
        overflow: hidden;
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
      }
      
      .card-header {
        text-align: center;
        padding-top: 10px;
        color: white;
      }
      
      .year-label {
        font-size: 2em;
        font-weight: 900;
        letter-spacing: 0.1em;
        margin-bottom: 10px;
        text-transform: uppercase;
        background: rgba(255, 255, 255, 0.75);
        color: #1a1a2e;
        display: inline-block;
        padding: 10px 40px;
        border-radius: 50px;
        border: 2px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      }
      
      .card-title {
        font-size: 4em;
        font-weight: 900;
        line-height: 1.1;
        margin-bottom: 5px;
        text-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
        letter-spacing: -0.03em;
        color: white;
      }
      
      .username {
        font-size: 2.5em;
        font-weight: 700;
        margin-bottom: 10px;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        color: white;
      }
      
      .stats-grid {
        display: flex;
        flex-direction: column;
        gap: 30px;
        padding: 0;
        margin: 20px 0;
        flex: 1;
      }
      
      .stat-item {
        text-align: center;
        padding: 30px;
        background: rgba(255, 255, 255, 0.75);
        color: #1a1a2e;
        border-radius: 20px;
        border: 3px solid rgba(255, 255, 255, 0.5);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
      }
      
      .stat-value {
        font-size: 3.5em;
        font-weight: 900;
        line-height: 1;
        color: #1a1a2e;
        margin-bottom: 10px;
      }
      
      .stat-label {
        font-size: 1.5em;
        font-weight: 700;
        color: #2a2a3e;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .stat-sublabel {
        font-size: 1em;
        font-weight: 500;
        color: #3a3a4e;
        margin-top: 10px;
      }
      
      .games-showcase {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 10px 0;
        flex: 1;
      }
      
      .game-card {
        position: relative;
        background: rgba(255, 255, 255, 0.75);
        color: #1a1a2e;
        border-radius: 18px;
        border: 3px solid rgba(255, 255, 255, 0.5);
        overflow: hidden;
        display: flex;
        align-items: stretch;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
      }
      
      .game-card-rank {
        position: absolute;
        top: 12px;
        left: 12px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        font-size: 2em;
        font-weight: 900;
        padding: 6px 14px;
        border-radius: 8px;
        z-index: 2;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      
      .game-card-thumbnail {
        height: 140px;
        object-fit: cover;
        flex-shrink: 0;
      }
      
      .game-card-content {
        flex: 1;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 10px;
      }
      
      .game-card-name {
        font-size: 3em;
        font-weight: 900;
        color: #1a1a2e;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      
      .game-card-plays {
        font-size: 2em;
        font-weight: 700;
        color: #3a3a4e;
      }
      
      .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        padding: 0;
        margin: 20px 0;
        justify-content: center;
      }
      
      .tag-item {
        display: flex;
        align-items: center;
        gap: 30px;
        padding: 10px 20px;
        background: rgba(255, 255, 255, 0.75);
        color: #1a1a2e;
        border-radius: 50px;
        border: 3px solid rgba(255, 255, 255, 0.5);
        font-size: 2em;
        font-weight: 800;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      }
      
      .tag-text {
        flex: 1;
      }
      
      .tag-count {
        background: rgba(26, 26, 46, 0.15);
        color: #1a1a2e;
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 1.1em;
        font-weight: 900;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      
      .card-footer {
        color: white;
        text-align: center;
        margin-top: 20px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }
      
      .footer-text {
        font-size: 2em;
        font-weight: 700;
        letter-spacing: -1px;
      }
    </style>
  `;

  let content = "";

  if (cardType === "stats") {
    content = `
      <div class="wrapped-card gradient-purple">
        <div class="card-content">
          <div class="card-header">
            <h2 class="year-label">✨ 2025 ✨</h2>
            <h1 class="card-title">🎲 Your Year in Games 🎲</h1>
            <p class="username">${username}</p>
          </div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">${data.totalPlays}</div>
              <div class="stat-label">Total Plays</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${data.uniqueGames}</div>
              <div class="stat-label">Unique Games</div>
            </div>
            ${
              data.averageGameAge !== null && data.averageGameAge !== undefined
                ? `
            <div class="stat-item">
              <div class="stat-value">${data.averageGameAge}</div>
              <div class="stat-label">Average Game Age</div>
              <div class="stat-sublabel">
                ${
                  data.averageGameAge === 0
                    ? "Playing the hottest new releases! 🔥"
                    : data.averageGameAge === 1
                    ? "Playing games about 1 year old"
                    : `Playing games about ${data.averageGameAge} years old`
                }
              </div>
            </div>
            `
                : ""
            }
          </div>
          <div class="card-footer">
            <p class="footer-text">🎲 bgwrapped.boardgaymesjames.com @boardgaymesjames</p>
          </div>
        </div>
      </div>
    `;
  } else if (cardType === "most-played") {
    content = `
      <div class="wrapped-card gradient-blue">
        <div class="card-content">
          <div class="card-header">
            <h2 class="year-label">✨ 2025 ✨</h2>
            <h1 class="card-title">🏆 Most Played Games 🏆</h1>
            <p class="username">${username}</p>
          </div>
          <div class="games-showcase">
            ${data
              .slice(0, 5)
              .map(
                (game, index) => `
              <div class="game-card">
                <div class="game-card-rank">#${index + 1}</div>
                ${
                  game.thumbnail
                    ? `<img src="https://bgg-app-backend-1.onrender.com/api/proxy-image?url=${encodeURIComponent(
                        game.thumbnail
                      )}" alt="${game.gameName}" class="game-card-thumbnail" />`
                    : ""
                }
                <div class="game-card-content">
                  <div class="game-card-name">${game.gameName}</div>
                  <div class="game-card-plays">🎯 ${game.playCount} plays</div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
          <div class="card-footer">
            <p class="footer-text">🎲 bgwrapped.boardgaymesjames.com @boardgaymesjames</p>
          </div>
        </div>
      </div>
    `;
  } else if (cardType === "mechanics") {
    content = `
      <div class="wrapped-card gradient-green">
        <div class="card-content">
          <div class="card-header">
            <h2 class="year-label">✨ 2025 ✨</h2>
            <h1 class="card-title">⚙️ Favorite Mechanics ⚙️</h1>
            <p class="username">${username}</p>
          </div>
          <div class="tags-container">
            ${data
              .map(
                (item) => `
              <div class="tag-item">
                <span class="tag-text">${item.mechanic}</span>
                <span class="tag-count">${item.count}</span>
              </div>
            `
              )
              .join("")}
          </div>
          <div class="card-footer">
            <p class="footer-text">🎲 bgwrapped.boardgaymesjames.com @boardgaymesjames</p>
          </div>
        </div>
      </div>
    `;
  } else if (cardType === "categories") {
    content = `
      <div class="wrapped-card gradient-orange">
        <div class="card-content">
          <div class="card-header">
            <h2 class="year-label">✨ 2025 ✨</h2>
            <h1 class="card-title">🎨 Top Themes 🎨</h1>
            <p class="username">${username}</p>
          </div>
          <div class="tags-container">
            ${data
              .map(
                (item) => `
              <div class="tag-item">
                <span class="tag-text">${item.category}</span>
                <span class="tag-count">${item.count}</span>
              </div>
            `
              )
              .join("")}
          </div>
          <div class="card-footer">
            <p class="footer-text">🎲 bgwrapped.boardgaymesjames.com @boardgaymesjames</p>
          </div>
        </div>
      </div>
    `;
  } else if (cardType === "publishers") {
    content = `
      <div class="wrapped-card gradient-pink">
        <div class="card-content">
          <div class="card-header">
            <h2 class="year-label">✨ 2025 ✨</h2>
            <h1 class="card-title">📚 Top Publishers 📚</h1>
            <p class="username">${username}</p>
          </div>
          <div class="tags-container">
            ${data
              .map(
                (item) => `
              <div class="tag-item">
                <span class="tag-text">${item.publisher}</span>
                <span class="tag-count">${item.count}</span>
              </div>
            `
              )
              .join("")}
          </div>
          <div class="card-footer">
            <p class="footer-text">🎲 bgwrapped.boardgaymesjames.com @boardgaymesjames</p>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
        ${styles}
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
}

// Generate image from HTML
export async function generateCardImage(cardType, username, data) {
  const html = generateCardHTML(cardType, username, data);
  const browser = await getBrowser();

  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1080, height: 1920 });

    // Set content - network idle ensures fonts are loaded
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 8000,
    });

    // Brief render delay (reduced from 1000ms)
    await new Promise((resolve) => setTimeout(resolve, 200));

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
      optimizeForSpeed: true,
    });

    return screenshot;
  } finally {
    await page.close();
  }
}
