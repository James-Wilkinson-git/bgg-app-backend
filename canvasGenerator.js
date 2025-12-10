import { createCanvas, loadImage, registerFont } from "canvas";
import fetch from "node-fetch";

// Cache for loaded images
const imageCache = new Map();

async function loadImageWithCache(url) {
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  try {
    const image = await loadImage(url);
    imageCache.set(url, image);
    return image;
  } catch (error) {
    console.error(`Failed to load image: ${url}`, error);
    return null;
  }
}

function drawGradientBackground(ctx, gradientType) {
  const gradients = {
    purple: ["#667eea", "#764ba2", "#5a4a9f"],
    blue: ["#4facfe", "#00f2fe", "#0ab7e0"],
    green: ["#43e97b", "#38f9d7", "#2ec9ad"],
    orange: ["#fa709a", "#fee140", "#ffa751"],
    pink: ["#f093fb", "#f5576c", "#d946a6"],
  };

  const colors = gradients[gradientType] || gradients.purple;
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.5, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1920);
}

function drawRadialOverlays(ctx) {
  // Top-right overlay
  const gradient1 = ctx.createRadialGradient(756, 384, 0, 756, 384, 1350);
  gradient1.addColorStop(0, "rgba(255, 255, 255, 0.35)");
  gradient1.addColorStop(0.3, "rgba(255, 255, 255, 0.18)");
  gradient1.addColorStop(0.5, "rgba(255, 255, 255, 0.08)");
  gradient1.addColorStop(0.7, "transparent");
  ctx.fillStyle = gradient1;
  ctx.fillRect(0, 0, 1080, 1920);

  // Bottom-left overlay
  const gradient2 = ctx.createRadialGradient(324, 1536, 0, 324, 1536, 1350);
  gradient2.addColorStop(0, "rgba(255, 255, 255, 0.3)");
  gradient2.addColorStop(0.3, "rgba(255, 255, 255, 0.15)");
  gradient2.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
  gradient2.addColorStop(0.7, "transparent");
  ctx.fillStyle = gradient2;
  ctx.fillRect(0, 0, 1080, 1920);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lines.push(line);
      line = words[i] + " ";
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  lines.forEach((line, index) => {
    ctx.fillText(line.trim(), x, y + index * lineHeight);
  });
}

export async function generateStatsCard(username, data) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  // Background
  drawGradientBackground(ctx, "purple");
  drawRadialOverlays(ctx);

  // Header
  ctx.textAlign = "center";
  ctx.font = "900 60px Inter";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, 350, 30, 380, 100, 50);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText("✨ 2025 ✨", 540, 95);

  ctx.font = "900 120px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.fillText("🎲 Your Year in Games 🎲", 540, 250);

  ctx.font = "700 75px Inter";
  ctx.shadowBlur = 8;
  ctx.fillText(username, 540, 350);
  ctx.shadowBlur = 0;

  // Stats boxes
  const stats = [
    { value: data.totalPlays, label: "TOTAL PLAYS" },
    { value: data.uniqueGames, label: "UNIQUE GAMES" },
  ];

  if (data.averageGameAge !== null && data.averageGameAge !== undefined) {
    stats.push({
      value: data.averageGameAge,
      label: "AVERAGE GAME AGE",
      sublabel:
        data.averageGameAge === 0
          ? "Playing the hottest new releases! 🔥"
          : data.averageGameAge === 1
          ? "Playing games about 1 year old"
          : `Playing games about ${data.averageGameAge} years old`,
    });
  }

  let yPos = 450;
  const boxHeight = (1920 - 450 - 200) / stats.length - 30;

  stats.forEach((stat) => {
    // Box background
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    drawRoundedRect(ctx, 40, yPos, 1000, boxHeight, 20);
    ctx.fill();

    // Value
    ctx.font = "900 105px Inter";
    ctx.fillStyle = "#1a1a2e";
    ctx.fillText(stat.value, 540, yPos + boxHeight / 2 - 10);

    // Label
    ctx.font = "700 45px Inter";
    ctx.fillStyle = "#2a2a3e";
    ctx.fillText(stat.label, 540, yPos + boxHeight / 2 + 50);

    // Sublabel
    if (stat.sublabel) {
      ctx.font = "500 30px Inter";
      ctx.fillStyle = "#3a3a4e";
      ctx.fillText(stat.sublabel, 540, yPos + boxHeight / 2 + 90);
    }

    yPos += boxHeight + 30;
  });

  // Footer
  ctx.font = "700 60px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("🎲 bgwrapped.boardgaymesjames.com", 540, 1850);
  ctx.shadowBlur = 0;

  return canvas.toBuffer("image/png");
}

