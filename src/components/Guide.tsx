import { useState } from 'react';
import { guideCards } from '../services/guide';

function CopyButton(props: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = props.text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* clipboard unavailable: selection remains for manual copy */
      }
      document.body.removeChild(ta);
    }
    setDone(true);
    setTimeout(() => setDone(false), 1200);
  };
  return (
    <button onClick={copy} aria-label={'copy command: ' + props.text} type="button">
      {done ? 'copied' : 'copy'}
    </button>
  );
}

export function Guide(props: {
  meshOnline: boolean;
  dashboardOnline: boolean;
  meshNodes: number;
  openFindings: number;
  sessions: number | null;
}) {
  const cards = guideCards(props);
  if (cards.length === 0) {
    return <p className="muted">All guided checks green — nothing to do.</p>;
  }
  return (
    <div>
      <h2>Guided fixes ({cards.length})</h2>
      {cards.map((c) => (
        <section className="card" key={c.id} aria-label={c.title}>
          <h3>
            {c.title} <span className="muted">— {c.when}</span>
          </h3>
          <ol className="muted">
            {c.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {c.commands.map((cmd) => (
            <div className="cmd" key={cmd}>
              <code>{cmd}</code>
              <CopyButton text={cmd} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
