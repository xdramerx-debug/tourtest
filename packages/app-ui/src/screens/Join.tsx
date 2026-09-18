import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { joinFormSchema } from '@csl/core';
import { Badge, Button, Card, Field, Input, Switch } from '@csl/design-system';
import { useApp } from '../root';
import { demoTournamentList, type DemoTournamentInfo } from '../config';
import { extraTournaments } from './admin/wizard-store';

/**
 * «Присоединиться» (F0/F1, USER_FLOWS F1): код → имя → роль → согласия → лобби.
 * Демо: код определяет турнир по префиксу/пользовательскому реестру.
 */
export function JoinScreen() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { config } = useApp();
  const { code: codeParam } = useParams();
  const [sp] = useSearchParams();
  const asMarker = sp.get('as') === 'marker';
  // F1.1: QR несёт код в параметре — поле предзаполнено
  const [code, setCode] = useState(codeParam ?? sp.get('code') ?? '');
  const [name, setName] = useState('');
  const [terms, setTerms] = useState(false);
  const [photos, setPhotos] = useState(false); // F1.1: подтверждение фото — опционально
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => [...demoTournamentList(config.variant), ...extraTournaments()], [config.variant]);

  const resolve = (raw: string): DemoTournamentInfo | null => {
    const c = raw.trim().toUpperCase();
    if (!c) return null;
    const custom = JSON.parse(localStorage.getItem('csl.customTournaments') ?? '[]') as { info: DemoTournamentInfo; tournament: { joinCode: string } }[];
    const hit = custom.find((r) => r.tournament.joinCode.toUpperCase() === c);
    if (hit) return hit.info;
    if (c.startsWith('SCRAM')) return list.find((x) => x.id === 't-corp') ?? null;
    if (c.startsWith('SKINS')) return list.find((x) => x.id === 't-evening') ?? null;
    if (c.startsWith('HISTO')) return list.find((x) => x.id === 't-hist') ?? null;
    if (c.startsWith('DUBRO') || c.startsWith('OPEN') || c.startsWith('CHAMP')) return list.find((x) => x.id === 't-open' || x.id === 't-champ') ?? list[0] ?? null;
    return null;
  };

  const info = resolve(code);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) { setError(t('join.codeError')); return; }
    // правило «имя как награда»: ≤40 символов, без эмодзи — zod (core/schemas)
    const parsed = joinFormSchema.safeParse({
      name, code: info.id.slice(0, 6).padEnd(6, '0'), consentTerms: terms, consentPhotos: photos, role: asMarker ? 'marker' : 'player',
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue?.path[0] === 'name' ? t('join.nameError')
        : issue?.path[0] === 'consentTerms' ? t('join.consentError') : t('join.error'));
      return;
    }
    try {
      localStorage.setItem(`csl.pendingName.${info.id}`, name.trim());
      localStorage.setItem(`csl.pendingRole.${info.id}`, asMarker ? 'marker' : 'player');
    } catch { /* quota */ }
    nav(`/t/${info.id}`);
  };

  return (
    <div className="ds-sc" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 className="ds-h1">{t('join.title')}</h1>
      <p className="ds-sub">{t('join.sub')}</p>
      <Card>
      <form onSubmit={submit}>
        <Field label={t('join.code')} hint={t('join.codeHint')}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="DUBRO26" autoComplete="off" inputMode="text" aria-invalid={!!error && !info} />
        </Field>
        {info ? <p role="status"><Badge tone="good">{info.name.ru} · {t(`format.${info.format}`)}</Badge></p> : code ? <p className="ds-muted">{t('join.codeCheck')}</p> : null}
        <Field label={t('join.name')} hint={t('join.nameHint')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" />
        </Field>
        <div style={{ margin: '12px 0' }}>
          <Switch checked={terms} onChange={setTerms} label={t('join.consentTerms')} />
        </div>
        <div style={{ margin: '12px 0' }}>
          <Switch checked={photos} onChange={setPhotos} label={t('join.consentPhotos')} />
        </div>
        {error ? <p role="alert"><Badge tone="danger">{error}</Badge></p> : null}
        <Button variant="accent" size="xl" type="submit" disabled={!info || !terms || name.trim().length < 2}>
          {asMarker ? t('join.asMarker') : t('join.submit')}
        </Button>
        <p className="ds-muted" style={{ marginTop: 10 }}>
          <Link to={asMarker ? '/join' : '/join?as=marker'}>{asMarker ? t('join.imPlayer') : t('join.imMarker')}</Link>
        </p>
      </form>
      </Card>
    </div>
  );
}
