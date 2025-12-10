import { createCanvas, loadImage, registerFont } from "canvas";
import fetch from "node-fetch";

// Cache for loaded images
const imageCache = new Map();

async function loadImageWithCache(url) {
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  try {
    // Fetch image with proper headers
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const image = await loadImage(Buffer.from(buffer));
    imageCache.set(url, image);
    return image;
  } catch (error) {
    console.error(`Failed to load image: ${url}`, error.message);
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

  // Header - Year label with background pill
  ctx.textAlign = "center";
  const yearText = "2025";
  ctx.font = "bold 50px Arial";
  const yearWidth = ctx.measureText(yearText).width;
  const pillWidth = yearWidth + 100;
  const pillHeight = 70;
  const pillX = (1080 - pillWidth) / 2;
  const pillY = 60;

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 35);
  ctx.fill();

  ctx.fillStyle = "#1a1a2e";
  ctx.fillText(yearText, 540, pillY + 48);

  // Title
  ctx.font = "bold 90px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  ctx.fillText("Your Year in Games", 540, 230);
  ctx.shadowBlur = 0;

  // Username
  ctx.font = "bold 65px Arial";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(username, 540, 320);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Stats boxes
  const stats = [
    { value: data.totalPlays, label: "Total Plays" },
    { value: data.uniqueGames, label: "Unique Games" },
  ];

  if (data.averageGameAge !== null && data.averageGameAge !== undefined) {
    stats.push({
      value: data.averageGameAge,
      label: "Average Game Age",
      sublabel:
        data.averageGameAge === 0
          ? "Playing the hottest new releases!"
          : data.averageGameAge === 1
          ? "Playing games about 1 year old"
          : `Playing games about ${data.averageGameAge} years old`,
    });
  }

  let yPos = 430;
  const boxHeight = 360;
  const gap = 40;

  stats.forEach((stat) => {
    // Box background with border
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 60, yPos, 960, boxHeight, 20);
    ctx.fill();
    ctx.stroke();

    // Value
    ctx.font = "bold 180px Arial";
    ctx.fillStyle = "#1a1a2e";
    ctx.fillText(stat.value, 540, yPos + 180);

    // Label
    ctx.font = "bold 42px Arial";
    ctx.fillStyle = "#2a2a3e";
    ctx.fillText(stat.label, 540, yPos + 240);

    // Sublabel
    if (stat.sublabel) {
      ctx.font = "500 32px Arial";
      ctx.fillStyle = "#3a3a4e";
      ctx.fillText(stat.sublabel, 540, yPos + 290);
    }

    yPos += boxHeight + gap;
  });

  // Footer
  ctx.font = "bold 46px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("bgwrapped.boardgaymesjames.com @boardgaymesjames", 540, 1830);
  ctx.shadowBlur = 0;

  return canvas.toBuffer("image/png");
}

