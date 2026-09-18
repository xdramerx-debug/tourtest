import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card } from '@csl/design-system';
import { useApp } from '../root';
import { demoTournamentList, type DemoTournamentInfo } from '../config';
import { extraTournaments } from './admin/wizard-store';

/**
 * Главная (IA §3): hero → «присоединиться» (F0/F1), живой лидерборд —
 * следующая остановка гостя; список турниров клуба.
 */
export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { config, features } = useApp();
  const list = [...demoTournamentList(config.variant), ...extraTournaments()];
  const live = list.filter((x) => x.status === 'live');
  const lang = (i18n.language.startsWith('en') ? 'en' : 'ru') as 'ru' | 'en';
  const nm = (x: DemoTournamentInfo) => x.name[lang] ?? x.name.ru;

  return (
    <div className="ds-sc">
      <section className="ds-hero">
        <div className="ds-hero__club"><span className="ds-ico" data-ico="club" /> ГК «Дубровка» · Moskva-region</div>
        <h1 className="ds-h1">{t('app.title')}</h1>
        <p className="ds-sub">{t('app.tagline')}</p>
        <div className="ds-row" role="group" aria-label="quick actions">
          <Link to="/join"><Button variant="accent" size="xl">{t('home.joinCta')}</Button></Link>
          {live[0] ? <Link to={`/t/${live[0].id}/board`}><Button variant="primary" size="xl">{t('home.liveCta')}</Button></Link> : null}
        </div>
      </section>

      {live.length ? (
        <section aria-labelledby="h-live">
          <h2 id="h-live"><Badge live tone="good">LIVE</Badge> {t('home.nowPlaying')}</h2>
          {live.map((x) => (
            <Card key={x.id} interactive style={{ margin: '10px 0' }}>
              <div className="ds-lbrow" style={{ minHeight: 56 }}>
                <div style={{ flex: 1 }}>
                  <Link className="ds-linkname" to={`/t/${x.id}/board`}>{nm(x)}</Link>
                  <div className="ds-muted">{t(`format.${x.format}`)} · {x.players} {t('lobby.players').toLowerCase()} · R{x.rounds}</div>
                </div>
                <Badge tone="good" live>{t('lobby.live')}</Badge>
                <Link to={`/t/${x.id}`} aria-label={t('nav.tournament')}><span className="ds-ico" data-ico="chevron" /></Link>
              </div>
            </Card>
          ))}
          {features.tvMode ? <p className="ds-muted"><Link to={`/t/${live[0].id}/board?tv=1`}>{t('board.tv')}</Link> · <Link to={`/t/${live[0].id}/board`}>{t('nav.leaderboard')}</Link></p> : null}
        </section>
      ) : null}

      <section aria-labelledby="h-next">
        <h2 id="h-next">{t('home.upcoming')}</h2>
        {list.filter((x) => x.status !== 'live').map((x) => (
          <Card key={x.id} style={{ margin: '10px 0' }}>
            <div className="ds-lbrow" style={{ minHeight: 56 }}>
              <div style={{ flex: 1 }}>
                <Link className="ds-linkname" to={`/t/${x.id}`}>{nm(x)}</Link>
                <div className="ds-muted">{t(`format.${x.format}`)} · {x.players} {t('lobby.players').toLowerCase()}</div>
              </div>
              <Badge tone="muted">{t(`status.${x.status}`)}</Badge>
            </div>
          </Card>
        ))}
      </section>

      <section className="ds-grid" aria-label="features" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {[['k1', '≤ 5 s'], ['k2', '≤ 2 s'], ['k3', '144']].map(([k, v]) => (
          <Card key={k}><div className="ds-kpi"><span className="ds-kpi__v num">{v}</span><span className="ds-kpi__l">{t(`home.${k}`)}</span></div></Card>
        ))}
      </section>
    </div>
  );
}
