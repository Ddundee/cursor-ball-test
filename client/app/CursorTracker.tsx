'use client'

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs';
import { useBallPhysics, BALL_RADIUS } from './useBallPhysics';

const COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

function pickColor(id: number): string {
    return COLORS[id % COLORS.length];
}

interface CursorState {
    cursor: { x: number; y: number };
    color: string;
    clientID: number;
}

export default function CursorTracker() {
    const [ydoc] = useState(() => new Doc());
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const clientID = ydoc.clientID;
    const myColor = pickColor(clientID);

    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [remoteCursors, setRemoteCursors] = useState<Map<number, CursorState>>(new Map());

    const ballPos = useBallPhysics(ydoc, provider, clientID, cursorPos, remoteCursors);

    const updateRemoteCursors = useCallback((awareness: WebsocketProvider['awareness']) => {
        const states = awareness.getStates();
        const remote = new Map<number, CursorState>();
        states.forEach((state, id) => {
            if (id !== clientID && state.cursor) {
                remote.set(id, state as CursorState);
            }
        });
        setRemoteCursors(remote);
    }, [clientID]);

    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
        const p = new WebsocketProvider(wsUrl, 'demo-room', ydoc);
        queueMicrotask(() => setProvider(p));

        p.awareness.setLocalStateField('color', myColor);
        p.awareness.setLocalStateField('clientID', clientID);

        const handleMouseMove = (event: MouseEvent) => {
            const pos = { x: event.clientX, y: event.clientY };
            setCursorPos(pos);
            p.awareness.setLocalStateField('cursor', pos);
        };

        const handleMouseLeave = () => {
            p.awareness.setLocalStateField('cursor', null);
        };

        const handleAwarenessChange = () => {
            updateRemoteCursors(p.awareness);
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        p.awareness.on('change', handleAwarenessChange);
        handleAwarenessChange();

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            p.awareness.off('change', handleAwarenessChange);
            p.destroy();
            setProvider(null);
            ydoc.destroy();
        };
    }, [ydoc, clientID, myColor, updateRemoteCursors]);

    const ballSize = BALL_RADIUS * 2;

    return (
        <div className="relative w-screen h-screen overflow-hidden select-none bg-linear-to-b from-green-700 via-green-600 to-green-800">
            {/* Field line */}
            <div className="absolute inset-0 border-[3px] border-white/40 rounded-none pointer-events-none" style={{ borderStyle: 'solid' }} />
            <motion.div
                className="absolute pointer-events-none rounded-full drop-shadow-xl"
                style={{
                    width: ballSize,
                    height: ballSize,
                    left: 0,
                    top: 0,
                }}
                animate={{
                    x: ballPos.x - BALL_RADIUS,
                    y: ballPos.y - BALL_RADIUS,
                }}
                transition={{ type: 'tween', duration: 0.05 }}
            >
                <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
                    <circle cx="20" cy="20" r="19.5" fill="#fff" stroke="#111" strokeWidth="0.6" />
                    <path d="M20 4 L23 12 L20 20 L17 12 Z" fill="#111" />
                    <path d="M20 36 L17 28 L20 20 L23 28 Z" fill="#111" />
                    <path d="M4 20 L12 17 L20 20 L12 23 Z" fill="#111" />
                    <path d="M36 20 L28 23 L20 20 L28 17 Z" fill="#111" />
                    <path d="M8 10 L12 14 L10 20 L6 18 Z" fill="#111" />
                    <path d="M32 10 L28 14 L30 20 L34 18 Z" fill="#111" />
                    <path d="M8 30 L6 22 L10 20 L12 26 Z" fill="#111" />
                    <path d="M32 30 L34 22 L30 20 L28 26 Z" fill="#111" />
                </svg>
            </motion.div>
            {[...remoteCursors.entries()].map(([id, state]) => (
                <div
                    key={id}
                    className="pointer-events-none absolute transition-all duration-75 ease-out"
                    style={{ left: state.cursor.x, top: state.cursor.y }}
                >
                    <svg
                        width="20" height="20" viewBox="0 0 24 24"
                        fill={state.color} className="drop-shadow-md"
                    >
                        <path d="M5.65 5.65l3.18 12.72 2.47-4.94 4.94-2.47z" />
                    </svg>
                    <span
                        className="absolute left-5 top-4 text-xs font-mono px-1.5 py-0.5 rounded whitespace-nowrap text-white"
                        style={{ backgroundColor: state.color }}
                    >
                        User {id}
                    </span>
                </div>
            ))}

            <div className="absolute top-4 left-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-xl shadow-lg p-4 font-mono text-sm space-y-3 min-w-[220px]">
                <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1">You</div>
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: myColor }}
                        />
                        <span>{clientID}</span>
                        <span className="text-neutral-400 ml-auto">
                            ({cursorPos.x}, {cursorPos.y})
                        </span>
                    </div>
                </div>

                {remoteCursors.size > 0 && (
                    <div>
                        <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1">
                            Others ({remoteCursors.size})
                        </div>
                        <div className="space-y-1">
                            {[...remoteCursors.entries()].map(([id, state]) => (
                                <div key={id} className="flex items-center gap-2">
                                    <span
                                        className="inline-block w-3 h-3 rounded-full"
                                        style={{ backgroundColor: state.color }}
                                    />
                                    <span>{id}</span>
                                    <span className="text-neutral-400 ml-auto">
                                        ({state.cursor.x}, {state.cursor.y})
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {remoteCursors.size === 0 && (
                    <p className="text-neutral-400 text-xs">
                        Open another browser tab to see remote cursors
                    </p>
                )}
            </div>
        </div>
    );
}
