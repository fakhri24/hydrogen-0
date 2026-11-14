(function (global) {
  'use strict';

  const COS30 = Math.cos(Math.PI / 6);
  const SIN30 = 0.5;

  // Camera view direction (from +X, +Y, +Z toward origin)
  const VIEW_DIR = normalize({ x: 1, y: 1, z: 1 });
  const LIGHT_DIR = normalize({ x: 0.45, y: 1.0, z: 0.28 });

  function normalize(v) {
    const len = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  function rotatePointAroundAxis(p, pivot, axis, angle) {
    const px = p.x - pivot.x;
    const py = p.y - pivot.y;
    const pz = p.z - pivot.z;
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    let rx = px;
    let ry = py;
    let rz = pz;

    if (axis === 'x') {
      ry = py * c - pz * s;
      rz = py * s + pz * c;
    } else if (axis === 'z') {
      rx = px * c - py * s;
      ry = px * s + py * c;
    }

    return {
      x: rx + pivot.x,
      y: ry + pivot.y,
      z: rz + pivot.z,
    };
  }

  function shadeColor(hex, factor) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${clamp(r * factor)}, ${clamp(g * factor)}, ${clamp(b * factor)})`;
  }

  function createCuboidVertices(minX, minY, minZ, maxX, maxY, maxZ) {
    return [
      { x: minX, y: minY, z: minZ }, // 0: bottom-back-left
      { x: maxX, y: minY, z: minZ }, // 1: bottom-back-right
      { x: maxX, y: minY, z: maxZ }, // 2: bottom-front-right
      { x: minX, y: minY, z: maxZ }, // 3: bottom-front-left
      { x: minX, y: maxY, z: minZ }, // 4: top-back-left
      { x: maxX, y: maxY, z: minZ }, // 5: top-back-right
      { x: maxX, y: maxY, z: maxZ }, // 6: top-front-right
      { x: minX, y: maxY, z: maxZ }, // 7: top-front-left
    ];
  }

  // Outward-facing CCW vertex index quads
  const CUBE_FACES = [
    [4, 7, 6, 5], // +Y top
    [3, 2, 1, 0], // -Y bottom
    [1, 2, 6, 5], // +X right
    [0, 4, 7, 3], // -X left
    [3, 7, 6, 2], // +Z front
    [0, 1, 5, 4], // -Z back
  ];

  class Renderer3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scale = 48;
      this.originX = 0;
      this.originY = 0;
      this.particles = [];
      this.resize();
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(300, Math.floor(rect.width));
      this.height = Math.max(300, Math.floor(rect.height));
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    computeCamera(grid) {
      const rows = grid.length;
      const cols = grid[0].length;
      const span = cols + rows;
      const maxW = this.width * 0.82;
      const maxH = this.height * 0.72;
      const scaleW = maxW / (span * COS30);
      const scaleH = maxH / (span * SIN30 + 2.8);
      this.scale = Math.max(24, Math.min(62, Math.min(scaleW, scaleH)));

      const cx = cols / 2;
      const cz = rows / 2;
      const isoCx = (cx - cz) * COS30 * this.scale;
      const isoCy = (cx + cz) * SIN30 * this.scale;

      this.originX = this.width / 2 - isoCx;
      this.originY = this.height * 0.52 - isoCy;
    }

    project(p) {
      return {
        x: this.originX + (p.x - p.z) * COS30 * this.scale,
        y: this.originY + ((p.x + p.z) * SIN30 - p.y) * this.scale,
      };
    }

    spawnParticles(x, y, z, color, count = 10) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 0.7,
          y: y + Math.random() * 0.2,
          z: z + (Math.random() - 0.5) * 0.7,
          vx: (Math.random() - 0.5) * 2.2,
          vy: 1.2 + Math.random() * 2.2,
          vz: (Math.random() - 0.5) * 2.2,
          life: 1,
          size: 2.5 + Math.random() * 3,
          color,
        });
      }
    }

    updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 6.5 * dt;
        p.life -= dt * 2.1;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    drawPolygon(points2d, fill, stroke, lineWidth = 1) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(points2d[0].x, points2d[0].y);
      for (let i = 1; i < points2d.length; i++) {
        ctx.lineTo(points2d[i].x, points2d[i].y);
      }
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }

    drawBox(verts, baseColor, strokeColor, alpha = 1) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha;

      const visibleFaces = [];
      for (const face of CUBE_FACES) {
        const v0 = verts[face[0]];
        const v1 = verts[face[1]];
        const v2 = verts[face[2]];
        const normal = normalize(cross(sub(v1, v0), sub(v2, v0)));
        if (dot(normal, VIEW_DIR) > 0.01) {
          const light = 0.52 + Math.max(0, dot(normal, LIGHT_DIR)) * 0.56;
          const centerDepth = face.reduce((acc, idx) => acc + verts[idx].x + verts[idx].z - verts[idx].y * 0.1, 0) / 4;
          visibleFaces.push({ face, light, centerDepth });
        }
      }

      visibleFaces.sort((a, b) => a.centerDepth - b.centerDepth);

      for (const item of visibleFaces) {
        const pts = item.face.map((idx) => this.project(verts[idx]));
        this.drawPolygon(pts, shadeColor(baseColor, item.light), strokeColor, 1);
      }

      ctx.restore();
    }

    drawTile(x, z, type, bridgeValue, time) {
      const { TILE } = global.CubixLevels;
      if (type === TILE.VOID) return;

      const pad = 0.035;
      const topY = type === TILE.BRIDGE ? (bridgeValue - 1) * 0.55 : 0;
      const height = 0.24;
      const alpha = type === TILE.BRIDGE ? Math.max(0.15, bridgeValue) : 1;

      if (type === TILE.BRIDGE && bridgeValue <= 0.04) {
        // Draw faint outline slot for inactive bridge
        const p0 = this.project({ x: x + pad, y: 0, z: z + pad });
        const p1 = this.project({ x: x + 1 - pad, y: 0, z: z + pad });
        const p2 = this.project({ x: x + 1 - pad, y: 0, z: z + 1 - pad });
        const p3 = this.project({ x: x + pad, y: 0, z: z + 1 - pad });
        this.ctx.save();
        this.ctx.setLineDash([4, 4]);
        this.drawPolygon([p0, p1, p2, p3], 'rgba(148, 163, 184, 0.05)', 'rgba(148, 163, 184, 0.22)', 1);
        this.ctx.restore();
        return;
      }

      let color = '#334155';
      let stroke = 'rgba(148, 163, 184, 0.25)';

      if (type === TILE.FRAGILE) {
        color = '#d97706';
        stroke = 'rgba(253, 186, 116, 0.45)';
      } else if (type === TILE.BRIDGE) {
        color = '#0d9488';
        stroke = 'rgba(94, 234, 212, 0.45)';
      } else if (type === TILE.SWITCH_SOFT || type === TILE.SWITCH_HEAVY) {
        color = '#475569';
      } else if (type === TILE.GOAL) {
        color = '#1e293b';
      } else {
        // Checkerboard subtle variation
        color = (x + z) % 2 === 0 ? '#3b4a62' : '#313f54';
      }

      const verts = createCuboidVertices(
        x + pad,
        topY - height,
        z + pad,
        x + 1 - pad,
        topY,
        z + 1 - pad
      );
      this.drawBox(verts, color, stroke, alpha);

      // Surface details
      if (type === TILE.GOAL) {
        this.drawGoalPortal(x, z, topY, time);
      } else if (type === TILE.FRAGILE) {
        this.drawFragileCracks(x, z, topY);
      } else if (type === TILE.SWITCH_SOFT) {
        this.drawSoftSwitch(x, z, topY, time);
      } else if (type === TILE.SWITCH_HEAVY) {
        this.drawHeavySwitch(x, z, topY);
      }
    }

    drawGoalPortal(x, z, y, time) {
      const pad = 0.16;
      const pts = [
        this.project({ x: x + pad, y: y + 0.004, z: z + pad }),
        this.project({ x: x + 1 - pad, y: y + 0.004, z: z + pad }),
        this.project({ x: x + 1 - pad, y: y + 0.004, z: z + 1 - pad }),
        this.project({ x: x + pad, y: y + 0.004, z: z + 1 - pad }),
      ];
      const pulse = 0.65 + 0.35 * Math.sin(time * 4);
      this.drawPolygon(pts, '#020617', `rgba(34, 211, 238, ${pulse})`, 2.2);

      const innerPad = 0.32;
      const innerPts = [
        this.project({ x: x + innerPad, y: y + 0.005, z: z + innerPad }),
        this.project({ x: x + 1 - innerPad, y: y + 0.005, z: z + innerPad }),
        this.project({ x: x + 1 - innerPad, y: y + 0.005, z: z + 1 - innerPad }),
        this.project({ x: x + innerPad, y: y + 0.005, z: z + 1 - innerPad }),
      ];
      this.drawPolygon(innerPts, `rgba(6, 182, 212, ${0.22 * pulse})`, null);
    }

    drawFragileCracks(x, z, y) {
      const ctx = this.ctx;
      const p1 = this.project({ x: x + 0.2, y: y + 0.004, z: z + 0.25 });
      const p2 = this.project({ x: x + 0.55, y: y + 0.004, z: z + 0.5 });
      const p3 = this.project({ x: x + 0.8, y: y + 0.004, z: z + 0.78 });
      const p4 = this.project({ x: x + 0.75, y: y + 0.004, z: z + 0.28 });
      ctx.save();
      ctx.strokeStyle = 'rgba(254, 243, 199, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.stroke();
      ctx.restore();
    }

    drawSoftSwitch(x, z, y, time) {
      const c = this.project({ x: x + 0.5, y: y + 0.01, z: z + 0.5 });
      const rx = this.scale * 0.24;
      const ry = this.scale * 0.14;
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(207, 250, 254, ${0.65 + 0.35 * Math.sin(time * 3)})`;
      ctx.stroke();
      ctx.restore();
    }

    drawHeavySwitch(x, z, y) {
      const ctx = this.ctx;
      const a1 = this.project({ x: x + 0.25, y: y + 0.01, z: z + 0.25 });
      const a2 = this.project({ x: x + 0.75, y: y + 0.01, z: z + 0.75 });
      const b1 = this.project({ x: x + 0.75, y: y + 0.01, z: z + 0.25 });
      const b2 = this.project({ x: x + 0.25, y: y + 0.01, z: z + 0.75 });
      ctx.save();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.moveTo(b1.x, b1.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.stroke();
      ctx.restore();
    }

    getBlockVertices(block, anim) {
      let minX = block.x;
      let minZ = block.z;
      let maxX = block.x + (block.orientation === 'LYING_X' ? 2 : 1);
      let maxZ = block.z + (block.orientation === 'LYING_Z' ? 2 : 1);
      let minY = 0;
      let maxY = block.orientation === 'STANDING' ? 2 : 1;

      const margin = 0.03;
      let verts = createCuboidVertices(
        minX + margin,
        minY,
        minZ + margin,
        maxX - margin,
        maxY,
        maxZ - margin
      );

      if (anim && anim.type === 'ROLL') {
        const t = anim.progress;
        // Ease out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        const angle = (Math.PI / 2) * eased * anim.sign;
        verts = verts.map((v) => rotatePointAroundAxis(v, anim.pivot, anim.axis, angle));
      } else if (anim && (anim.type === 'FALL' || anim.type === 'WIN')) {
        const t = anim.progress;
        const dropY = anim.type === 'WIN' ? -(t * t) * 2.2 : -(t * t) * 5.5;
        const tilt = anim.type === 'FALL' ? t * 0.85 : 0;
        const center = {
          x: (minX + maxX) / 2,
          y: 0.5,
          z: (minZ + maxZ) / 2,
        };
        verts = verts.map((v) => {
          const rotated = tilt ? rotatePointAroundAxis(v, center, anim.fallAxis || 'z', tilt * (anim.fallSign || 1)) : v;
          return { x: rotated.x, y: rotated.y + dropY, z: rotated.z };
        });
      }

      return verts;
    }

    render(sceneState) {
      const { grid, bridgeProgress, block, anim, time } = sceneState;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      this.computeCamera(grid);

      const blockVerts = this.getBlockVertices(block, anim);
      const minBlockY = Math.min(...blockVerts.map((v) => v.y));
      const blockDepth = blockVerts.reduce((acc, v) => acc + v.x + v.z, 0) / blockVerts.length;

      // Collect tiles in painter's order
      const tiles = [];
      for (let z = 0; z < grid.length; z++) {
        for (let x = 0; x < grid[z].length; x++) {
          tiles.push({ x, z, depth: x + z });
        }
      }
      tiles.sort((a, b) => a.depth - b.depth);

      let blockDrawn = false;
      const blockAlpha = anim && anim.type === 'WIN'
        ? Math.max(0, 1 - anim.progress * 1.1)
        : anim && anim.type === 'FALL'
          ? Math.max(0, 1 - anim.progress * 0.9)
          : 1;

      const drawBlockNow = () => {
        if (blockDrawn) return;
        blockDrawn = true;
        this.drawBox(blockVerts, '#6366f1', 'rgba(199, 210, 254, 0.5)', blockAlpha);
      };

      for (const tile of tiles) {
        if (minBlockY < -0.05 && !blockDrawn && tile.depth > blockDepth) {
          drawBlockNow();
        }
        const key = `${tile.x},${tile.z}`;
        const bv = bridgeProgress[key] !== undefined ? bridgeProgress[key] : 1;
        this.drawTile(tile.x, tile.z, grid[tile.z][tile.x], bv, time);
      }

      if (!blockDrawn) {
        drawBlockNow();
      }

      // Draw particles
      for (const p of this.particles) {
        const pt = this.project(p);
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  global.CubixRenderer3D = Renderer3D;
})(window);
