import React, { useEffect, useRef, useState } from "react";

class Ray {
  x: number;
  y: number;
  dx: number;
  dy: number;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    this.dx = Math.cos(angle);
    this.dy = Math.sin(angle);
  }

  cast(boundary: Boundary): { x: number; y: number } | null {
    const x1 = boundary.x1;
    const y1 = boundary.y1;
    const x2 = boundary.x2;
    const y2 = boundary.y2;

    const x3 = this.x;
    const y3 = this.y;
    const x4 = this.x + this.dx;
    const y4 = this.y + this.dy;

    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

    if (t > 0 && t < 1 && u > 0) {
      const px = x1 + t * (x2 - x1);
      const py = y1 + t * (y2 - y1);
      return { x: px, y: py };
    }

    return null;
  }

  draw(ctx: CanvasRenderingContext2D, boundaries: Boundary[]) {
    let closest: any = null;
    let minDist = Infinity;

    boundaries.forEach((boundary) => {
      const point = this.cast(boundary);
      if (point) {
        const dist = Math.hypot(point.x - this.x, point.y - this.y);
        if (dist < minDist) {
          minDist = dist;
          closest = point;
        }
      }
    });

    if (closest) {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(closest.x, closest.y);
      ctx.strokeStyle = "yellow";
      ctx.stroke();
    }
  }
}

class Boundary {
  x1: number;
  y1: number;
  x2: number;
  y2: number;

  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.strokeStyle = "white";
    ctx.stroke();
  }
}

class Circle {
  x: number;
  y: number;
  radius: number;

  constructor(x: number, y: number, radius: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  getBoundaries(): Boundary[] {
    const boundaries: Boundary[] = [];
    const segments = 36;
    for (let i = 0; i < 360; i += 360 / segments) {
      const angle1 = (i * Math.PI) / 180;
      const angle2 = ((i + 360 / segments) * Math.PI) / 180;
      const x1 = this.x + this.radius * Math.cos(angle1);
      const y1 = this.y + this.radius * Math.sin(angle1);
      const x2 = this.x + this.radius * Math.cos(angle2);
      const y2 = this.y + this.radius * Math.sin(angle2);
      boundaries.push(new Boundary(x1, y1, x2, y2));
    }
    return boundaries;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "purple";
    ctx.stroke();
  }
}

class Polygon {
  vertices: { x: number; y: number }[];

  constructor(vertices: { x: number; y: number }[]) {
    this.vertices = vertices;
  }

  getBoundaries(): Boundary[] {
    const boundaries: Boundary[] = [];
    for (let i = 0; i < this.vertices.length; i++) {
      const current = this.vertices[i];
      const next = this.vertices[(i + 1) % this.vertices.length];
      boundaries.push(new Boundary(current.x, current.y, next.x, next.y));
    }
    return boundaries;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    this.vertices.forEach((vertex, index) => {
      if (index === 0) {
        ctx.moveTo(vertex.x, vertex.y);
      } else {
        ctx.lineTo(vertex.x, vertex.y);
      }
    });
    ctx.closePath();
    ctx.strokeStyle = "pink";
    ctx.stroke();
  }
}

class Animation {
  object: any;
  updateFn: (time: number) => void;

  constructor(object: any, updateFn: (time: number) => void) {
    this.object = object;
    this.updateFn = updateFn;
  }

