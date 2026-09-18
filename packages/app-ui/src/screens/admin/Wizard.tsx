import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Field, Input, Select } from '@csl/design-system';
import type { FormatId } from '@csl/core';
import { useApp } from '../../root';
import { saveCustomTournament } from './wizard-store';

const FORMAT_ALLOWANCE: Partial<Record<FormatId, number>> = {
  scramble: 0.25, fourball: 0.9, foursome: 0.5, stableford: 0.95, skins: 0.9,
};

/**
 * Мастер «Турнир» (B+, F3): одна карточная форма. Mass-entry игроков предпросмотром,
 * лимит 40 (UX-009), undo → commit. Демо: запись в localStorage (USER_FLOWS F3/F6).
 */
export function WizardScreen() {
  const { t } = useTranslation();
  const { features } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<FormatId>(features.formats[0] ?? 'stroke');
  const [allowance, setAllowance] = useState('1.0');
  const [flights, setFlights] = useState('2');
  const [bulk, setBulk] = useState('');
  const [players, setPlayers] = useState<{ name: string; hi: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const applyBulk = () => {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (players.length + lines.length > 40) { setError(t('admin.bulkLimit')); return; }
    const parsed = lines.map((l, i) => {
      const [nm, hi] = l.split('|').map((x) => (x ?? '').trim());
      return { name: nm || `${t('board.player')} ${players.length + i + 1}`, hi: Number(hi) || 18 };
    });
    setPlayers([...players, ...parsed]);
    setBulk('');
    setError(null);
  };

  const valid = name.trim().length >= 3 && players.length >= 2;
  const save = () => {
    if (!valid) { setError(t('admin.minPlayers')); return; }
    const rec = saveCustomTournament({
      name: name.trim(),
      format,
      allowance: Number(allowance) || 1,
      flights: Number(flights) || 0,
      players,
      status: 'live',
    });
    nav(`/t/${rec.info.id}`);
  };

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{t('admin.newTournament')}</h2>
      <Field label={t('admin.name')}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Кубок дружбы — 2026" /></Field>
      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Field label={t('admin.format')}>
          <Select value={format} onChange={(e) => {
            const f = e.target.value as FormatId;
            setFormat(f);
            setAllowance(String(FORMAT_ALLOWANCE[f] ?? 1));
          }}>
            {features.formats.map((f) => <option key={f} value={f}>{t(`format.${f}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('admin.allowance')} hint="0.05–1.0 (RULES §4.2)">
          <Input type="number" step="0.05" min={0.05} max={1} value={allowance} onChange={(e) => setAllowance(e.target.value)} />
        </Field>
        <Field label={t('admin.flights')} hint="0 — без флайтов">
          <Input type="number" min={0} max={6} value={flights} onChange={(e) => setFlights(e.target.value)} />
        </Field>
      </div>

      <h3>{t('admin.addPlayers')}</h3>
      <Field label={t('admin.bulkLabel')} hint="Имя | HI — по строке">
        <textarea className="ds-field" rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Иван Иванов | 12.4\nПётр Петров | 8'} />
      </Field>
      <div className="ds-row">
        <Button variant="primary" onClick={applyBulk}>{t('admin.parsePreview')}</Button>
        {players.length ? <Button variant="ghost" onClick={() => setPlayers([])}>↶ undo</Button> : null}
      </div>
      {error ? <p role="alert"><Badge tone="danger">{error}</Badge></p> : null}
      <p className="ds-muted" style={{ margin: '8px 0' }}>{t('admin.players')}: <b className="num">{players.length}</b></p>
      <div className="ds-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {players.map((p, i) => (
          <span key={i} className="ds-chip">
            {p.name} · <span className="num">{p.hi.toFixed(1)}</span>
            <button className="ds-chip__x" aria-label={`${t('admin.delete')} ${p.name}`} onClick={() => setPlayers(players.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <Button variant="accent" size="xl" disabled={!valid} onClick={save}>{t('admin.save')}</Button>
        {!valid ? <span style={{ marginLeft: 8 }}><Badge tone="muted">{t('admin.minPlayers')}</Badge></span> : null}
      </div>
    </Card>
  );
}