export async function generateMostPlayedCard(username, games) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  // Background
  drawGradientBackground(ctx, "blue");
  drawRadialOverlays(ctx);

  // Header - Year label
  ctx.textAlign = "center";
  const yearText = "2025";
  ctx.font = "bold 50px Arial";
  const yearWidth = ctx.measureText(yearText).width;
  const pillWidth = yearWidth + 100;
  const pillHeight = 70;
  const pillX = (1080 - pillWidth) / 2;
  const pillY = 60;

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 35);
  ctx.fill();

  ctx.fillStyle = "#1a1a2e";
  ctx.fillText(yearText, 540, pillY + 48);

  // Title
  ctx.font = "bold 90px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  ctx.fillText("Most Played", 540, 230);
  ctx.shadowBlur = 0;

  // Username
  ctx.font = "bold 65px Arial";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(username, 540, 320);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Game cards
  const topGames = games.slice(0, 5);
  let yPos = 430;
  const cardHeight = 240;
  const gap = 30;

  for (let i = 0; i < topGames.length; i++) {
    const game = topGames[i];

    // Card background with border
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 60, yPos, 960, cardHeight, 12);
    ctx.fill();
    ctx.stroke();

    // Rank badge - top right
    const rankBadgeSize = 70;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    drawRoundedRect(ctx, 940, yPos + 15, rankBadgeSize, rankBadgeSize * 0.7, 6);
    ctx.fill();
    ctx.font = "bold 42px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(`#${i + 1}`, 975, yPos + 56);

    // Load and draw game image on the left
    if (game.thumbnail) {
      try {
        const img = await loadImageWithCache(game.thumbnail);
        if (img) {
          const imgWidth = cardHeight;
          const imgHeight = cardHeight;

          // Save context for clipping
          ctx.save();
          // Create rounded clip path for image
          drawRoundedRect(ctx, 60, yPos, imgWidth, imgHeight, 12);
          ctx.clip();

          ctx.drawImage(img, 60, yPos, imgWidth, imgHeight);
          ctx.restore();
        }
      } catch (e) {
        console.log("Failed to load game image:", e);
      }
    }

    // Game content - to the right of image
    const contentX = 60 + cardHeight + 20;
    const contentWidth = 960 - cardHeight - 40 - rankBadgeSize - 20;

    // Game name
    ctx.font = "bold 56px Arial";
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";

    // Wrap text if needed
    const nameY = yPos + cardHeight / 2 - 20;
    wrapText(ctx, game.gameName, contentX, nameY, contentWidth, 60);

    // Play count
    ctx.font = "bold 42px Arial";
    ctx.fillStyle = "#3a3a4e";
    ctx.fillText(
      `${game.playCount} plays`,
      contentX,
      yPos + cardHeight / 2 + 50
    );

    yPos += cardHeight + gap;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.font = "bold 46px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("bgwrapped.boardgaymesjames.com @boardgaymesjames", 540, 1830);
  ctx.shadowBlur = 0;

  return canvas.toBuffer("image/png");
}

export async function generateMechanicsCard(username, mechanics) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "green");
  drawRadialOverlays(ctx);

  // Header - Year label
  ctx.textAlign = "center";
  const yearText = "2025";
  ctx.font = "bold 50px Arial";
  const yearWidth = ctx.measureText(yearText).width;
  const pillWidth = yearWidth + 100;
  const pillHeight = 70;
  const pillX = (1080 - pillWidth) / 2;
  const pillY = 60;

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 35);
  ctx.fill();

  ctx.fillStyle = "#1a1a2e";
  ctx.fillText(yearText, 540, pillY + 48);

  // Title
  ctx.font = "bold 90px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  ctx.fillText("Fav Mechanics", 540, 230);
  ctx.shadowBlur = 0;

  // Username
  ctx.font = "bold 65px Arial";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(username, 540, 320);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Tags
  const topMechanics = mechanics.slice(0, 8);
  let yPos = 430;
  let xPos = 60;
  const tagHeight = 90;
  const gap = 20;
  const maxWidth = 1080 - 120; // Account for padding

  topMechanics.forEach((item) => {
    ctx.font = "bold 48px Arial";
    const textWidth = ctx.measureText(item.mechanic).width;
    const countText = item.count.toString();
    const countWidth = ctx.measureText(countText).width;
    const tagWidth = textWidth + countWidth + 110;

    // Check if tag fits on current row
    if (xPos + tagWidth > maxWidth + 60) {
      xPos = 60;
      yPos += tagHeight + gap;
    }

    // Tag background with border
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, xPos, yPos, tagWidth, tagHeight, 45);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";
    ctx.fillText(item.mechanic, xPos + 35, yPos + 60);

    // Count badge
    const badgeX = xPos + textWidth + 55;
    const badgeWidth = countWidth + 40;
    ctx.fillStyle = "rgba(26, 26, 46, 0.15)";
    drawRoundedRect(ctx, badgeX, yPos + 20, badgeWidth, 50, 25);
    ctx.fill();

    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(countText, badgeX + badgeWidth / 2, yPos + 60);

    xPos += tagWidth + gap;
  });

  // Footer
  ctx.textAlign = "center";
  ctx.font = "bold 46px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("bgwrapped.boardgaymesjames.com @boardgaymesjames", 540, 1830);
  ctx.shadowBlur = 0;

  return canvas.toBuffer("image/png");
}

