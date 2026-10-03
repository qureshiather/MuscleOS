/**
 * Home (Workouts tab) rows of the gate map and the downgrade rendering
 * (docs/features/subscriptions.md#gate-map, #downgrade-behaviour-pro--basic).
 */
import { Alert } from 'react-native';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import HomeScreen from '../../../../app/(tabs)/index';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';
import {
  setHiddenBuiltInTemplateIds,
  setTemplateFolders,
  setTemplates,
} from '@/storage/localStorage';
import { renderApp, setPro } from '../render';
import { CUSTOM_TEMPLATE, resetGateState, stubs } from './helpers';

const LAPSED = 'Your templates are saved. Resubscribe to Pro to run them.';
const customCardLabel = `${CUSTOM_TEMPLATE.name}, ${CUSTOM_TEMPLATE.exerciseIds.length} exercises`;

function render() {
  return renderApp(
    {
      index: HomeScreen,
      subscription: stubs.subscription,
      'create-template': stubs['create-template'],
      'workout-preview': stubs['workout-preview'],
      'active-workout': stubs['active-workout'],
    },
    '/'
  );
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function expectPaywall(r: ReturnType<typeof render>, feature: string) {
  expect(await screen.findByText('route:subscription')).toBeTruthy();
  expect(r.getPathname()).toBe('/subscription');
  expect(r.getSearchParams()).toEqual({ feature });
}

/** The options button sits inside the card; the innermost match is the options button itself. */
function lastOf<T>(items: T[]): T {
  const item = items[items.length - 1];
  if (item === undefined) throw new Error("no match");
  return item;
}

let alertSpy: jest.SpyInstance;

beforeEach(async () => {
  await resetGateState();
  await setTemplates([CUSTOM_TEMPLATE]);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => alertSpy.mockRestore());

describe('Empty workout hero', () => {
  test('Basic: says Included with Pro and opens the empty_workout paywall', async () => {
    const r = render();
    expect(await screen.findByText('Included with Pro')).toBeTruthy();
    fireEvent.press(screen.getByText('Empty workout'));
    await expectPaywall(r, 'empty_workout');
  });

  test('Pro: starts an empty workout', async () => {
    setPro(true);
    const r = render();
    expect(await screen.findByText('Add exercises as you go')).toBeTruthy();
    fireEvent.press(screen.getByText('Empty workout'));
    expect(await screen.findByText('route:active-workout')).toBeTruthy();
    expect(r.getSearchParams()).toMatchObject({ templateId: '_empty' });
  });
});

describe('New template / New folder buttons', () => {
  test('Basic: both are shown and open the custom_templates paywall', async () => {
    const r = render();
    fireEvent.press(await screen.findByRole('button', { name: 'New template' }));
    await expectPaywall(r, 'custom_templates');
  });

  test('Basic: New folder opens the custom_templates paywall', async () => {
    const r = render();
    fireEvent.press(await screen.findByRole('button', { name: 'New folder' }));
    await expectPaywall(r, 'custom_templates');
  });

  test('Pro: New template opens the builder', async () => {
    setPro(true);
    const r = render();
    fireEvent.press(await screen.findByRole('button', { name: 'New template' }));
    expect(await screen.findByText('route:create-template')).toBeTruthy();
    expect(r.getPathname()).toBe('/create-template');
  });

  test('Pro: New folder opens the folder modal (no paywall)', async () => {
    setPro(true);
    const r = render();
    fireEvent.press(await screen.findByRole('button', { name: 'New folder' }));
    await settle();
    expect(r.getPathname()).toBe('/');
  });
});

describe('custom templates after a lapse', () => {
  test('Basic: the card is locked (lock + "requires Pro") and tapping opens the paywall', async () => {
    const r = render();
    const card = await screen.findByRole('button', { name: `${customCardLabel}, requires Pro` });
    fireEvent.press(card);
    await expectPaywall(r, 'custom_templates');
  });

  test('Pro: the card is unlocked and opens the preview', async () => {
    setPro(true);
    const r = render();
    fireEvent.press((await screen.findAllByRole('button', { name: customCardLabel }))[0]);
    expect(await screen.findByText('route:workout-preview')).toBeTruthy();
    expect(r.getSearchParams()).toMatchObject({ templateId: CUSTOM_TEMPLATE.id });
  });

  test('Basic: the lapsed banner explains the lock and opens the paywall', async () => {
    const r = render();
    fireEvent.press(await screen.findByText(LAPSED));
    await expectPaywall(r, 'custom_templates');
  });

  test('Pro: no lapsed banner', async () => {
    setPro(true);
    render();
    (await screen.findAllByRole('button', { name: customCardLabel }))[0];
    expect(screen.queryByText(LAPSED)).toBeNull();
  });

  test('Basic: a built-in template still starts (no lock, opens the preview)', async () => {
    const r = render();
    fireEvent.press(await screen.findByRole('button', { name: 'Built-in' }));
    fireEvent.press((await screen.findAllByRole('button', { name: /^Push, 6 exercises$/ }))[0]);
    expect(await screen.findByText('route:workout-preview')).toBeTruthy();
    expect(r.getSearchParams()).toMatchObject({ templateId: 'ppl-push' });
  });
});

describe('template menu (custom template)', () => {
  test.each(['Rename', 'Move', 'Edit'])('Basic: %s opens the custom_templates paywall', async (item) => {
    const r = render();
    fireEvent.press(lastOf(await screen.findAllByRole('button', { name: `Options for ${CUSTOM_TEMPLATE.name}` })));
    fireEvent.press(await screen.findByText(item));
    await expectPaywall(r, 'custom_templates');
  });

  test.each(['Hide', 'Delete'])('Basic: %s is ungated', async (item) => {
    const r = render();
    fireEvent.press(lastOf(await screen.findAllByRole('button', { name: `Options for ${CUSTOM_TEMPLATE.name}` })));
    fireEvent.press(await screen.findByText(item));
    await settle();
    expect(r.getPathname()).toBe('/');
  });

  test('Pro: Edit opens the builder for that template', async () => {
    setPro(true);
    const r = render();
    fireEvent.press(lastOf(await screen.findAllByRole('button', { name: `Options for ${CUSTOM_TEMPLATE.name}` })));
    fireEvent.press(await screen.findByText('Edit'));
    expect(await screen.findByText('route:create-template')).toBeTruthy();
    expect(r.getSearchParams()).toEqual({ templateId: CUSTOM_TEMPLATE.id });
  });
});

describe('folders on Basic', () => {
  test('managing an existing folder (rename) is ungated', async () => {
    await setTemplateFolders([{ id: 'folder_1', name: 'Mine' }]);
    await setTemplates([{ ...CUSTOM_TEMPLATE, folderId: 'folder_1' }]);
    const r = render();
    fireEvent.press(await screen.findByRole('button', { name: 'Options for Mine' }));
    fireEvent.press(await screen.findByText('Rename'));
    expect(await screen.findByText('Rename folder')).toBeTruthy();
    expect(r.getPathname()).toBe('/');
  });
});

describe('Suggested excludes Pro-only templates on Basic', () => {
  beforeEach(async () => {
    await setHiddenBuiltInTemplateIds(BUILT_IN_TEMPLATES.map((t) => t.id));
  });

  test('Pro: the custom template can be suggested', async () => {
    setPro(true);
    render();
    expect(await screen.findByText('Suggested')).toBeTruthy();
  });

  test('Basic: nothing startable is left, so no Suggested section', async () => {
    render();
    await screen.findByText(LAPSED);
    expect(screen.queryByText('Suggested')).toBeNull();
  });
});
