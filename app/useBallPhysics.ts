'use client'

import { useEffect, useState, useRef, useCallback } from 'react';
import Matter from 'matter-js';
import type { Doc } from 'yjs';
import type { WebsocketProvider } from 'y-websocket';

export const BALL_RADIUS = 20;
/** Soccer-ball feel: light kick force, heavy ball, rolls to a stop on "grass" */
const CURSOR_FORCE = 0.00035;
const BALL_KEY = 'ball';

export interface BallState {
    x: number;
    y: number;
    vx?: number;
    vy?: number;
}

export interface CursorState {
    cursor: { x: number; y: number };
    color: string;
    clientID: number;
}

function getLowestClientID(awareness: WebsocketProvider['awareness']): number | null {
    const states = awareness.getStates();
    if (states.size === 0) return null;
    let min = Infinity;
    states.forEach((_, id) => {
        if (id < min) min = id;
    });
    return min === Infinity ? null : min;
}

function getAllCursors(
    localCursor: { x: number; y: number } | null,
    remoteCursors: Map<number, CursorState>
): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = [];
    if (localCursor) out.push(localCursor);
    remoteCursors.forEach((state) => {
        if (state.cursor) out.push(state.cursor);
    });
    return out;
}

export function useBallPhysics(
    ydoc: Doc,
    provider: WebsocketProvider | null,
    clientID: number,
    cursorPos: { x: number; y: number },
    remoteCursors: Map<number, CursorState>
): BallState {
    const [ballPos, setBallPos] = useState<BallState>(() => ({ x: 0, y: 0 }));
    const engineRef = useRef<Matter.Engine | null>(null);
    const ballRef = useRef<Matter.Body | null>(null);
    const wallsRef = useRef<Matter.Body[]>([]);
    const rafRef = useRef<number>(0);
    const cursorPosRef = useRef(cursorPos);
    const remoteCursorsRef = useRef(remoteCursors);
    useEffect(() => {
        cursorPosRef.current = cursorPos;
        remoteCursorsRef.current = remoteCursors;
    }, [cursorPos, remoteCursors]);

    const syncFromMap = useCallback(() => {
        if (!provider) return;
        const ballMap = ydoc.getMap(BALL_KEY);
        const raw = ballMap.get(BALL_KEY);
        if (raw && typeof raw === 'object' && 'x' in raw && 'y' in raw) {
            const b = raw as BallState;
            setBallPos({ x: b.x, y: b.y });
        }
    }, [ydoc, provider]);

    useEffect(() => {
        if (!provider) return;

        const ballMap = ydoc.getMap(BALL_KEY);

        const handler = () => syncFromMap();
        ballMap.observe(handler);
        queueMicrotask(() => syncFromMap());

        return () => {
            ballMap.unobserve(handler);
        };
    }, [provider, ydoc, syncFromMap]);

    useEffect(() => {
        if (!provider) return;

        const ballMap = ydoc.getMap(BALL_KEY);
        const awareness = provider.awareness;
        const width = typeof window !== 'undefined' ? window.innerWidth : 800;
        const height = typeof window !== 'undefined' ? window.innerHeight : 600;
        const centerX = width / 2;
        const centerY = height / 2;

        const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
        engineRef.current = engine;

        const thickness = 10;
        const walls = [
            Matter.Bodies.rectangle(centerX, -thickness / 2, width + thickness * 2, thickness, { isStatic: true }),
            Matter.Bodies.rectangle(centerX, height + thickness / 2, width + thickness * 2, thickness, { isStatic: true }),
            Matter.Bodies.rectangle(-thickness / 2, centerY, thickness, height + thickness * 2, { isStatic: true }),
            Matter.Bodies.rectangle(width + thickness / 2, centerY, thickness, height + thickness * 2, { isStatic: true }),
        ];
        Matter.Composite.add(engine.world, walls);
        wallsRef.current = walls;

        const existing = ballMap.get(BALL_KEY) as BallState | undefined;
        const startX = existing && typeof existing.x === 'number' ? existing.x : centerX;
        const startY = existing && typeof existing.y === 'number' ? existing.y : centerY;
        const startVx = existing && typeof existing.vx === 'number' ? existing.vx : 0;
        const startVy = existing && typeof existing.vy === 'number' ? existing.vy : 0;

        const ball = Matter.Bodies.circle(startX, startY, BALL_RADIUS, {
            restitution: 0.35,
            friction: 0.02,
            frictionAir: 0.018,
            density: 0.004,
        });
        Matter.Body.setVelocity(ball, { x: startVx, y: startVy });
        Matter.Composite.add(engine.world, ball);
        ballRef.current = ball;

        let lastTime = 0;
        const tick = (time: number) => {
            rafRef.current = requestAnimationFrame(tick);
            const lowest = getLowestClientID(awareness);
            const isOwner = lowest !== null && clientID === lowest;

            if (!isOwner) {
                lastTime = time;
                return;
            }

            const cursors = getAllCursors(cursorPosRef.current, remoteCursorsRef.current);
            const kickRadius = BALL_RADIUS * 1.5;
            cursors.forEach((c) => {
                const dx = ball.position.x - c.x;
                const dy = ball.position.y - c.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < kickRadius && dist > 0) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    Matter.Body.applyForce(ball, ball.position, {
                        x: nx * CURSOR_FORCE * (kickRadius - dist),
                        y: ny * CURSOR_FORCE * (kickRadius - dist),
                    });
                }
            });

            Matter.Engine.update(engine, time - lastTime);
            lastTime = time;

            const state: BallState = {
                x: ball.position.x,
                y: ball.position.y,
                vx: ball.velocity.x,
                vy: ball.velocity.y,
            };
            ballMap.set(BALL_KEY, state);
            setBallPos(state);
        };
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafRef.current);
            Matter.Composite.remove(engine.world, ball);
            Matter.Composite.remove(engine.world, walls);
            Matter.Engine.clear(engine);
            engineRef.current = null;
            ballRef.current = null;
            wallsRef.current = [];
        };
    }, [provider, ydoc, clientID]);

    return ballPos;
}
