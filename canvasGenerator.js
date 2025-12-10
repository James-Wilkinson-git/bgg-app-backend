import { createCanvas, loadImage } from "canvas";
import fetch from "node-fetch";

const PRIMARY_FONT_FAMILY = '"Segoe UI"';

const imageCache = new Map();

async function loadImageWithCache(url) {
  if (!url) {
    return null;
  }

  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = buildFont("800", labelFont);
    ctx.fillStyle = "#2a2a3e";
    ctx.fillText(stat.label.toUpperCase(), CANVAS_WIDTH / 2, textY);
    ctx.restore();

    if (stat.sublabel) {
      textY += labelFont + subSpacing;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = buildFont("500", subFont);
      ctx.fillStyle = "#3a3a4e";
      drawTextWithEmoji(ctx, stat.sublabel, CANVAS_WIDTH / 2, textY);
      ctx.restore();
    }
  "✨": (ctx, x, baselineY, metrics) => {
    const height =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent ||
      em(1.8);
    const gradient = ctx.createLinearGradient(
      x,
      baselineY - metrics.actualBoundingBoxAscent,
      x,
      baselineY + metrics.actualBoundingBoxDescent
    );
    gradient.addColorStop(0, "#fff7ae");
    gradient.addColorStop(0.6, "#ffd74b");
    gradient.addColorStop(1, "#ffb300");
    return gradient;
  },
  "🎲": "#7c3aed",
  "🏆": "#ffb300",
  "⚙": "#34d1bf",
  "🎨": "#ef476f",
  "📚": "#00b4d8",
  "🌍": "#06d6a0",
  "🎯": "#ff4d6d",
  "🔥": "#ff6b35",
};

function drawTextWithEmoji(ctx, text, x, y) {
  if (!text) {
    return;
  }

  const originalAlign = ctx.textAlign || "left";
  const originalFill = ctx.fillStyle;
  const glyphs = Array.from(text);
  const metrics = glyphs.map((glyph) => ctx.measureText(glyph));
  const totalWidth = ctx.measureText(text).width;

  let cursorX = x;
  if (originalAlign === "center") {
    cursorX = x - totalWidth / 2;
  } else if (originalAlign === "right" || originalAlign === "end") {
    cursorX = x - totalWidth;
  }

  ctx.textAlign = "left";

  let run = "";
  let runStart = cursorX;

  const flushRun = () => {
    if (!run) {
      return;
    }
    ctx.fillStyle = originalFill;
    ctx.fillText(run, runStart, y);
    run = "";
  };

  glyphs.forEach((glyph, index) => {
    const glyphMetrics = metrics[index];
    const normalized = glyph.replace("\uFE0F", "");
    const style = emojiStyles[normalized];

    if (style) {
      flushRun();
      ctx.save();
      if (typeof style === "function") {
        ctx.fillStyle = style(ctx, cursorX, y, glyphMetrics);
      } else {
        ctx.fillStyle = style;
      }
      ctx.fillText(glyph, cursorX, y);
      ctx.restore();
    } else {
      if (!run) {
        run = glyph;
        runStart = cursorX;
      } else {
        run += glyph;
      }
    }

    cursorX += glyphMetrics.width;
  });

  flushRun();

  ctx.textAlign = originalAlign;
  ctx.fillStyle = originalFill;
}

function scale(value) {
  return value * SCALE;
}

function em(multiplier) {
  return BASE_FONT_SIZE * multiplier;
}

const layout = {
  outerPaddingX: scale(24),
  outerPaddingTop: scale(32),
  outerPaddingBottom: scale(160),
  contentPadding: scale(10),
};

layout.contentLeft = layout.outerPaddingX + layout.contentPadding;
layout.contentRight = CANVAS_WIDTH - layout.contentLeft;
layout.contentWidth = layout.contentRight - layout.contentLeft;

function formatNumber(value) {
  if (value === null || value === undefined) {
    return "--";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? numberFormatter.format(value) : "--";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "--";
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numberFormatter.format(numeric);
    }
    return trimmed;
  }

  return String(value);
}

const fontWeightKeywordLookup = new Map(
  Object.entries({
    thin: 100,
    extralight: 200,
    ultralight: 200,
    light: 300,
    normal: 400,
    regular: 400,
    medium: 500,
    semibold: 600,
    demibold: 600,
    bold: 700,
    extrabold: 800,
    heavy: 800,
    black: 900,
  })
);

