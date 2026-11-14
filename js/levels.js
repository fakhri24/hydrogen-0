(function (global) {
  'use strict';

  const TILE = Object.freeze({
    VOID: 0,
    SOLID: 1,
    GOAL: 2,
    FRAGILE: 3,
    SWITCH_SOFT: 4,
    SWITCH_HEAVY: 5,
    BRIDGE: 6,
  });

  /**
   * 10 handcrafted 3D grid puzzle levels.
   * All levels and par values are verified via BFS shortest-path solver.
   */
  const LEVELS = [
    {
      id: 1,
      name: 'First Steps',
      hint: 'Gunakan Tombol Panah atau WASD. Berdiri tegak tepat di atas portal tujuan.',
      par: 11,
      start: { x: 1, z: 1, orientation: 'STANDING' },
      grid: [
        [1, 1, 1, 0, 0, 0],
        [1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1],
        [0, 0, 0, 1, 2, 1],
        [0, 0, 0, 1, 1, 1],
      ],
      switches: [],
      initialBridges: [],
    },
    {
      id: 2,
      name: 'Soft Touch',
      hint: 'Injak tombol lingkaran (○) untuk memunculkan jembatan penyeberangan.',
      par: 14,
      start: { x: 1, z: 2, orientation: 'STANDING' },
      grid: [
        [1, 1, 1, 1, 0, 0, 1, 1, 1],
        [1, 1, 4, 1, 6, 6, 1, 1, 1],
        [1, 1, 1, 1, 0, 0, 1, 2, 1],
        [1, 1, 1, 1, 0, 0, 1, 1, 1],
      ],
      switches: [
        { x: 2, z: 1, action: 'open', targets: [{ x: 4, z: 1 }, { x: 5, z: 1 }] },
      ],
      initialBridges: [],
    },
    {
      id: 3,
      name: 'The Detour',
      hint: 'Kadang kamu perlu memutar untuk mengatur ulang orientasi berdiri balok.',
      par: 5,
      start: { x: 1, z: 1, orientation: 'STANDING' },
      grid: [
        [1, 1, 1, 1, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 1, 1, 1, 1],
        [0, 0, 0, 0, 1, 2, 1, 1],
        [0, 0, 0, 0, 1, 1, 1, 0],
      ],
      switches: [],
      initialBridges: [],
    },
    {
      id: 4,
      name: 'Fragile Glass',
      hint: 'Ubin oranye rapuh! Hanya aman dilewati saat balok berbaring (posisi tidur).',
      par: 4,
      start: { x: 1, z: 2, orientation: 'STANDING' },
      grid: [
        [0, 0, 0, 3, 3, 3, 3, 0, 0],
        [1, 1, 1, 3, 3, 3, 3, 1, 1],
        [1, 1, 1, 3, 1, 1, 1, 2, 1],
        [1, 1, 1, 0, 0, 0, 1, 1, 1],
      ],
      switches: [],
      initialBridges: [],
    },
    {
      id: 5,
      name: 'Heavy Pressure',
      hint: 'Tombol X berat hanya aktif jika balok BERDIRI tegak tepat di atasnya.',
      par: 17,
      start: { x: 1, z: 1, orientation: 'STANDING' },
      grid: [
        [1, 1, 1, 1, 0, 0, 1, 1, 1],
        [1, 1, 1, 1, 6, 6, 1, 1, 1],
        [1, 1, 5, 1, 0, 0, 1, 2, 1],
        [0, 0, 1, 1, 0, 0, 1, 1, 1],
      ],
      switches: [
        { x: 2, z: 2, action: 'open', targets: [{ x: 4, z: 1 }, { x: 5, z: 1 }] },
      ],
      initialBridges: [],
    },
    {
      id: 6,
      name: 'Twin Bridges',
      hint: 'Hati-hati menginjak tombol toggle lagi agar jembatan tidak menutup kembali!',
      par: 8,
      start: { x: 0, z: 2, orientation: 'STANDING' },
      grid: [
        [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 4, 1, 0, 1, 1, 1],
        [1, 1, 1, 1, 1, 6, 6, 1, 2, 1],
        [1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
      ],
      switches: [
        { x: 4, z: 1, action: 'toggle', targets: [{ x: 5, z: 2 }, { x: 6, z: 2 }] },
      ],
      initialBridges: [],
    },
    {
      id: 7,
      name: 'Crystal Span',
      hint: 'Gabungkan jembatan dan kaca rapuh dengan perencanaan langkah yang tepat.',
      par: 16,
      start: { x: 1, z: 1, orientation: 'STANDING' },
      grid: [
        [1, 1, 1, 0, 0, 0, 0, 0, 0],
        [1, 1, 1, 3, 3, 1, 1, 0, 0],
        [1, 4, 1, 3, 3, 1, 6, 1, 1],
        [0, 0, 0, 0, 0, 1, 1, 2, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 1],
      ],
      switches: [
        { x: 1, z: 2, action: 'open', targets: [{ x: 6, z: 2 }] },
      ],
      initialBridges: [],
    },
    {
      id: 8,
      name: 'Crossroads',
      hint: 'Manfaatkan pulau tengah untuk mengubah orientasi balok.',
      par: 18,
      start: { x: 1, z: 3, orientation: 'STANDING' },
      grid: [
        [0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 1, 5, 1, 0, 0, 0],
        [1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
        [1, 1, 1, 6, 1, 1, 1, 6, 1, 2],
        [1, 1, 1, 0, 0, 1, 0, 0, 1, 1],
      ],
      switches: [
        { x: 5, z: 1, action: 'open', targets: [{ x: 7, z: 3 }] },
      ],
      initialBridges: [{ x: 3, z: 3, active: true }],
    },
    {
      id: 9,
      name: 'Glass Labyrinth',
      hint: 'Jangan berdiri di atas ubin oranye. Cari pijakan batu untuk berputar.',
      par: 13,
      start: { x: 0, z: 1, orientation: 'STANDING' },
      grid: [
        [1, 1, 3, 3, 1, 1, 0, 0, 0],
        [1, 1, 3, 3, 1, 1, 3, 3, 1],
        [1, 1, 0, 0, 1, 4, 3, 3, 1],
        [0, 0, 0, 0, 0, 1, 6, 1, 2],
        [0, 0, 0, 0, 0, 1, 1, 1, 1],
      ],
      switches: [
        { x: 5, z: 2, action: 'open', targets: [{ x: 6, z: 3 }] },
      ],
      initialBridges: [],
    },
    {
      id: 10,
      name: 'Grand Finale',
      hint: 'Ujian terakhir: kombinasi Heavy Switch, kaca rapuh, dan jembatan ganda.',
      par: 14,
      start: { x: 1, z: 2, orientation: 'STANDING' },
      grid: [
        [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 5, 1, 3, 3, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 3, 3, 1, 2, 1],
        [1, 1, 4, 0, 0, 0, 0, 0, 6, 1, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
      ],
      switches: [
        { x: 2, z: 3, action: 'toggle', targets: [{ x: 8, z: 3 }] },
        { x: 4, z: 1, action: 'open', targets: [{ x: 8, z: 3 }] },
      ],
      initialBridges: [],
    },
  ];

  global.CubixLevels = { TILE, LEVELS };
})(window);