export async function generateCategoriesCard(username, categories) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "orange");
  drawRadialOverlays(ctx);

  // Header - Year label
  ctx.textAlign = "center";
  const yearText = "2025";
  ctx.font = "bold 50px Arial";
  const yearWidth = ctx.measureText(yearText).width;
  const pillWidth = yearWidth + 100;
  const pillHeight = 70;
  const pillX = (1080 - pillWidth) / 2;
  const pillY = 60;

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 35);
  ctx.fill();

  ctx.fillStyle = "#1a1a2e";
  ctx.fillText(yearText, 540, pillY + 48);

  // Title
  ctx.font = "bold 90px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  ctx.fillText("Top Themes", 540, 230);
  ctx.shadowBlur = 0;

  // Username
  ctx.font = "bold 65px Arial";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(username, 540, 320);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Tags
  const topCategories = categories.slice(0, 8);
  let yPos = 430;
  let xPos = 60;
  const tagHeight = 90;
  const gap = 20;
  const maxWidth = 1080 - 120;

  topCategories.forEach((item) => {
    ctx.font = "bold 48px Arial";
    const textWidth = ctx.measureText(item.category).width;
    const countText = item.count.toString();
    const countWidth = ctx.measureText(countText).width;
    const tagWidth = textWidth + countWidth + 110;

    if (xPos + tagWidth > maxWidth + 60) {
      xPos = 60;
      yPos += tagHeight + gap;
    }

    // Tag background with border
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, xPos, yPos, tagWidth, tagHeight, 45);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";
    ctx.fillText(item.category, xPos + 35, yPos + 60);

    // Count badge
    const badgeX = xPos + textWidth + 55;
    const badgeWidth = countWidth + 40;
    ctx.fillStyle = "rgba(26, 26, 46, 0.15)";
    drawRoundedRect(ctx, badgeX, yPos + 20, badgeWidth, 50, 25);
    ctx.fill();

    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(countText, badgeX + badgeWidth / 2, yPos + 60);

    xPos += tagWidth + gap;
  });

  // Footer
  ctx.textAlign = "center";
  ctx.font = "bold 46px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("bgwrapped.boardgaymesjames.com @boardgaymesjames", 540, 1830);
  ctx.shadowBlur = 0;

  return canvas.toBuffer("image/png");
}

export async function generatePublishersCard(username, publishers) {
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "pink");
  drawRadialOverlays(ctx);

  // Header - Year label
  ctx.textAlign = "center";
  const yearText = "2025";
  ctx.font = "bold 50px Arial";
  const yearWidth = ctx.measureText(yearText).width;
  const pillWidth = yearWidth + 100;
  const pillHeight = 70;
  const pillX = (1080 - pillWidth) / 2;
  const pillY = 60;

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 35);
  ctx.fill();

  ctx.fillStyle = "#1a1a2e";
  ctx.fillText(yearText, 540, pillY + 48);

  // Title
  ctx.font = "bold 90px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  ctx.fillText("Top Publishers", 540, 230);
  ctx.shadowBlur = 0;

  // Username
  ctx.font = "bold 65px Arial";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.fillText(username, 540, 320);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Tags
  const topPublishers = publishers.slice(0, 8);
  let yPos = 430;
  let xPos = 60;
  const tagHeight = 90;
  const gap = 20;
  const maxWidth = 1080 - 120;

  topPublishers.forEach((item) => {
    ctx.font = "bold 48px Arial";
    const textWidth = ctx.measureText(item.publisher).width;
    const countText = item.count.toString();
    const countWidth = ctx.measureText(countText).width;
    const tagWidth = textWidth + countWidth + 110;

    if (xPos + tagWidth > maxWidth + 60) {
      xPos = 60;
      yPos += tagHeight + gap;
    }

    // Tag background with border
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, xPos, yPos, tagWidth, tagHeight, 45);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "left";
    ctx.fillText(item.publisher, xPos + 35, yPos + 60);

    // Count badge
    const badgeX = xPos + textWidth + 55;
    const badgeWidth = countWidth + 40;
    ctx.fillStyle = "rgba(26, 26, 46, 0.15)";
    drawRoundedRect(ctx, badgeX, yPos + 20, badgeWidth, 50, 25);
    ctx.fill();

    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(countText, badgeX + badgeWidth / 2, yPos + 60);

    xPos += tagWidth + gap;
  });

  // Footer
  ctx.textAlign = "center";
  ctx.font = "bold 46px Arial";
  ctx.fillStyle = "white";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.fillText("bgwrapped.boardgaymesjames.com @boardgaymesjames", 540, 1830);
  ctx.shadowBlur = 0;

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
