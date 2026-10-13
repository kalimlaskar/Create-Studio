'use client';

import React, { useState, useRef } from 'react';

interface StudioLayoutProps {
    previewContent: React.ReactNode;
    timelineContent: React.ReactNode;
}

export function StudioLayout({ previewContent, timelineContent }: StudioLayoutProps) {
    const [previewHeight, setPreviewHeight] = useState<number>(380);
    const isDragging = useRef<boolean>(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;

        const handleMouseMove = (mouseEvent: MouseEvent) => {
            if (!isDragging.current) return;
            const newHeight = mouseEvent.clientY - 140;
            if (newHeight >= 150 && newHeight <= 700) {
                setPreviewHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div className="flex flex-col flex-1 h-full overflow-hidden bg-[#14121F]">
            {/* Resizable Video Preview Section */}
            <div
                style={{ height: `${previewHeight}px` }}
                className="relative flex flex-col shrink-0 overflow-hidden transition-all duration-75"
            >
                {previewContent}
            </div>

            {/* Draggable Splitter Bar */}
            <div
                onMouseDown={handleMouseDown}
                className="h-2 w-full bg-[#14121F]/40 hover:bg-[#6A4CFF] cursor-row-resize flex items-center justify-center transition-colors group z-30 select-none"
                title="Drag to resize preview and timeline"
            >
                <div className="w-12 h-1 bg-white/30 rounded-full group-hover:bg-white transition-colors" />
            </div>

            {/* Timeline Section */}
            <div className="flex flex-1 flex-col min-h-0 overflow-y-auto bg-white">
                {timelineContent}
            </div>
        </div>
    );
}