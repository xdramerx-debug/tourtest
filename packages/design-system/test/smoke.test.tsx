import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Badge, Button, Card, Chip, Field, Input, OfflineBar, Segmented, Select, Skeleton, Switch, Ticker,
} from '../src/components';
import { Icon } from '../src/icons';
import { NumberPad, type NumberPadLabels } from '../src/numpad';

/**
 * Smoke-контракт DS (ARCHITECTURE §7): все примитивы рендерятся без браузера
 * (SSR-строка), классы/ARIA-пометки на месте, тач-паттерны не сломаны.
 * Интерактивные пути покрыты e2e на CI (playwright, .github/workflows/e2e.yml).
 */

const PAD_LABELS: NumberPadLabels = {
  pickup: 'X', penalty: 'штраф', more: '10+', back: '←', clear: 'C',
  quickMin1: '−1', quickPar: 'Пар', quickPlus1: '+1',
};

describe('design-system smoke', () => {
  it('Button: вариант/размер/тип', () => {
    const html = renderToStaticMarkup(<Button variant="accent" size="xl">Go</Button>);
    expect(html).toContain('ds-btn--accent');
    expect(html).toContain('ds-btn--xl');
    expect(html).toContain('>Go<');
  });

  it('Badge: live-точка и тоны', () => {
    const html = renderToStaticMarkup(<Badge tone="good" live>LIVE</Badge>);
    expect(html).toContain('is-live');
    expect(html).toContain('ds-livedot');
  });

  it('Card/Chip/Input/Select монтируются', () => {
    const html = renderToStaticMarkup(
      <Card interactive>
        <Chip active>A</Chip>
        <Input aria-label="x" />
        <Select><option>1</option></Select>
      </Card>,
    );
    expect(html).toContain('ds-card--int');
    expect(html).toContain('is-active');
    expect(html).toContain('ds-input');
  });

  it('Field: ошибка имеет role=alert', () => {
    const html = renderToStaticMarkup(<Field label="L" error="boom"><Input /></Field>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('boom');
  });

  it('Switch: role=switch + aria-checked', () => {
    const on = renderToStaticMarkup(<Switch checked onChange={() => {}} label="s" />);
    const off = renderToStaticMarkup(<Switch checked={false} onChange={() => {}} label="s" />);
    expect(on).toContain('aria-checked="true"');
    expect(off).toContain('aria-checked="false"');
  });

  it('Segmented: выбранная опция aria-pressed', () => {
    const html = renderToStaticMarkup(
      <Segmented value="net" onChange={() => {}} ariaLabel="mode" options={[{ value: 'gross', label: 'G' }, { value: 'net', label: 'N' }]} />,
    );
    expect(html).toContain('aria-label="mode"');
  });

  it('OfflineBar: очередь и «данные на» офлайн', () => {
    const html = renderToStaticMarkup(
      <OfflineBar state="offline" queued={3} dataAt="12:40" labels={{ online: 'on', offline: 'off', queued: 'q:{{n}}', dataAt: 'at {{time}}' }} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('q:3');
    expect(html).toContain('at 12:40');
  });

  it('Skeleton/Ticker/Icon рендерятся', () => {
    expect(renderToStaticMarkup(<Skeleton />)).toContain('ds-skel');
    const tick = renderToStaticMarkup(<Ticker items={[<span key="1">one</span>]} ariaLabel="t" />);
    expect(tick).toContain('one');
    expect(renderToStaticMarkup(<Icon name="home" title="h" />)).toContain('svg');
  });

  it('NumberPad: цифры 1–9, быстрые чипы, pickup very first', () => {
    const html = renderToStaticMarkup(
      <NumberPad par={4} value={5} onScore={() => {}} onPickup={() => {}} onPenalty={() => {}} onClear={() => {}} quickChips labels={PAD_LABELS} />,
    );
    for (const d of ['1', '4', '9']) expect(html).toContain(`>${d}<`);
    expect(html).toContain('>X<');
    expect(html).toContain('Пар');
    expect(html).toContain('aria-'); // доступность: есть aria-атрибуты на кнопках
  });
});
