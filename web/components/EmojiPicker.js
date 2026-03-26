import { useEffect, useRef } from "react";

const EMOJI_CATEGORIES = {
  smileys: {
    label: "😊",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😌", "😔", "😑", "😐", "😐", "😑", "😒", "🙁", "☹️", "😲", "😞", "😖", "😢", "😭", "😤", "😠", "😡", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖"]
  },
  gestures: {
    label: "👋",
    emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🤜", "🤛", "🫱", "🫲", "💅", "👂", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄"]
  },
  hearts: {
    label: "❤️",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌", "💤", "💋"]
  },
  hand: {
    label: "👌",
    emojis: ["👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝"]
  },
  animals: {
    label: "🐶",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰", "🦟"]
  },
  food: {
    label: "🍎",
    emojis: ["🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥑", "🍆", "🍅", "🌶️", "🌽", "🥒", "🥬", "🥦", "🧄", "🧅", "🍄", "🥜", "🌰", "🍞", "🥐", "🥖", "🥨", "🥯", "🥞", "🧇", "🥚", "🍳", "🧈", "🥞", "🥓", "🥔", "🍟", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕"]
  },
  travel: {
    label: "🎡",
    emojis: ["✈️", "🛫", "🛬", "🛩️", "💺", "🛰️", "🚁", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒", "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚙", "🚚", "🚛", "🚜", "🏎️", "🏍️", "🛵", "🦯", "🦽", "🦼", "🛺", "🚲", "🛴", "🛹", "🛼", "🛞", "🚏", "⛽"]
  },
  activities: {
    label: "⚽",
    emojis: ["⚽", "⚾", "🥎", "🎾", "🏀", "🏐", "🏈", "🏉", "🥏", "🎳", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🥅", "⛳", "⛸️", "🎣", "🎽", "🎿", "⛷️", "🏂", "🪂", "🤼", "🤸", "⛹️", "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚴", "🚵", "🤹", "🎪"]
  }
};

export function EmojiPicker({ isOpen, onClose, onEmojiSelect, triggerRef }) {
  const pickerRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target) && 
          triggerRef?.current && !triggerRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-80 rounded-2xl border border-white/10 bg-[#1a1b1b] shadow-[0_16px_32px_rgba(0,0,0,0.4)]"
    >
      <div className="flex h-12 items-center border-b border-white/10 px-3">
        <h3 className="flex-1 text-sm font-semibold text-white">Emoji</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          title="Close emoji picker"
        >
          ✕
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="max-h-64 overflow-y-auto p-3"
      >
        <div className="space-y-3">
          {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
            <div key={key}>
              <div className="mb-2 text-xs font-semibold text-white/50">
                {category.label}
              </div>
              <div className="grid grid-cols-8 gap-2">
                {category.emojis.map((emoji, idx) => (
                  <button
                    key={`${key}-${idx}`}
                    type="button"
                    onClick={() => {
                      onEmojiSelect(emoji);
                      onClose();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-white/10"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
