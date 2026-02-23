'use client'

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs';
import { useBallPhysics, BALL_RADIUS } from './useBallPhysics';

function useViewport() {
    const [size, setSize] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 });
    useEffect(() => {
        const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return size;
}

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
    name?: string;
}

export default function CursorTracker() {
    const [ydoc] = useState(() => new Doc());
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const clientID = ydoc.clientID;
    const myColor = pickColor(clientID);

    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [userName, setUserName] = useState('');
    const [remoteCursors, setRemoteCursors] = useState<Map<number, CursorState>>(new Map());
    const viewport = useViewport();

    const ballPos = useBallPhysics(ydoc, provider);

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
            const px = { x: event.clientX, y: event.clientY };
            setCursorPos(px);
            const w = window.innerWidth;
            const h = window.innerHeight;
            p.awareness.setLocalStateField('cursor', w && h ? { x: event.clientX / w, y: event.clientY / h } : null);
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

    useEffect(() => {
        if (provider) {
            provider.awareness.setLocalStateField('name', userName.trim() || null);
        }
    }, [provider, userName]);

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
                transition={{ type: 'tween', duration: .0001 }}
            >
                <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
                    <circle cx="20" cy="20" r="19.5" fill="#fff" stroke="#111" strokeWidth="0.6" />
                </svg>
            </motion.div>
            {[...remoteCursors.entries()].map(([id, state]) => (
                <div
                    key={id}
                    className="pointer-events-none absolute transition-all duration-75 ease-out"
                    style={{
                        left: state.cursor.x * viewport.w,
                        top: state.cursor.y * viewport.h,
                    }}
                >
                    <svg
                        width="20" height="20" viewBox="0 0 24 24"
                        fill={state.color} className="drop-shadow-md"
                    >
                        <path d="M5.65 5.65l3.18 12.72 2.47-4.94 4.94-2.47z" />
                    </svg>
                    {state.name?.trim() && <span
                        className="absolute left-5 top-4 text-xs font-mono px-1.5 py-0.5 rounded whitespace-nowrap text-white"
                        style={{ backgroundColor: state.color }}
                    >
                        {state.name?.trim()}
                    </span>}
                </div>
            ))}

            <div className="absolute top-4 left-4 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-xl shadow-lg p-4 font-mono text-sm space-y-3 min-w-[220px]">
                <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1">Your name</div>
                    <input
                        type="text"
                        placeholder="Type your name..."
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    />
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-400 mb-1">You</div>
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: myColor }}
                        />
                        <span>{userName.trim() || `User ${clientID}`}</span>
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
                                    <span>{state.name?.trim() || `User ${id}`}</span>
                                    <span className="text-neutral-400 ml-auto">
                                        ({Math.round(state.cursor.x * viewport.w)}, {Math.round(state.cursor.y * viewport.h)})
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