  update(time: number) {
    this.updateFn(time);
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.object.draw(ctx);
  }
}

const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });

  // State for debug analytics
  const [debugInfo, setDebugInfo] = useState({
    renderCount: 0,
    boundaryCount: 0,
    objectCount: 0,
    rayCount: 0,
    collisionChecks: 0,
    fps: 0,
  });

  // State to toggle debug visibility
  const [showDebug, setShowDebug] = useState(false);

  // State to pause/unpause animations
  const [isAnimationPaused, setIsAnimationPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const padding = 8;

    const boundaries: Boundary[] = [
      new Boundary(padding, padding, rect.width - padding, padding),
      new Boundary(
        rect.width - padding,
        padding,
        rect.width - padding,
        rect.height - padding
      ),
      new Boundary(
        rect.width - padding,
        rect.height - padding,
        padding,
        rect.height - padding
      ),
      new Boundary(padding, rect.height - padding, padding, padding),
    ];

    // Animated Polygon
    const polygonVertices = [
      { x: rect.width / 4, y: rect.height / 4 },
      { x: rect.width / 2, y: rect.height / 4 },
      { x: rect.width / 4.5, y: rect.height / 2 },
    ];
    const polygon = new Polygon(polygonVertices);

    // Rays
    const rays: Ray[] = [];
    for (let i = 0; i < 360; i += 1) {
      rays.push(new Ray(0, 0, (i * Math.PI) / 180));
    }

    // Dynamic Circle
    const dynamicCircle = new Circle(rect.width / 4, rect.height / 2, 30);

    // Animation for the dynamic circle
    const dynamicCircleAnimation = new Animation(dynamicCircle, (time) => {
      dynamicCircle.x = rect.width / 2 + Math.sin(time) * 100;
      dynamicCircle.y = rect.height / 2 + Math.pow(Math.sin(time), 2) * 100;
    });

    // Animation for the polygon (animate multiple vertices)
    const polygonAnimation = new Animation(polygon, (time) => {
      polygon.vertices.forEach((vertex, index) => {
        vertex.x += Math.sin(time + index) * 2; // Horizontal oscillation
        vertex.y += Math.cos(time + index) * 2; // Vertical oscillation
      });
    });

    const animations = [dynamicCircleAnimation, polygonAnimation];

    let animationTime = 0;
    let renderCount = 0;
    let lastTime = performance.now();

    const draw = () => {
      const startTime = performance.now();
      renderCount++;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw static boundaries
      boundaries.forEach((boundary) => boundary.draw(ctx));

      // Update and draw animations (only if not paused)
      if (!isAnimationPaused) {
        animations.forEach((animation) => {
          animation.update(animationTime);
        });
        animationTime += 0.02;
      }

      animations.forEach((animation) => {
        animation.draw(ctx);
      });

      // Update boundaries for the dynamic circle
      const dynamicBoundaries = dynamicCircle.getBoundaries();
      dynamicBoundaries.forEach((boundary) => boundary.draw(ctx));

      // Update boundaries for the animated polygon
      const polygonBoundaries = polygon.getBoundaries();
      polygonBoundaries.forEach((boundary) => boundary.draw(ctx));

      let collisionChecks = 0;

      // Draw rays
      rays.forEach((ray) => {
        ray.x = mousePositionRef.current.x;
        ray.y = mousePositionRef.current.y;
        ray.draw(ctx, [
          ...boundaries,
          ...dynamicBoundaries,
          ...polygonBoundaries,
        ]);
        collisionChecks +=
          boundaries.length +
          dynamicBoundaries.length +
          polygonBoundaries.length;
      });

      // Calculate FPS
      const currentTime = performance.now();
      const fps = Math.round(1000 / (currentTime - lastTime));
      lastTime = currentTime;

      setDebugInfo({
        renderCount,
        boundaryCount:
          boundaries.length +
          dynamicBoundaries.length +
          polygonBoundaries.length,
        objectCount: animations.length,
        rayCount: rays.length,
        collisionChecks,
        fps,
      });

      requestAnimationFrame(draw);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePositionRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "b") {
        setShowDebug((prev) => !prev);
      }
      if (event.ctrlKey && event.key === "v") {
        setIsAnimationPaused((prev) => !prev);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);

    draw();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAnimationPaused]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ background: "black", width: "100%", height: "100vh" }}
      />
      {showDebug && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          <div>Renders: {debugInfo.renderCount}</div>
          <div>FPS: {debugInfo.fps}</div>
          <div>Boundaries: {debugInfo.boundaryCount}</div>
          <div>Objects: {debugInfo.objectCount}</div>
          <div>Rays: {debugInfo.rayCount}</div>
          <div>Collision Checks / frame: {debugInfo.collisionChecks}</div>
          <div>Animations Paused: {isAnimationPaused ? "Yes" : "No"}</div>
        </div>
      )}
    </>
  );
};

export default Canvas;