function normalizeFontWeight(weight) {
  if (typeof weight === "number" && Number.isFinite(weight)) {
    return clampWeight(weight);
  }

  if (typeof weight === "string") {
    const trimmed = weight.trim().toLowerCase();
    if (fontWeightKeywordLookup.has(trimmed)) {
      return fontWeightKeywordLookup.get(trimmed);
    }
    const numericWeight = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numericWeight)) {
      return clampWeight(numericWeight);
    }
  }

  return 400;
}

function clampWeight(value) {
  const rounded = Math.round(value / 100) * 100;
  return Math.min(900, Math.max(100, rounded));
}

function buildFont(weight, sizePx) {
  const fontSize = Math.max(1, sizePx);
  const normalizedWeight = normalizeFontWeight(weight);
  const weightKeyword = normalizedWeight >= 700 ? "bold" : "normal";
  return `${weightKeyword} ${fontSize}px ${PRIMARY_FONT_FAMILY}`;
}

function measureTextHeight(ctx, text) {
  const metrics = ctx.measureText(text);
  return (
    (metrics.actualBoundingBoxAscent || 0) +
    (metrics.actualBoundingBoxDescent || 0)
  );
}

function fitFontSize(ctx, text, options) {
  const { initialSize, maxWidth, weight = "900", minScale = 0.6 } = options;

  let size = initialSize;
  ctx.font = buildFont(weight, size);

  if (!text) {
    return size;
  }

  while (
    ctx.measureText(text).width > maxWidth &&
    size > initialSize * minScale
  ) {
    size -= 1;
    ctx.font = buildFont(weight, size);
  }

  return size;
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
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.5, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawRadialOverlays(ctx) {
  const maxRadius = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.9;

  const gradient1 = ctx.createRadialGradient(
    CANVAS_WIDTH * 0.7,
    CANVAS_HEIGHT * 0.2,
    0,
    CANVAS_WIDTH * 0.7,
    CANVAS_HEIGHT * 0.2,
    maxRadius
  );
  gradient1.addColorStop(0, "rgba(255, 255, 255, 0.35)");
  gradient1.addColorStop(0.3, "rgba(255, 255, 255, 0.18)");
  gradient1.addColorStop(0.5, "rgba(255, 255, 255, 0.08)");
  gradient1.addColorStop(0.7, "transparent");
  ctx.fillStyle = gradient1;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const gradient2 = ctx.createRadialGradient(
    CANVAS_WIDTH * 0.3,
    CANVAS_HEIGHT * 0.8,
    0,
    CANVAS_WIDTH * 0.3,
    CANVAS_HEIGHT * 0.8,
    maxRadius
  );
  gradient2.addColorStop(0, "rgba(255, 255, 255, 0.3)");
  gradient2.addColorStop(0.3, "rgba(255, 255, 255, 0.15)");
  gradient2.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
  gradient2.addColorStop(0.7, "transparent");
  ctx.fillStyle = gradient2;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = buildFont("800", labelFont);
  ctx.fillStyle = "#2a2a3e";
  ctx.fillText(stat.label.toUpperCase(), CANVAS_WIDTH / 2, textY);
  ctx.restore();

  if (stat.sublabel) {
    textY += labelFont + subSpacing;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = buildFont("500", subFont);
    ctx.fillStyle = "#3a3a4e";
    drawTextWithEmoji(ctx, stat.sublabel, CANVAS_WIDTH / 2, textY);
    ctx.restore();
  }

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const truncated = lines.slice(0, maxLines);
  let lastLine = truncated[maxLines - 1];
  while (
    lastLine.length &&
    ctx.measureText(`${lastLine}...`).width > maxWidth
  ) {
    lastLine = lastLine.slice(0, -1).trimEnd();
  }
  truncated[maxLines - 1] = lastLine.length ? `${lastLine}...` : "...";
  return truncated;
}

function drawHeader(ctx, { title, subtitle }) {
  const startY = layout.outerPaddingTop + layout.contentPadding;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const yearFontSize = em(1.4);
  ctx.font = buildFont("900", yearFontSize);
  const metrics = ctx.measureText(YEAR_TEXT);
  const pillPaddingX = em(1.5);
  const pillPaddingY = em(0.4);
  const pillWidth = metrics.width + pillPaddingX * 2;
  const pillHeight = yearFontSize + pillPaddingY * 2;
  const pillX = (CANVAS_WIDTH - pillWidth) / 2;
  const pillY = startY;

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = Math.max(1, scale(1.5));
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, scale(50));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1a1a2e";
  drawTextWithEmoji(ctx, YEAR_TEXT, CANVAS_WIDTH / 2, pillY + pillHeight / 2);
  ctx.restore();

  let y = startY + pillHeight + em(0.6);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const safeTitle = title || "";
  const titleFont = fitFontSize(ctx, safeTitle, {
    initialSize: em(2.3),
    maxWidth: layout.contentWidth,
    weight: "900",
  });
  ctx.font = buildFont("900", titleFont);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = scale(10);
  ctx.shadowOffsetY = scale(2);
  drawTextWithEmoji(ctx, safeTitle, CANVAS_WIDTH / 2, y);
  ctx.restore();
  y += titleFont + em(0.4);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const hasSubtitle = Boolean(subtitle);
  if (hasSubtitle) {
    const safeSubtitle = subtitle || "";
    const subtitleFont = fitFontSize(ctx, safeSubtitle, {
      initialSize: em(1.4),
      maxWidth: layout.contentWidth,
      weight: "700",
    });
    ctx.font = buildFont("700", subtitleFont);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = scale(6);
    drawTextWithEmoji(ctx, safeSubtitle, CANVAS_WIDTH / 2, y);
    ctx.restore();
    y += subtitleFont + em(0.5);
  } else {
    ctx.restore();
  }

  y += layout.contentPadding;
  return y;
}

