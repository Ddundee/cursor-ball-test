/**
 * Physics authority: runs matter.js and writes ball state to the shared Y doc.
 * Connect to the same y-websocket server as clients; read cursors from awareness (normalized 0–1), step engine, write ball to Y.Map('ball').
 */
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Matter from 'matter-js';
import ws from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:1234';
const ROOM = process.env.ROOM || 'demo-room';
const FIELD_WIDTH = 1200;
const FIELD_HEIGHT = 800;
const BALL_RADIUS = 20;
const BALL_KEY = 'ball';
const CURSOR_FORCE = 0.00035;
const TICK_MS = 1000 / 60;

const doc = new Y.Doc();
const provider = new WebsocketProvider(WS_URL, ROOM, doc, { WebSocketPolyfill: ws });

provider.on('status', (e) => {
  console.log('[physics] ws', e.status);
});

const ballMap = doc.getMap(BALL_KEY);
const awareness = provider.awareness;

const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
const thickness = 20;
const walls = [
  Matter.Bodies.rectangle(FIELD_WIDTH / 2, -thickness / 2, FIELD_WIDTH + thickness * 2, thickness, { isStatic: true }),
  Matter.Bodies.rectangle(FIELD_WIDTH / 2, FIELD_HEIGHT + thickness / 2, FIELD_WIDTH + thickness * 2, thickness, { isStatic: true }),
  Matter.Bodies.rectangle(-thickness / 2, FIELD_HEIGHT / 2, thickness, FIELD_HEIGHT + thickness * 2, { isStatic: true }),
  Matter.Bodies.rectangle(FIELD_WIDTH + thickness / 2, FIELD_HEIGHT / 2, thickness, FIELD_HEIGHT + thickness * 2, { isStatic: true }),
];
Matter.Composite.add(engine.world, walls);

const existing = ballMap.get(BALL_KEY);
const startX = existing?.x ?? FIELD_WIDTH / 2;
const startY = existing?.y ?? FIELD_HEIGHT / 2;
const startVx = existing?.vx ?? 0;
const startVy = existing?.vy ?? 0;

const ball = Matter.Bodies.circle(startX, startY, BALL_RADIUS, {
  restitution: 0.35,
  friction: 0.02,
  frictionAir: 0.018,
  density: 0.004,
});
Matter.Body.setVelocity(ball, { x: startVx, y: startVy });
Matter.Composite.add(engine.world, ball);

let lastTime = Date.now();

function tick() {
  const now = Date.now();
  const delta = now - lastTime;
  lastTime = now;

  const states = awareness.getStates();
  states.forEach((state) => {
    const c = state.cursor;
    if (!c || typeof c.x !== 'number' || typeof c.y !== 'number') return;
    const fx = c.x * FIELD_WIDTH;
    const fy = c.y * FIELD_HEIGHT;
    const dx = ball.position.x - fx;
    const dy = ball.position.y - fy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= BALL_RADIUS && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      const push = CURSOR_FORCE * (BALL_RADIUS - dist + 5);
      Matter.Body.applyForce(ball, ball.position, { x: nx * push, y: ny * push });
    }
  });

  Matter.Engine.update(engine, delta);

  ballMap.set(BALL_KEY, {
    x: ball.position.x,
    y: ball.position.y,
    vx: ball.velocity.x,
    vy: ball.velocity.y,
  });
}

setInterval(tick, TICK_MS);
console.log('[physics] running in', FIELD_WIDTH, 'x', FIELD_HEIGHT, 'at', WS_URL, ROOM);
