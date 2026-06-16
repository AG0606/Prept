'use client';

/**
 * DiffFeedbackTable — Actionable feedback table with timestamped critiques
 * and diff-style code suggestions. From the telemetry design asset.
 */

interface FeedbackItem {
  timestamp: string;
  title: string;
  description: string;
  diff?: { removed: string[]; added: string[] };
  suggestion?: string;
}

interface DiffFeedbackTableProps {
  items?: FeedbackItem[];
  className?: string;
}

const DEFAULT_ITEMS: FeedbackItem[] = [
  {
    timestamp: '14:15:20',
    title: 'INEFFICIENT_INITIAL_APPROACH',
    description:
      'You initially proposed a nested loop O(N²) approach. While correct, it lacks the scalability required for FAANG standards.',
    diff: {
      removed: ['for (let i = 0; i < n; i++) {', '  for (let j = 0; j < n; j++) {'],
      added: ['const map = new Map();', 'for (let i = 0; i < n; i++) {'],
    },
  },
  {
    timestamp: '14:28:45',
    title: 'WEAK_VERBAL_CLARITY',
    description:
      'Stuttered while explaining the space complexity of the recursive call stack. Be more decisive in your technical assertions.',
    suggestion: '"The recursion depth is O(log N) because we halve the search space at each level."',
  },
];

export function DiffFeedbackTable({
  items = DEFAULT_ITEMS,
  className = '',
}: DiffFeedbackTableProps) {
  return (
    <div className={className}>
      {/* Section header */}
      <h3
        className="font-mono text-xs tracking-wider uppercase pb-3 mb-0"
        style={{
          color: 'var(--fg-subtle, rgba(0,0,0,0.4))',
          borderBottom: '1px solid var(--fg, #000)',
        }}
      >
        ACTIONABLE_FEEDBACK
      </h3>

      {/* Table */}
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              className="text-left font-mono text-[10px] tracking-wider uppercase p-4"
              style={{
                color: 'var(--fg-subtle)',
                borderBottom: '1px solid var(--fg, #000)',
                width: 100,
              }}
            >
              TIMESTAMP
            </th>
            <th
              className="text-left font-mono text-[10px] tracking-wider uppercase p-4"
              style={{
                color: 'var(--fg-subtle)',
                borderBottom: '1px solid var(--fg, #000)',
              }}
            >
              CRITIQUE
            </th>
            <th
              className="text-left font-mono text-[10px] tracking-wider uppercase p-4"
              style={{
                color: 'var(--fg-subtle)',
                borderBottom: '1px solid var(--fg, #000)',
              }}
            >
              SUGGESTED_REFACTOR
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              {/* Timestamp */}
              <td
                className="font-mono text-xs tracking-wider uppercase p-4 align-top"
                style={{
                  color: 'var(--fg-subtle)',
                  borderBottom: '1px solid var(--border, rgba(0,0,0,0.1))',
                }}
              >
                {item.timestamp}
              </td>

              {/* Critique */}
              <td
                className="p-4 align-top"
                style={{
                  borderBottom: '1px solid var(--border, rgba(0,0,0,0.1))',
                }}
              >
                <div className="font-bold text-sm mb-2">{item.title}</div>
                <p className="text-sm" style={{ opacity: 0.8 }}>
                  {item.description}
                </p>
              </td>

              {/* Suggested refactor */}
              <td
                className="p-4 align-top"
                style={{
                  borderBottom: '1px solid var(--border, rgba(0,0,0,0.1))',
                }}
              >
                {item.diff && (
                  <div
                    className="font-mono text-xs p-3"
                    style={{ background: 'var(--surface-warm, #F4F4F0)' }}
                  >
                    {item.diff.removed.map((line, i) => (
                      <div key={`r-${i}`} style={{ color: '#d73a49' }}>
                        - {line}
                      </div>
                    ))}
                    {item.diff.added.map((line, i) => (
                      <div key={`a-${i}`} style={{ color: '#22863a' }}>
                        + {line}
                      </div>
                    ))}
                  </div>
                )}
                {item.suggestion && (
                  <p className="text-xs italic" style={{ opacity: 0.8 }}>
                    {item.suggestion}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