function drawFooter(ctx) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const footerFont = fitFontSize(ctx, FOOTER_TEXT, {
    initialSize: em(1.4),
    maxWidth: layout.contentWidth,
    weight: "700",
    minScale: 0.7,
  });
  ctx.font = buildFont("700", footerFont);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = scale(3);
  ctx.shadowOffsetY = scale(2);
  const footerY = CANVAS_HEIGHT - layout.outerPaddingBottom / 2;
  drawTextWithEmoji(ctx, FOOTER_TEXT, CANVAS_WIDTH / 2, footerY);
  ctx.restore();
}

function drawStatItem(ctx, stat, x, y, width) {
  const padding = em(1);
  const valueFont = em(5);
  const labelFont = em(1.1);
  const subFont = em(0.9);
  const labelSpacing = em(0.2);
  const subSpacing = em(0.4);
  const radius = scale(20);
  const borderWidth = Math.max(1, scale(1.5));

  let height = padding * 2 + valueFont + labelSpacing + labelFont;
  if (stat.sublabel) {
    height += subSpacing + subFont;
  }

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.stroke();
  ctx.restore();

  let textY = y + padding;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = buildFont("900", valueFont);
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText(formatNumber(stat.value), CANVAS_WIDTH / 2, textY);
  ctx.restore();

  textY += valueFont + labelSpacing;

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = buildFont("800", labelFont);
  ctx.fillStyle = "#2a2a3e";
  const labelY = getMiddleAlignedY(
    ctx,
    stat.label.toUpperCase(),
    textY,
    labelFont
  );
  ctx.fillText(stat.label.toUpperCase(), CANVAS_WIDTH / 2, labelY);
  ctx.restore();

  if (stat.sublabel) {
    textY += labelFont + subSpacing;
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = buildFont("500", subFont);
    ctx.fillStyle = "#3a3a4e";
    const sublabelY = getMiddleAlignedY(ctx, stat.sublabel, textY, subFont);
    drawTextWithEmoji(ctx, stat.sublabel, CANVAS_WIDTH / 2, sublabelY);
    ctx.restore();
  }

  return height;
}

function drawImagePlaceholder(ctx, x, y, width, height) {
  ctx.save();
  addLeftRoundedRectPath(ctx, x, y, width, height, scale(12));
  ctx.clip();
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "rgba(102, 126, 234, 0.85)");
  gradient.addColorStop(1, "rgba(118, 75, 162, 0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = buildFont("900", em(1.4));
  ctx.fillStyle = "#ffffff";
  ctx.fillText("BGG", x + width / 2, y + height / 2);
  ctx.restore();
}

