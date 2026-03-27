import { useEffect, useRef, useState } from "react";
import { MdReply, MdDelete, MdShare } from "react-icons/md";

export function MessageActionMenu({ 
  isOpen, 
  onClose, 
  message, 
  onReply, 
  onDelete, 
  onForward,
  isOutbound,
  triggerRef
}) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, transformOrigin: "top-right" });

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          triggerRef?.current && !triggerRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen || !triggerRef?.current || !menuRef?.current) return;

    const calculatePosition = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuWidth = 224; // w-56 = 14rem = 224px
      const menuHeight = menuRect.height || 180;
      const gap = 8;

      let top = 0;
      let left = 0;
      let transformOrigin = "top-right";

      // Calculate horizontal position
      const spaceRight = viewportWidth - triggerRect.right;
      const spaceLeft = triggerRect.left;

      if (spaceRight >= menuWidth + gap) {
        // Show on the right
        left = triggerRect.width + gap;
        transformOrigin = "top-left";
      } else if (spaceLeft >= menuWidth + gap) {
        // Show on the left
        left = -(menuWidth + gap);
        transformOrigin = "top-right";
      } else {
        // Not enough space, show to the right anyway but may overlap
        left = triggerRect.width + gap;
        transformOrigin = "top-left";
      }

      // Calculate vertical position
      const spaceBottom = viewportHeight - triggerRect.bottom;
      const spaceTop = triggerRect.top;

      if (spaceBottom >= menuHeight + gap) {
        // Show below the button
        top = triggerRect.height + gap;
      } else if (spaceTop >= menuHeight + gap) {
        // Show above the button
        top = -(menuHeight + gap);
      } else {
        // Not enough space, show below anyway
        top = triggerRect.height + gap;
      }

      setPosition({ top, left, transformOrigin });
    };

    calculatePosition();
    window.addEventListener("resize", calculatePosition);
    return () => window.removeEventListener("resize", calculatePosition);
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  return (
    <div 
      ref={menuRef}
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transformOrigin: position.transformOrigin,
      }}
      className="z-50 w-56 rounded-2xl border border-white/10 bg-[#1a1b1b] shadow-[0_16px_32px_rgba(0,0,0,0.4)]"
    >
      <button
        type="button"
        onClick={onClose}
        className="flex w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
      >
        <span>←</span>
        <span>Back</span>
      </button>

      <div className="space-y-0">
        <button
          type="button"
          onClick={() => {
            onReply();
            onClose();
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
        >
          <span><MdReply className="w-4 h-4" /></span>
          <span>Reply</span>
        </button>

        {isOutbound && (
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white/80 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <span><MdDelete className="w-4 h-4" /></span>
            <span>Delete</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onForward();
            onClose();
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
        >
          <span><MdShare className="w-4 h-4" /></span>
          <span>Forward</span>
        </button>
      </div>
    </div>
  );
}
