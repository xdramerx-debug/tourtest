import React, { useState } from 'react';

export interface NumberPadLabels {
  pickup: string; penalty: string; more: string; back: string; clear: string;
  quickMin1: string; quickPar: string; quickPlus1: string;
}

export interface NumberPadProps {
  par: number;
  value?: number;
  pickup?: boolean;
  penalties?: number;
  onScore: (strokes: number) => void;
  onPickup: () => void;
  onPenalty: (n: number) => void;
  onClear: () => void;
  quickChips?: boolean;
  labels: NumberPadLabels;
}

/**
 * ScorePad — критический примитив ввода (UX: ≤5 с, одна рука, перчатки).
 * Один тап = счёт (без подтверждения), быстрые чипы Par−1/Par/Par+1,
 * страница «10–15», pickup (X), штраф-степпер, очистка.
 */
export function NumberPad({ par, value, pickup, penalties = 0, onScore, onPickup, onPenalty, onClear, quickChips, labels }: NumberPadProps) {
  const [more, setMore] = useState(false);
  const digits = more ? [10, 11, 12, 13, 14, 15] : [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className={`ds-pad ${quickChips ? 'has-chips' : ''}`}>
      {quickChips ? (
        <div className="ds-pad__chips" role="group" aria-label="quick">
          <button type="button" className="ds-pad__chip" onClick={() => onScore(Math.max(1, par - 1))}>
            {par - 1 <= 0 ? par : par - 1}
            <small>{labels.quickMin1}</small>
          </button>
          <button type="button" className="ds-pad__chip is-par" onClick={() => onScore(par)}>
            {par}
            <small>{labels.quickPar}</small>
          </button>
          <button type="button" className="ds-pad__chip" onClick={() => onScore(par + 1)}>
            {par + 1}
            <small>{labels.quickPlus1}</small>
          </button>
        </div>
      ) : null}

      <div className="ds-pad__grid" role="group" aria-label="score digits">
        {digits.map((d) => (
          <button
            type="button"
            key={d}
            className={`ds-pad__key ${value === d && !pickup ? 'is-active' : ''}`}
            onClick={() => onScore(d)}
          >
            <span className="num">{d}</span>
            {!more && d === par ? <span className="ds-pad__parhint" aria-hidden="true">·</span> : null}
          </button>
        ))}
        <button type="button" className={`ds-pad__key ds-pad__key--alt ${pickup ? 'is-active' : ''}`} onClick={onPickup} aria-label={labels.pickup}>
          X
        </button>
        <button type="button" className="ds-pad__key ds-pad__key--alt" onClick={() => setMore((m) => !m)} aria-label={more ? labels.back : labels.more}>
          {more ? '‹ 1–9' : '10+'}
        </button>
      </div>

      <div className="ds-pad__row">
        <div className="ds-pad__pen" role="group" aria-label={labels.penalty}>
          <button type="button" className="ds-pad__penbtn" onClick={() => onPenalty(Math.max(0, penalties - 1))} aria-label="-1">−</button>
          <span className="ds-pad__penval num" aria-live="polite">+{penalties}</span>
          <button type="button" className="ds-pad__penbtn" onClick={() => onPenalty(penalties + 1)} aria-label="+1">+</button>
          <span className="ds-pad__penlabel">{labels.penalty}</span>
        </div>
        <button type="button" className="ds-pad__clear" onClick={onClear}>{labels.clear}</button>
      </div>
    </div>
  );
}