export async function generateMostPlayedCard(username, games) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  // Background
  drawGradientBackground(ctx, "blue");
  drawRadialOverlays(ctx);

  // Header
  ctx.textAlign = "center";
  ctx.font = "900 60px Inter";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, 350, 30, 380, 100, 50);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText("✨ 2025 ✨", 540, 95);

  ctx.font = "900 120px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.fillText("🏆 Most Played Games 🏆", 540, 250);

  ctx.font = "700 75px Inter";
  ctx.shadowBlur = 8;
  ctx.fillText(username, 540, 350);
  ctx.shadowBlur = 0;

  // Game cards
  const topGames = games.slice(0, 5);
  let yPos = 400;

  for (let i = 0; i < topGames.length; i++) {
    const game = topGames[i];
    const cardHeight = 140;

    // Card background
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    drawRoundedRect(ctx, 40, yPos, 1000, cardHeight, 18);
    ctx.fill();

    // Rank badge
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    drawRoundedRect(ctx, 52, yPos + 12, 70, 50, 8);
    ctx.fill();
    ctx.font = "900 40px Inter";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(`#${i + 1}`, 87, yPos + 48);

    // Game name
    ctx.font = "900 50px Inter";
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";
    ctx.fillText(game.gameName, 150, yPos + 60, 800);

    // Play count
    ctx.font = "700 35px Inter";
    ctx.fillStyle = "#3a3a4e";
    ctx.fillText(`🎯 ${game.playCount} plays`, 150, yPos + 105);

    yPos += cardHeight + 12;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.font = "700 60px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("🎲 bgwrapped.boardgaymesjames.com", 540, 1850);
  ctx.shadowBlur = 0;

  return canvas.toBuffer("image/png");
}

export async function generateMechanicsCard(username, mechanics) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "green");
  drawRadialOverlays(ctx);

  // Header
  ctx.textAlign = "center";
  ctx.font = "900 60px Inter";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, 350, 30, 380, 100, 50);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText("✨ 2025 ✨", 540, 95);

  ctx.font = "900 120px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.fillText("⚙️ Favorite Mechanics ⚙️", 540, 250);

  ctx.font = "700 75px Inter";
  ctx.shadowBlur = 8;
  ctx.fillText(username, 540, 350);
  ctx.shadowBlur = 0;

  // Tags
  let yPos = 450;
  let xPos = 40;
  const rowHeight = 100;

  mechanics.forEach((item, index) => {
    ctx.font = "800 55px Inter";
    const textWidth = ctx.measureText(item.mechanic).width;
    const countWidth = ctx.measureText(item.count.toString()).width;
    const tagWidth = textWidth + countWidth + 120;

    if (xPos + tagWidth > 1040) {
      xPos = 40;
      yPos += rowHeight;
    }

    // Tag background
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    drawRoundedRect(ctx, xPos, yPos, tagWidth, 80, 40);
    ctx.fill();

    // Text
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";
    ctx.fillText(item.mechanic, xPos + 30, yPos + 55);

    // Count badge
    ctx.fillStyle = "rgba(26, 26, 46, 0.15)";
    drawRoundedRect(
      ctx,
      xPos + textWidth + 50,
      yPos + 20,
      countWidth + 40,
      40,
      20
    );
    ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "900 50px Inter";
    ctx.textAlign = "center";
    ctx.fillText(item.count, xPos + textWidth + 70 + countWidth / 2, yPos + 52);

    xPos += tagWidth + 20;
  });

  // Footer
  ctx.textAlign = "center";
  ctx.font = "700 60px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("🎲 bgwrapped.boardgaymesjames.com", 540, 1850);

  return canvas.toBuffer("image/png");
}

