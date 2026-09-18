import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field, Input, Select } from '@csl/design-system';
import { Crumbs } from '../../layouts';
import { useTourney, useTourneyStore } from '../../store-context';

/**
 * Админ-зона (IA §10, USER_FLOWS F3): guard — роль referee/admin (демо-вход без пароля;
 * в проде — серверная сессия, NFR §6). Базовые действия доступны с телефона.
 */
export function AdminLayout() {
  const { t } = useTranslation();
  const session = useTourney((s) => s.session);
  const isStaff = session && (session.role === 'referee' || session.role === 'admin');

  if (!isStaff) return <AdminLogin />;
  return (
    <div className="ds-sc">
      <Crumbs items={[{ to: '/', label: t('nav.home') }, { label: t('admin.title') }]} />
      <div className="ds-row" role="tablist" aria-label="admin" style={{ flexWrap: 'wrap' }}>
        <Tab to="/admin" end>{t('admin.home')}</Tab>
        <Tab to="/admin/tournaments">{t('admin.tournaments')}</Tab>
        <Tab to="/admin/scores">{t('admin.scores')}</Tab>
        <Tab to="/admin/courses">{t('admin.courses')}</Tab>
        <Tab to="/admin/players">{t('admin.players')}</Tab>
        <Tab to="/admin/club">{t('admin.club')}</Tab>
        <Tab to="/admin/audit">{t('admin.audit')}</Tab>
      </div>
      <Outlet />
    </div>
  );
}

function Tab({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) {
  return <NavLink to={to} end={end} className={({ isActive }) => `ds-chip ${isActive ? 'is-active' : ''}`}>{children}</NavLink>;
}

function AdminLogin() {
  const { t } = useTranslation();
  const st = useTourneyStore();
  const [role, setRole] = useState<'referee' | 'admin'>('admin');
  const [name, setName] = useState('Комитет');
  return (
    <div className="ds-sc" style={{ maxWidth: 420, margin: '0 auto' }}>
      <Crumbs items={[{ to: '/', label: t('nav.home') }, { label: t('admin.title') }]} />
      <h1 className="ds-h1">{t('admin.title')}</h1>
      <Card>
        <Field label={t('join.name')}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('join.role')} hint={t('admin.loginHint')}>
          <Select value={role} onChange={(e) => setRole(e.target.value as 'referee' | 'admin')}>
            <option value="admin">{t('role.admin')}</option>
            <option value="referee">{t('role.referee')}</option>
          </Select>
        </Field>
        <Button variant="primary" size="lg" onClick={() => st.loginAs(role, name)}>{t('join.submit')}</Button>
      </Card>
    </div>
  );
}
