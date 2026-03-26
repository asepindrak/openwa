export function MessageSkeleton() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[72%] space-y-2 rounded-[18px] bg-[#2e2f2f] px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-3 flex justify-between">
          <div className="h-3 w-12 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-8 animate-pulse rounded bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function MessagesSkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <MessageSkeleton key={i} />
      ))}
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-3 py-3 transition hover:bg-white/5 cursor-pointer">
      <div className="h-12 w-12 animate-pulse rounded-2xl bg-white/10" />
      <div className="flex-1 min-w-0">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10 mb-2" />
        <div className="h-3 w-48 animate-pulse rounded bg-white/5" />
      </div>
      <div className="h-3 w-10 animate-pulse rounded bg-white/5" />
    </div>
  );
}

export function ConversationsSkeletonList() {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, i) => (
        <ConversationSkeleton key={i} />
      ))}
    </div>
  );
}

export function ImageGroupSkeleton() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[72%] rounded-[18px] overflow-hidden bg-[#2e2f2f]">
        <div className="grid grid-cols-2 gap-1 p-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 w-32 animate-pulse rounded-lg bg-white/10" />
          ))}
        </div>
        <div className="px-4 py-3 border-t border-white/10">
          <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function SendButtonSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
