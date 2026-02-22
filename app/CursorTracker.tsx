'use client'

import { useEffect, useState, useCallback } from 'react';
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs';

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
    const clientID = ydoc.clientID;
    const myColor = pickColor(clientID);

    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [remoteCursors, setRemoteCursors] = useState<Map<number, CursorState>>(new Map());

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
        const provider = new WebsocketProvider(
            'ws://localhost:1234', 'demo-room', ydoc
        );

        provider.awareness.setLocalStateField('color', myColor);
        provider.awareness.setLocalStateField('clientID', clientID);

        const handleMouseMove = (event: MouseEvent) => {
            const pos = { x: event.clientX, y: event.clientY };
            setCursorPos(pos);
            provider.awareness.setLocalStateField('cursor', pos);
        };

        const handleMouseLeave = () => {
            provider.awareness.setLocalStateField('cursor', null);
        };

        const handleAwarenessChange = () => {
            updateRemoteCursors(provider.awareness);
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        provider.awareness.on('change', handleAwarenessChange);
        handleAwarenessChange();

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            provider.awareness.off('change', handleAwarenessChange);
            provider.destroy();
            ydoc.destroy();
        };
    }, [ydoc, clientID, myColor, updateRemoteCursors]);

    return (
        <div className="relative w-screen h-screen overflow-hidden select-none">
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
