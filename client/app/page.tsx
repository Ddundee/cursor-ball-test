'use client'

import dynamic from 'next/dynamic';

const CursorTracker = dynamic(() => import('./CursorTracker'), { ssr: false });

export default function Home() {
    return <CursorTracker />;
}
