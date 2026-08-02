// app/page.tsx
'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const BrowserView = dynamic(() => import('../components/BrowserView'), { ssr: false });

export default function Page() {
  return (
    <main className="h-full">
      <BrowserView />
    </main>
  );
}
