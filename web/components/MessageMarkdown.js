import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

function CodeBlock({ inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const rawContent = Array.isArray(children)
    ? children
        .map((item) =>
          typeof item === "string" || typeof item === "number"
            ? String(item)
            : "",
        )
        .join("")
    : typeof children === "string" || typeof children === "number"
      ? String(children)
      : "";
  const content = rawContent.replace(/\n$/, "");
  const language = String(className || "")
    .replace(/^language-/, "")
    .trim();

  const handleCopy = async () => {
    if (!content) return;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        return;
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      setCopied(false);
    }
  };

  if (inline) {
    return (
      <code
        className="rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[0.92em] text-emerald-100"
        {...props}
      >
        {content}
      </code>
    );
  }

  return (
    <div className="relative my-3 overflow-hidden rounded-2xl bg-black/35">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2">
        <span className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
          {language || "code"}
        </span>
        <button
          type="button"
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-6 text-emerald-50">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function MessageMarkdown({ content }) {
  return (
    <div className="message-markdown text-sm leading-6 text-white/88">
      <ReactMarkdown
        rehypePlugins={[
          [rehypeHighlight, { detect: false, ignoreMissing: true }],
        ]}
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-200 underline decoration-emerald-300/40 underline-offset-4 transition hover:text-emerald-100"
              {...props}
            >
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse" {...props}>
                {children}
              </table>
            </div>
          ),
        }}
      >
        {String(content || "")}
      </ReactMarkdown>
    </div>
  );
}