async function drawGameCard(ctx, { game, index, x, y, width, detailText }) {
  const height = scale(120);
  const radius = scale(12);
  const borderWidth = Math.max(1, scale(1.5));

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.stroke();
  ctx.restore();

  const imageWidth = height;
  const contentPadding = em(0.4);
  const textGap = em(0.3);
  const contentWidth = width - imageWidth - contentPadding * 2;

  if (contentWidth <= 0) {
    return height;
  }

  try {
    const image = await loadImageWithCache(game.thumbnail);
    if (image) {
      ctx.save();
      addLeftRoundedRectPath(ctx, x, y, imageWidth, height, radius);
      ctx.clip();
      ctx.drawImage(image, x, y, imageWidth, height);
      ctx.restore();
    } else {
      drawImagePlaceholder(ctx, x, y, imageWidth, height);
    }
  } catch (error) {
    drawImagePlaceholder(ctx, x, y, imageWidth, height);
  }

  const nameFont = em(1.6);
  const detailFont = em(1.2);
  const lineHeight = nameFont * 1.15;
  const textStartX = x + imageWidth + contentPadding;
  let textY = y + contentPadding;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = buildFont("900", nameFont);
  ctx.fillStyle = "#1a1a2e";
  const nameLines = wrapLines(ctx, game.gameName || "", contentWidth, 2);
  nameLines.forEach((line, lineIndex) => {
    ctx.fillText(line, textStartX, textY + lineIndex * lineHeight);
  });
  ctx.restore();

  textY += lineHeight * nameLines.length + textGap;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = buildFont("700", detailFont);
  ctx.fillStyle = "#3a3a4e";
  drawTextWithEmoji(ctx, detailText, textStartX, textY);
  ctx.restore();

  const rankFont = em(1.3);
  const rankPaddingX = em(0.6);
  const rankPaddingY = em(0.25);
  const rankText = `#${index + 1}`;

  ctx.save();
  ctx.font = buildFont("900", rankFont);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const rankWidth = ctx.measureText(rankText).width + rankPaddingX * 2;
  const rankHeight = rankFont + rankPaddingY * 2;
  const rankX = x + width - rankWidth - em(0.3);
  const rankY = y + em(0.3);

  drawRoundedRect(ctx, rankX, rankY, rankWidth, rankHeight, scale(6));
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillText(rankText, rankX + rankWidth / 2, rankY + rankHeight / 2);
  ctx.restore();

  return height;
}

async function drawGamesSection(
  ctx,
  games,
  { includePlayerCounts = false, startY }
) {
  let y = startY + em(0.8);
  const gap = em(1.0);
  const x = layout.contentLeft;
  const width = layout.contentWidth;
  const topGames = games.slice(0, 5);

  for (let i = 0; i < topGames.length; i++) {
    const game = topGames[i];
    const playsText = formatNumber(game.playCount);
    let detailText = `🎯 ${playsText} plays`;

    if (includePlayerCounts) {
      const playersText = formatNumber(game.playerCount);
      if (playersText !== "--") {
        detailText += ` • ${playersText} players`;
      }
    }

    const cardHeight = await drawGameCard(ctx, {
      game,
      index: i,
      x,
      y,
      width,
      detailText,
    });

    y += cardHeight;
    if (i < topGames.length - 1) {
      y += gap;
    }
  }

  return y;
}

