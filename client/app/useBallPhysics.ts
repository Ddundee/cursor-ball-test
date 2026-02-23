'use client'

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Doc } from 'yjs';
import type { WebsocketProvider } from 'y-websocket';

/** Server runs physics in this field size; we scale to viewport for display */
export const FIELD_WIDTH = 1200;
export const FIELD_HEIGHT = 800;

export const BALL_RADIUS = 20;
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
    name?: string;
}

function scaleToScreen(
    fieldX: number,
    fieldY: number,
    viewportWidth: number,
    viewportHeight: number
): { x: number; y: number } {
    return {
        x: fieldX * (viewportWidth / FIELD_WIDTH),
        y: fieldY * (viewportHeight / FIELD_HEIGHT),
    };
}

export function useBallPhysics(
    ydoc: Doc,
    provider: WebsocketProvider | null
): BallState {
    const [ballPos, setBallPos] = useState<BallState>(() => ({ x: 0, y: 0 }));
    const viewportRef = useRef({ w: 0, h: 0 });

    const syncFromMap = useCallback(() => {
        if (!provider) return;
        const ballMap = ydoc.getMap(BALL_KEY);
        const raw = ballMap.get(BALL_KEY);
        if (raw && typeof raw === 'object' && 'x' in raw && 'y' in raw) {
            const b = raw as BallState;
            const { w, h } = viewportRef.current;
            const screen = w && h ? scaleToScreen(b.x, b.y, w, h) : { x: b.x, y: b.y };
            setBallPos({ ...b, x: screen.x, y: screen.y });
        }
    }, [ydoc, provider]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        viewportRef.current = { w: window.innerWidth, h: window.innerHeight };
        const onResize = () => {
            viewportRef.current = { w: window.innerWidth, h: window.innerHeight };
            syncFromMap();
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [syncFromMap]);

    useEffect(() => {
        if (!provider) return;
        const ballMap = ydoc.getMap(BALL_KEY);
        const handler = () => syncFromMap();
        ballMap.observe(handler);
        queueMicrotask(() => syncFromMap());
        return () => ballMap.unobserve(handler);
    }, [provider, ydoc, syncFromMap]);

    return ballPos;
}