export async function generateCategoriesCard(username, categories) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "orange");
  drawRadialOverlays(ctx);

  // Header
  ctx.textAlign = "center";
  ctx.font = "900 60px Inter";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, 350, 30, 380, 100, 50);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText("✨ 2025 ✨", 540, 95);

  ctx.font = "900 120px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.fillText("🎨 Top Themes 🎨", 540, 250);

  ctx.font = "700 75px Inter";
  ctx.shadowBlur = 8;
  ctx.fillText(username, 540, 350);
  ctx.shadowBlur = 0;

  // Tags
  let yPos = 450;
  let xPos = 40;
  const rowHeight = 100;

  categories.forEach((item) => {
    ctx.font = "800 55px Inter";
    const textWidth = ctx.measureText(item.category).width;
    const countWidth = ctx.measureText(item.count.toString()).width;
    const tagWidth = textWidth + countWidth + 120;

    if (xPos + tagWidth > 1040) {
      xPos = 40;
      yPos += rowHeight;
    }

    // Tag background
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    drawRoundedRect(ctx, xPos, yPos, tagWidth, 80, 40);
    ctx.fill();

    // Text
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";
    ctx.fillText(item.category, xPos + 30, yPos + 55);

    // Count badge
    ctx.fillStyle = "rgba(26, 26, 46, 0.15)";
    drawRoundedRect(
      ctx,
      xPos + textWidth + 50,
      yPos + 20,
      countWidth + 40,
      40,
      20
    );
    ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "900 50px Inter";
    ctx.textAlign = "center";
    ctx.fillText(item.count, xPos + textWidth + 70 + countWidth / 2, yPos + 52);

    xPos += tagWidth + 20;
  });

  // Footer
  ctx.textAlign = "center";
  ctx.font = "700 60px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("🎲 bgwrapped.boardgaymesjames.com", 540, 1850);

  return canvas.toBuffer("image/png");
}

export async function generatePublishersCard(username, publishers) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "pink");
  drawRadialOverlays(ctx);

  // Header
  ctx.textAlign = "center";
  ctx.font = "900 60px Inter";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, 350, 30, 380, 100, 50);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText("✨ 2025 ✨", 540, 95);

  ctx.font = "900 120px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.fillText("📚 Top Publishers 📚", 540, 250);

  ctx.font = "700 75px Inter";
  ctx.shadowBlur = 8;
  ctx.fillText(username, 540, 350);
  ctx.shadowBlur = 0;

  // Tags
  let yPos = 450;
  let xPos = 40;
  const rowHeight = 100;

  publishers.forEach((item) => {
    ctx.font = "800 55px Inter";
    const textWidth = ctx.measureText(item.publisher).width;
    const countWidth = ctx.measureText(item.count.toString()).width;
    const tagWidth = textWidth + countWidth + 120;

    if (xPos + tagWidth > 1040) {
      xPos = 40;
      yPos += rowHeight;
    }

    // Tag background
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    drawRoundedRect(ctx, xPos, yPos, tagWidth, 80, 40);
    ctx.fill();

    // Text
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";
    ctx.fillText(item.publisher, xPos + 30, yPos + 55);

    // Count badge
    ctx.fillStyle = "rgba(26, 26, 46, 0.15)";
    drawRoundedRect(
      ctx,
      xPos + textWidth + 50,
      yPos + 20,
      countWidth + 40,
      40,
      20
    );
    ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "900 50px Inter";
    ctx.textAlign = "center";
    ctx.fillText(item.count, xPos + textWidth + 70 + countWidth / 2, yPos + 52);

    xPos += tagWidth + 20;
  });

  // Footer
  ctx.textAlign = "center";
  ctx.font = "700 60px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("🎲 bgwrapped.boardgaymesjames.com", 540, 1850);

  return canvas.toBuffer("image/png");
}

export async function generateCommunityCard(games) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "pink");
  drawRadialOverlays(ctx);

  // Header
  ctx.textAlign = "center";
  ctx.font = "900 60px Inter";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, 350, 30, 380, 100, 50);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText("✨ 2025 ✨", 540, 95);

  ctx.font = "900 120px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.fillText("🌍 Community Favorites 🌍", 540, 250);

  ctx.font = "700 75px Inter";
  ctx.shadowBlur = 8;
  ctx.fillText("Most Played by Everyone", 540, 350);
  ctx.shadowBlur = 0;

  // Game cards
  const topGames = games.slice(0, 5);
  let yPos = 400;

  for (let i = 0; i < topGames.length; i++) {
    const game = topGames[i];
    const cardHeight = 140;

    // Card background
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    drawRoundedRect(ctx, 40, yPos, 1000, cardHeight, 18);
    ctx.fill();

    // Rank badge
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    drawRoundedRect(ctx, 52, yPos + 12, 70, 50, 8);
    ctx.fill();
    ctx.font = "900 40px Inter";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(`#${i + 1}`, 87, yPos + 48);

    // Game name
    ctx.font = "900 50px Inter";
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";
    ctx.fillText(game.gameName, 150, yPos + 60, 800);

    // Play count
    ctx.font = "700 35px Inter";
    ctx.fillStyle = "#3a3a4e";
    ctx.fillText(
      `🎯 ${game.playCount} plays • ${game.playerCount} players`,
      150,
      yPos + 105
    );

    yPos += cardHeight + 12;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.font = "700 60px Inter";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("🎲 bgwrapped.boardgaymesjames.com", 540, 1850);

  return canvas.toBuffer("image/png");
}