function drawTagsSection(ctx, items, { textKey, countKey, startY }) {
  if (!items.length) {
    return startY;
  }

  let x = layout.contentLeft;
  let y = startY + em(0.8);
  const gap = em(1.2);
  const paddingX = em(1.8);
  const paddingY = em(0.9);
  const baseLabelFont = em(1.9);
  const baseCountFont = em(1.35);
  const countPaddingX = em(1.0);
  const countPaddingY = em(0.4);
  const innerGap = em(1.2);
  const radius = scale(70);
  const borderWidth = Math.max(1, scale(1.5));
  let lastBottom = y;

  items.forEach((item) => {
    const label = item[textKey] ? String(item[textKey]) : "";
    const count = formatNumber(item[countKey]);

    let labelFontSize = fitFontSize(ctx, label, {
      initialSize: baseLabelFont,
      maxWidth: layout.contentWidth * 0.75,
      weight: "800",
      minScale: 0.65,
    });

    ctx.font = buildFont("800", labelFontSize);
    const labelWidth = ctx.measureText(label).width;

    const countFontSize = baseCountFont;
    ctx.font = buildFont("900", countFontSize);
    const countWidth = ctx.measureText(count).width;

    const badgeWidth = countWidth + countPaddingX * 2;
    const badgeHeight = countFontSize + countPaddingY * 2;
    const chipWidth = paddingX * 2 + labelWidth + innerGap + badgeWidth;
    const chipHeight = paddingY * 2 + labelFontSize;

    if (x + chipWidth > layout.contentRight) {
      x = layout.contentLeft;
      y += chipHeight + gap;
    }

    ctx.save();
    drawRoundedRect(ctx, x, y, chipWidth, chipHeight, radius);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fill();
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = buildFont("800", labelFontSize);
    ctx.fillStyle = "#1a1a2e";
    ctx.fillText(label, x + paddingX, y + paddingY);
    ctx.restore();

    const badgeX = x + chipWidth - paddingX - badgeWidth;
    const badgeY = y + (chipHeight - badgeHeight) / 2;

    ctx.save();
    drawRoundedRect(
      ctx,
      badgeX,
      badgeY,
      badgeWidth,
      badgeHeight,
      badgeHeight / 2
    );
    ctx.fillStyle = "rgba(26, 26, 46, 0.15)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = buildFont("900", countFontSize);
    ctx.fillStyle = "#1a1a2e";
    ctx.fillText(count, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
    ctx.restore();

    lastBottom = Math.max(lastBottom, y + chipHeight);
    x += chipWidth + gap;
  });

  return lastBottom;
}

export async function generateStatsCard(username, data) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "purple");
  drawRadialOverlays(ctx);

  const headerBottom = drawHeader(ctx, {
    title: "🎲 Your Year in Games 🎲",
    subtitle: username,
  });

  const stats = [
    { value: data.totalPlays, label: "Total Plays" },
    { value: data.uniqueGames, label: "Unique Games" },
  ];

  if (data.averageGameAge !== null && data.averageGameAge !== undefined) {
    const age = data.averageGameAge;
    stats.push({
      value: age,
      label: "Average Game Age",
      sublabel:
        age === 0
          ? "Playing the hottest new releases! 🔥"
          : age === 1
          ? "Playing games about 1 year old"
          : `Playing games about ${age} years old`,
    });
  }

  let y = headerBottom + em(0.8);
  const gap = em(1.0);
  stats.forEach((stat, index) => {
    const height = drawStatItem(
      ctx,
      stat,
      layout.contentLeft,
      y,
      layout.contentWidth
    );
    y += height;
    if (index < stats.length - 1) {
      y += gap;
    }
  });

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

export async function generateMostPlayedCard(username, games) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "blue");
  drawRadialOverlays(ctx);

  const headerBottom = drawHeader(ctx, {
    title: "🏆 Most Played 🏆",
    subtitle: username,
  });

  await drawGamesSection(ctx, games, {
    includePlayerCounts: false,
    startY: headerBottom,
  });

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

export async function generateMechanicsCard(username, mechanics) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "green");
  drawRadialOverlays(ctx);

  const headerBottom = drawHeader(ctx, {
    title: "⚙️ Fav Mechanics ⚙️",
    subtitle: username,
  });

  drawTagsSection(ctx, mechanics.slice(0, 8), {
    textKey: "mechanic",
    countKey: "count",
    startY: headerBottom,
  });

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

export async function generateCategoriesCard(username, categories) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "orange");
  drawRadialOverlays(ctx);

  const headerBottom = drawHeader(ctx, {
    title: "🎨 Top Themes 🎨",
    subtitle: username,
  });

  drawTagsSection(ctx, categories.slice(0, 8), {
    textKey: "category",
    countKey: "count",
    startY: headerBottom,
  });

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

export async function generatePublishersCard(username, publishers) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "pink");
  drawRadialOverlays(ctx);

  const headerBottom = drawHeader(ctx, {
    title: "📚 Top Publishers 📚",
    subtitle: username,
  });

  drawTagsSection(ctx, publishers.slice(0, 8), {
    textKey: "publisher",
    countKey: "count",
    startY: headerBottom,
  });

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}

export async function generateCommunityCard(games) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  drawGradientBackground(ctx, "pink");
  drawRadialOverlays(ctx);

  const headerBottom = drawHeader(ctx, {
    title: "🌍 Community Favs 🌍",
    subtitle: "Most Played by Bg Wrapped Users",
  });

  await drawGamesSection(ctx, games, {
    includePlayerCounts: true,
    startY: headerBottom,
  });

  drawFooter(ctx);
  return canvas.toBuffer("image/png");
}
