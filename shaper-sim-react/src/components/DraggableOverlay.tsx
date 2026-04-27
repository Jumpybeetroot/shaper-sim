import React, { useState, useRef } from 'react';

interface DraggableOverlayProps {
  children: React.ReactNode;
  defaultPosition?: { top?: number | string; right?: number | string; left?: number | string; bottom?: number | string };
}

export const DraggableOverlay: React.FC<DraggableOverlayProps> = ({ 
  children, 
  defaultPosition = { top: 24, right: 24 } 
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only accept left clicks or touches
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    // Prevent dragging if the user is interacting with an input or selecting text
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'input' || target.closest('.compliance-bar-container')) {
      return;
    }

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };
    
    // Capture all pointer events so we keep dragging even if the mouse leaves the box
    target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    setPosition({
      x: initialPos.current.x + dx,
      y: initialPos.current.y + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      const target = e.target as HTMLElement;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
    }
  };

  return (
    <div 
      className={`draggable-overlay ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        ...defaultPosition,
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 20,
        pointerEvents: 'auto',
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {children}
    </div>
  );
};
