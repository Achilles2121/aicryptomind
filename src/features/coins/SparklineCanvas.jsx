// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";

const SparklineCanvas = ({ data = [], width = 120, height = 32, stroke = "#38bdf8" }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!Array.isArray(data) || data.length < 2) {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.35)";
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
      return;
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    ctx.beginPath();
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * (width - 2) + 1;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }, [data, width, height, stroke]);

  return <canvas ref={canvasRef} className="block" />;
};

SparklineCanvas.propTypes = {
  data: PropTypes.arrayOf(PropTypes.number),
  width: PropTypes.number,
  height: PropTypes.number,
  stroke: PropTypes.string,
};

export default SparklineCanvas;
