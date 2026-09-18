import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@csl/design-system';
import { useTourney } from '../../store-context';

/** Дашборд админа: KPI поля, быстрые действия (IA §10.1). */
export function AdminDashboard() {
  const { t } = useTranslation();
  const tournament = useTourney((s) => s.tournament);
  const audit = useTourney((s) => s.audit);
  const queued = useTourney((s) => s.queued);
  const status = useTourney((s) => s.status);
  const perMin = audit.filter((a) => Date.now() - a.serverTs < 60000).length;

  return (
    <div className="ds-sc">
      <div className="ds-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        <Card><div className="ds-kpi"><span className="ds-kpi__v num">{tournament?.entries.length ?? '—'}</span><span className="ds-kpi__l">{t('lobby.players')}</span></div></Card>
        <Card><div className="ds-kpi"><span className="ds-kpi__v num">{perMin}</span><span className="ds-kpi__l">actions/min</span></div></Card>
        <Card><div className="ds-kpi"><span className="ds-kpi__v num">{queued}</span><span className="ds-kpi__l">{t('sync.queued', { n: '' })}</span></div></Card>
        <Card><div className="ds-kpi"><span className="ds-kpi__v num">{status}</span><span className="ds-kpi__l">sync</span></div></Card>
      </div>
      <div className="ds-row" style={{ flexWrap: 'wrap' }}>
        <Link to="/admin/tournaments/new"><Button variant="primary" size="lg">{t('admin.newTournament')}</Button></Link>
        <Link to="/admin/scores"><Button variant="ghost" size="lg">{t('admin.scores')}</Button></Link>
        <Link to="/admin/courses"><Button variant="ghost" size="lg">{t('admin.courses')}</Button></Link>
        <Link to="/admin/audit"><Button variant="ghost" size="lg">{t('admin.audit')}</Button></Link>
      </div>
    </div>
  );
}
