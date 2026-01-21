"use client";

import { useEffect, useRef, useState } from "react";

interface PCAPoint {
  id: string;
  respondent_type: string;
  x: number;
  y: number;
}

interface PCAScatterPlotProps {
  points: PCAPoint[];
  explainedVariance: number[];
  onPointClick?: (point: PCAPoint) => void;
}

const RESPONDENT_TYPE_COLORS: Record<string, string> = {
  faculty: "#3498db",
  staff: "#2ecc71",
  student: "#e74c3c",
};

const RESPONDENT_TYPE_LABELS: Record<string, string> = {
  faculty: "教員",
  staff: "職員",
  student: "学生",
};

export function PCAScatterPlot({
  points,
  explainedVariance,
  onPointClick,
}: PCAScatterPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<PCAPoint | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Canvasの描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvasのサイズを設定
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // クリア
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (points.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("データがありません", rect.width / 2, rect.height / 2);
      return;
    }

    // データ範囲を計算
    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const margin = 60;
    const plotWidth = rect.width - margin * 2;
    const plotHeight = rect.height - margin * 2;

    // データ座標をCanvas座標に変換
    const toCanvasX = (x: number) =>
      margin + ((x - xMin) / xRange) * plotWidth;
    const toCanvasY = (y: number) =>
      margin + ((y - yMin) / yRange) * plotHeight;

    // 軸を描画
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // X軸
    ctx.moveTo(margin, rect.height - margin);
    ctx.lineTo(rect.width - margin, rect.height - margin);
    // Y軸
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, rect.height - margin);
    ctx.stroke();

    // 軸ラベル
    ctx.fillStyle = "#666";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `第1主成分 (${explainedVariance[0]?.toFixed(1) || 0}%)`,
      rect.width / 2,
      rect.height - 20
    );
    ctx.save();
    ctx.translate(15, rect.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(
      `第2主成分 (${explainedVariance[1]?.toFixed(1) || 0}%)`,
      0,
      0
    );
    ctx.restore();

    // 点を描画
    points.forEach((point) => {
      const cx = toCanvasX(point.x) * scale + offset.x;
      const cy = toCanvasY(point.y) * scale + offset.y;

      ctx.beginPath();
      ctx.arc(cx, cy, hoveredPoint?.id === point.id ? 10 : 6, 0, Math.PI * 2);
      ctx.fillStyle = RESPONDENT_TYPE_COLORS[point.respondent_type] || "#999";
      ctx.fill();

      // ホバー時の枠線
      if (hoveredPoint?.id === point.id) {
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // 凡例を描画
    const legendX = rect.width - 100;
    let legendY = 30;
    Object.entries(RESPONDENT_TYPE_LABELS).forEach(([type, label]) => {
      ctx.beginPath();
      ctx.arc(legendX, legendY, 6, 0, Math.PI * 2);
      ctx.fillStyle = RESPONDENT_TYPE_COLORS[type] || "#999";
      ctx.fill();
      ctx.fillStyle = "#333";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, legendX + 15, legendY + 4);
      legendY += 25;
    });
  }, [points, explainedVariance, hoveredPoint, scale, offset]);

  // マウスイベントハンドラ
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setOffset({
        x: offset.x + (mouseX - dragStart.x),
        y: offset.y + (mouseY - dragStart.y),
      });
      setDragStart({ x: mouseX, y: mouseY });
      return;
    }

    // データ範囲を計算
    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const margin = 60;
    const plotWidth = rect.width - margin * 2;
    const plotHeight = rect.height - margin * 2;

    // ホバーしている点を探す
    let found: PCAPoint | null = null;
    for (const point of points) {
      const cx =
        margin + ((point.x - xMin) / xRange) * plotWidth * scale + offset.x;
      const cy =
        margin + ((point.y - yMin) / yRange) * plotHeight * scale + offset.y;
      const dist = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2);
      if (dist < 10) {
        found = point;
        break;
      }
    }
    setHoveredPoint(found);
  };

  const handleClick = () => {
    if (hoveredPoint && onPointClick) {
      onPointClick(hoveredPoint);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.max(0.5, Math.min(5, s * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{
          width: "100%",
          height: "400px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          cursor: isDragging ? "grabbing" : "grab",
        }}
      />
      {hoveredPoint && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "white",
            padding: "12px",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid var(--border)",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {RESPONDENT_TYPE_LABELS[hoveredPoint.respondent_type] ||
              hoveredPoint.respondent_type}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            PC1: {hoveredPoint.x.toFixed(2)}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            PC2: {hoveredPoint.y.toFixed(2)}
          </div>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: "12px", color: "#666" }}>
        ヒント: ホイールで拡大縮小、ドラッグでパン
      </div>
    </div>
  );
}
