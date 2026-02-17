import React, { useState, useEffect, useRef } from 'react';

export function ScreenshotView() {
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {

        // Clear body background for transparency
        document.body.style.background = 'transparent';
        document.documentElement.style.background = 'transparent';

        // Esc key to cancel
        const handleKeyDown = (e: KeyboardEvent) => {

            if (e.key === 'Escape') {
                window.ipcRenderer?.send('cancel-capture');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            // Restore background (optional, but good practice if single page app navigates back)
            document.body.style.background = '';
            document.documentElement.style.background = '';
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {

        setIsSelecting(true);
        setStartPos({ x: e.clientX, y: e.clientY });
        setCurrentPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isSelecting) {
            setCurrentPos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => {
        if (isSelecting) {
            setIsSelecting(false);
            const rect = {
                x: Math.min(startPos.x, currentPos.x),
                y: Math.min(startPos.y, currentPos.y),
                width: Math.abs(currentPos.x - startPos.x),
                height: Math.abs(currentPos.y - startPos.y),
            };

            if (rect.width > 10 && rect.height > 10) {
                window.ipcRenderer?.send('capture-complete', rect);
            } else {
                // Too small, ignore
                window.ipcRenderer?.send('cancel-capture');
            }
        }
    };

    const selectionStyle = {
        left: Math.min(startPos.x, currentPos.x),
        top: Math.min(startPos.y, currentPos.y),
        width: Math.abs(currentPos.x - startPos.x),
        height: Math.abs(currentPos.y - startPos.y),
    };

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 cursor-crosshair bg-black/10 select-none z-50"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Dimmed background using SVG mask to "cut out" the selection */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                    <mask id="selection-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {isSelecting && (
                            <rect
                                x={selectionStyle.left}
                                y={selectionStyle.top}
                                width={selectionStyle.width}
                                height={selectionStyle.height}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.4)"
                    mask="url(#selection-mask)"
                />
            </svg>

            {/* Selection Border */}
            {isSelecting && (
                <div
                    className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                    style={{
                        ...selectionStyle,
                    }}
                />
            )}

            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg pointer-events-none">
                Select area to translate (Esc to cancel)
            </div>
        </div>
    );
}
