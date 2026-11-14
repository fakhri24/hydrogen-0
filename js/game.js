(function (global) {
  'use strict';

  class CubixGame {
    constructor(renderer, callbacks) {
      this.renderer = renderer;
      this.callbacks = callbacks || {};
      this.level = null;
      this.block = { x: 0, z: 0, orientation: 'STANDING' };
      this.bridges = {};
      this.bridgeProgress = {};
      this.moves = 0;
      this.history = [];
      this.anim = null;
      this.inputQueue = [];
      this.status = 'IDLE'; // IDLE | ANIMATING | WON | LOST
      this.time = 0;
    }

    loadLevel(levelObj) {
      this.level = levelObj;
      this.block = {
        x: levelObj.start.x,
        z: levelObj.start.z,
        orientation: levelObj.start.orientation,
      };
      this.moves = 0;
      this.history = [];
      this.anim = null;
      this.inputQueue = [];
      this.status = 'IDLE';

      this.bridges = {};
      this.bridgeProgress = {};
      const { TILE } = global.CubixLevels;
      for (let z = 0; z < levelObj.grid.length; z++) {
        for (let x = 0; x < levelObj.grid[z].length; x++) {
          if (levelObj.grid[z][x] === TILE.BRIDGE) {
            const key = `${x},${z}`;
            this.bridges[key] = false;
            this.bridgeProgress[key] = 0;
          }
        }
      }
      for (const b of levelObj.initialBridges || []) {
        const key = `${b.x},${b.z}`;
        this.bridges[key] = Boolean(b.active);
        this.bridgeProgress[key] = b.active ? 1 : 0;
      }

      if (this.callbacks.onStateChange) {
        this.callbacks.onStateChange(this.getHUDState());
      }
    }

    restart() {
      if (this.level) {
        this.loadLevel(this.level);
      }
    }

    getHUDState() {
      return {
        levelId: this.level ? this.level.id : 1,
        levelName: this.level ? this.level.name : '',
        hint: this.level ? this.level.hint : '',
        par: this.level ? this.level.par : 0,
        moves: this.moves,
        canUndo: this.history.length > 0 && this.status === 'IDLE',
      };
    }

    queueMove(dir) {
      if (this.status === 'WON' || this.status === 'LOST') return;
      if (this.inputQueue.length < 2) {
        this.inputQueue.push(dir);
      }
      if (this.status === 'IDLE') {
        this.processNextMove();
      }
    }

    undo() {
      if (this.status !== 'IDLE' || this.history.length === 0) return;
      const snap = this.history.pop();
      this.block = { ...snap.block };
      this.bridges = { ...snap.bridges };
      this.moves = snap.moves;
      global.CubixAudio.playUndo();
      if (this.callbacks.onStateChange) {
        this.callbacks.onStateChange(this.getHUDState());
      }
    }

    processNextMove() {
      if (this.inputQueue.length === 0 || this.status !== 'IDLE') return;
      const dir = this.inputQueue.shift();

      this.history.push({
        block: { ...this.block },
        bridges: { ...this.bridges },
        moves: this.moves,
      });

      const minX = this.block.x;
      const minZ = this.block.z;
      const maxX = minX + (this.block.orientation === 'LYING_X' ? 2 : 1);
      const maxZ = minZ + (this.block.orientation === 'LYING_Z' ? 2 : 1);

      let pivot, axis, sign;
      if (dir === 'RIGHT') {
        axis = 'z';
        sign = -1;
        pivot = { x: maxX, y: 0, z: minZ };
      } else if (dir === 'LEFT') {
        axis = 'z';
        sign = 1;
        pivot = { x: minX, y: 0, z: minZ };
      } else if (dir === 'DOWN') {
        axis = 'x';
        sign = 1;
        pivot = { x: minX, y: 0, z: maxZ };
      } else {
        axis = 'x';
        sign = -1;
        pivot = { x: minX, y: 0, z: minZ };
      }

      const nextBlock = this.computeNextBlock(this.block, dir);
      this.status = 'ANIMATING';
      this.anim = {
        type: 'ROLL',
        dir,
        pivot,
        axis,
        sign,
        nextBlock,
        progress: 0,
        duration: 0.145,
      };
    }

    computeNextBlock(b, dir) {
      const { x, z, orientation: o } = b;
      if (o === 'STANDING') {
        if (dir === 'RIGHT') return { x: x + 1, z, orientation: 'LYING_X' };
        if (dir === 'LEFT') return { x: x - 2, z, orientation: 'LYING_X' };
        if (dir === 'DOWN') return { x, z: z + 1, orientation: 'LYING_Z' };
        return { x, z: z - 2, orientation: 'LYING_Z' };
      }
      if (o === 'LYING_X') {
        if (dir === 'RIGHT') return { x: x + 2, z, orientation: 'STANDING' };
        if (dir === 'LEFT') return { x: x - 1, z, orientation: 'STANDING' };
        if (dir === 'DOWN') return { x, z: z + 1, orientation: 'LYING_X' };
        return { x, z: z - 1, orientation: 'LYING_X' };
      }
      if (dir === 'RIGHT') return { x: x + 1, z, orientation: 'LYING_Z' };
      if (dir === 'LEFT') return { x: x - 1, z, orientation: 'LYING_Z' };
      if (dir === 'DOWN') return { x, z: z + 2, orientation: 'STANDING' };
      return { x, z: z - 1, orientation: 'STANDING' };
    }

    getOccupiedCells(b) {
      if (b.orientation === 'STANDING') return [{ x: b.x, z: b.z }];
      if (b.orientation === 'LYING_X') return [{ x: b.x, z: b.z }, { x: b.x + 1, z: b.z }];
      return [{ x: b.x, z: b.z }, { x: b.x, z: b.z + 1 }];
    }

    finishRoll(dir) {
      this.moves += 1;
      const cells = this.getOccupiedCells(this.block);
      const { TILE } = global.CubixLevels;
      const grid = this.level.grid;
      const rows = grid.length;
      const cols = grid[0].length;

      let fell = false;
      let shattered = false;

      for (const c of cells) {
        if (c.z < 0 || c.z >= rows || c.x < 0 || c.x >= cols) {
          fell = true;
          break;
        }
        const t = grid[c.z][c.x];
        if (t === TILE.VOID) {
          fell = true;
          break;
        }
        if (t === TILE.BRIDGE && !this.bridges[`${c.x},${c.z}`]) {
          fell = true;
          break;
        }
        if (t === TILE.FRAGILE && this.block.orientation === 'STANDING') {
          fell = true;
          shattered = true;
          break;
        }
      }

      if (fell) {
        this.status = 'LOST';
        this.inputQueue = [];
        global.CubixAudio.playFall(shattered);
        const cx = cells.reduce((a, c) => a + c.x, 0) / cells.length + 0.5;
        const cz = cells.reduce((a, c) => a + c.z, 0) / cells.length + 0.5;
        if (shattered) {
          this.renderer.spawnParticles(cx, 0.1, cz, '#f59e0b', 18);
        }
        this.anim = {
          type: 'FALL',
          progress: 0,
          duration: 0.45,
          fallAxis: dir === 'LEFT' || dir === 'RIGHT' ? 'z' : 'x',
          fallSign: dir === 'RIGHT' || dir === 'UP' ? -1 : 1,
        };
        if (this.callbacks.onStateChange) {
          this.callbacks.onStateChange(this.getHUDState());
        }
        return;
      }

      // Play landing thud & dust
      global.CubixAudio.playRoll(this.block.orientation === 'STANDING');
      const landX = cells.reduce((a, c) => a + c.x, 0) / cells.length + 0.5;
      const landZ = cells.reduce((a, c) => a + c.z, 0) / cells.length + 0.5;
      this.renderer.spawnParticles(landX, 0.05, landZ, 'rgba(199, 210, 254, 0.7)', 6);

      // Check Goal
      if (this.block.orientation === 'STANDING' && grid[this.block.z][this.block.x] === TILE.GOAL) {
        this.status = 'WON';
        this.inputQueue = [];
        global.CubixAudio.playWin();
        this.renderer.spawnParticles(this.block.x + 0.5, 0.2, this.block.z + 0.5, '#22d3ee', 20);
        this.anim = {
          type: 'WIN',
          progress: 0,
          duration: 0.42,
        };
        if (this.callbacks.onStateChange) {
          this.callbacks.onStateChange(this.getHUDState());
        }
        return;
      }

      // Check Switches
      let switchTriggered = false;
      for (const sw of this.level.switches || []) {
        const tileType = grid[sw.z][sw.x];
        const hit = tileType === TILE.SWITCH_HEAVY
          ? (this.block.orientation === 'STANDING' && this.block.x === sw.x && this.block.z === sw.z)
          : cells.some((c) => c.x === sw.x && c.z === sw.z);

        if (hit) {
          for (const tgt of sw.targets) {
            const key = `${tgt.x},${tgt.z}`;
            const prev = Boolean(this.bridges[key]);
            const next = sw.action === 'open' ? true : sw.action === 'close' ? false : !prev;
            if (prev !== next) {
              this.bridges[key] = next;
              switchTriggered = true;
            }
          }
        }
      }
      if (switchTriggered) {
        global.CubixAudio.playSwitch();
      }

      this.status = 'IDLE';
      if (this.callbacks.onStateChange) {
        this.callbacks.onStateChange(this.getHUDState());
      }
      this.processNextMove();
    }

    update(dt) {
      this.time += dt;
      this.renderer.updateParticles(dt);

      // Smoothly animate bridges
      for (const [key, active] of Object.entries(this.bridges)) {
        const target = active ? 1 : 0;
        const curr = this.bridgeProgress[key] ?? target;
        const diff = target - curr;
        if (Math.abs(diff) > 0.01) {
          this.bridgeProgress[key] = curr + diff * Math.min(1, dt * 12);
        } else {
          this.bridgeProgress[key] = target;
        }
      }

      if (this.anim) {
        this.anim.progress += dt / this.anim.duration;
        if (this.anim.progress >= 1) {
          const finished = this.anim;
          this.anim = null;

          if (finished.type === 'ROLL') {
            this.block = finished.nextBlock;
            this.finishRoll(finished.dir);
          } else if (finished.type === 'FALL') {
            this.restart();
          } else if (finished.type === 'WIN') {
            if (this.callbacks.onWin) {
              this.callbacks.onWin(this.getHUDState());
            }
          }
        }
      }

      if (this.level) {
        this.renderer.render({
          grid: this.level.grid,
          bridgeProgress: this.bridgeProgress,
          block: this.block,
          anim: this.anim,
          time: this.time,
        });
      }
    }
  }

  global.CubixGame = CubixGame;
})(window);
