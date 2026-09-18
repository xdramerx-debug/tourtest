import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Field, Input } from '@csl/design-system';
import type { CourseSpec, HoleSpec, TeeSetKey } from '@csl/core';
import { useTourney } from '../../store-context';

/**
 * Дизайнер поля (F6, ADAPTIVE §13): длины по tee set'ам + CR/slope, сохранение —
 * и новый раунд играется на обновлённых данных (демо: localStorage-override для DemoTransport).
 * Экспорт — JSON (GNOME/KML — стаб на уровне формата, см. ADR-очередь F6).
 */
export function AdminCourses() {
  const { t } = useTranslation();
  const tournament = useTourney((s) => s.tournament);
  const [tee, setTee] = useState<TeeSetKey>('mens');
  const [draft, setDraft] = useState<CourseSpec | null>(null);
  const [saved, setSaved] = useState(false);

  if (!tournament) return <Card><div className="ds-skeleton" style={{ height: 160 }} /></Card>;
  const base = tournament.course;
  const course = draft ?? base;
  const changed = draft != null;

  const patchHole = (i: number, patch: Partial<HoleSpec>) => {
    const next: CourseSpec = { ...course, holes: course.holes.map((h, j) => (j === i ? { ...h, ...patch } : h)) };
    setDraft(next);
    setSaved(false);
  };
  const patchTee = (key: TeeSetKey, patch: Partial<CourseSpec['teeSets'][number]>) => {
    setDraft({ ...course, teeSets: course.teeSets.map((x) => (x.key === key ? { ...x, ...patch } : x)) });
    setSaved(false);
  };

  const save = () => {
    try { localStorage.setItem('csl.course.override', JSON.stringify(course)); } catch { /* quota */ }
    setSaved(true);
  };
  const reset = () => {
    try { localStorage.removeItem('csl.course.override'); } catch { /* ignore */ }
    setDraft(null);
    setSaved(false);
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(course, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${course.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const dist = course.holes.reduce((s, h) => s + (h.lengths[tee] ?? 0), 0);
  const teeMeta = course.teeSets.find((x) => x.key === tee);

  return (
    <div className="ds-sc">
      <Card>
        <div className="ds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>{t('courses.title')}: {course.name}</h2>
          {changed ? <Badge tone="accent">{t('courses.changed')}</Badge> : saved ? <Badge tone="good">{t('courses.saved')}</Badge> : null}
        </div>
        <div className="ds-row" role="tablist" style={{ flexWrap: 'wrap' }}>
          {course.teeSets.map((x) => (
            <button key={x.key} className={`ds-chip ${tee === x.key ? 'is-active' : ''}`} onClick={() => setTee(x.key)}>{x.label}</button>
          ))}
        </div>
        {teeMeta ? (
          <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginTop: 8 }}>
            <Field label="CR"><Input type="number" step="0.1" value={teeMeta.cr} onChange={(e) => patchTee(tee, { cr: Number(e.target.value) })} /></Field>
            <Field label="Slope"><Input type="number" value={teeMeta.slope} onChange={(e) => patchTee(tee, { slope: Number(e.target.value) })} /></Field>
            <Field label={t('courses.dist')}><Input readOnly value={dist} className="num" /></Field>
          </div>
        ) : null}
      </Card>

      <Card>
        <strong>{t('courses.holes')}</strong>
        <div className="ds-mini" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(72px,1fr))', marginTop: 8 }}>
          {course.holes.map((h, i) => (
            <div key={h.n} className="ds-mini__cell">
              <div className="ds-mini__hole num">{h.n}</div>
              <Input aria-label={`par ${h.n}`} type="number" min={3} max={5} value={h.par}
                onChange={(e) => patchHole(i, { par: Math.min(5, Math.max(3, Number(e.target.value))) as HoleSpec['par'] })} />
              <Input aria-label={`si ${h.n}`} type="number" min={1} max={18} value={h.si}
                onChange={(e) => patchHole(i, { si: Number(e.target.value) })} />
              <Input aria-label={`${t('courses.len')} ${h.n}`} type="number" min={60} max={650} value={h.lengths[tee] ?? 0}
                onChange={(e) => patchHole(i, { lengths: { ...h.lengths, [tee]: Number(e.target.value) } })} />
            </div>
          ))}
        </div>
        <div className="ds-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <Button variant="primary" disabled={!changed} onClick={save}>{t('courses.save')}</Button>
          <Button variant="ghost" onClick={reset}>{t('courses.reset')}</Button>
          <Button variant="ghost" onClick={exportJson}>{t('courses.export')}</Button>
        </div>
        <p className="ds-muted">{t('courses.loop')}</p>
      </Card>
    </div>
  );
}
