/**
 * The paywall screen (docs/features/subscriptions.md#paywall-ux).
 */
import { Alert } from 'react-native';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import SubscriptionScreen from '../../../../app/subscription';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { renderApp, routeStub, setPro } from '../render';
import { resetGateState } from './helpers';

const mockRc = {
  hasKey: true,
  packages: Promise.resolve({ monthly: null, annual: null }) as Promise<unknown>,
};

jest.mock('@/utils/revenueCat', () => ({
  hasRevenueCatApiKey: () => mockRc.hasKey,
  isRevenueCatConfigured: () => mockRc.hasKey,
  getOfferingPackages: () => mockRc.packages,
  openManageSubscriptions: jest.fn(async () => undefined),
  ensureRevenueCatConfigured: jest.fn(async () => mockRc.hasKey),
  getRevenueCatCustomerInfo: jest.fn(async () => null),
  hasProEntitlement: () => false,
  getProExpirationDate: () => undefined,
  getProPlan: () => null,
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  revenueCatLogIn: jest.fn(),
  revenueCatLogOut: jest.fn(),
}));

function pkg(priceString: string, price: number) {
  return { product: { priceString, price } };
}

function render(url = '/subscription') {
  return renderApp({ subscription: SubscriptionScreen, auth: routeStub('auth') }, url);
}

/** Flush the offerings promise and effects. */
async function settle() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

let alertSpy: jest.SpyInstance;

beforeEach(async () => {
  await resetGateState();
  mockRc.hasKey = true;
  mockRc.packages = Promise.resolve({ monthly: null, annual: null });
  // Keep the screen's mount-time load() from re-reading the tier; tests set it directly.
  useSubscriptionStore.setState({ load: async () => undefined });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => alertSpy.mockRestore());

describe('Basic (linked account)', () => {
  test('annual is pre-selected with Best value; fallback prices and 44% saving', async () => {
    render();
    await settle();
    expect(screen.getByText('Current plan')).toBeTruthy();
    expect(screen.getAllByText('Basic').length).toBeGreaterThan(0);
    expect(screen.getByText('Basic vs Pro')).toBeTruthy();
    expect(screen.getByText('Best value')).toBeTruthy();
    expect(screen.getByText('$2.99/mo')).toBeTruthy();
    expect(screen.getByText('$19.99/yr')).toBeTruthy();
    expect(screen.getByText('Save 44% vs monthly')).toBeTruthy();
    expect(screen.getByText('Continue with Annual')).toBeTruthy();
    expect(screen.getByText('Restore purchases')).toBeTruthy();
    fireEvent.press(screen.getByText('Monthly'));
    expect(screen.getByText('Continue with Monthly')).toBeTruthy();
  });

  test('store prices replace the fallback and drive the saving', async () => {
    mockRc.packages = Promise.resolve({ monthly: pkg('€5.00', 5), annual: pkg('€30.00', 30) });
    render();
    expect(await screen.findByText('€5.00/mo')).toBeTruthy();
    expect(screen.getByText('€30.00/yr')).toBeTruthy();
    expect(screen.getByText('Save 50% vs monthly')).toBeTruthy();
  });

  test('highlights the feature from ?feature=', async () => {
    render('/subscription?feature=personal_records');
    await settle();
    expect(screen.getByText('Personal records & 1RM tracking is included with Pro.')).toBeTruthy();
  });

  test('ignores an unknown ?feature=', async () => {
    render('/subscription?feature=grant_everything');
    await settle();
    expect(screen.queryByText(/is included with Pro\./)).toBeNull();
  });

  test('"Purchases unavailable" only when there is no API key', async () => {
    mockRc.hasKey = false;
    render();
    await settle();
    expect(screen.getByText('Purchases unavailable')).toBeTruthy();
  });

  test('while plans load the button keeps its copy but is disabled', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    mockRc.packages = new Promise((r) => {
      resolve = r;
    });
    render();
    await settle();
    const label = screen.getByText('Continue with Annual');
    expect(screen.queryByText('Purchases unavailable')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Annual' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await act(async () => {
      resolve({ monthly: null, annual: null });
    });
    expect(label).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Continue with Annual' }).props.accessibilityState
      ).toMatchObject({ disabled: false })
    );
  });

  test('Continue with an unloaded plan says it is not available', async () => {
    render();
    await settle();
    fireEvent.press(screen.getByText('Continue with Annual'));
    expect(alertSpy).toHaveBeenCalledWith('Unavailable', 'This plan is not configured yet. Check RevenueCat setup.');
  });

  test('purchase failure shows the error', async () => {
    mockRc.packages = Promise.resolve({ monthly: pkg('$2.99', 2.99), annual: pkg('$19.99', 19.99) });
    const purchasePackage = jest.fn(async () => ({ success: false, error: 'Card declined' }));
    useSubscriptionStore.setState({ purchasePackage });
    render();
    await screen.findByText('$19.99/yr');
    await settle();
    await act(async () => {
      fireEvent.press(screen.getByText('Continue with Annual'));
    });
    expect(purchasePackage).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Purchase failed', 'Card declined');
  });

  test.each([
    [{ success: true, restored: true }, 'Purchases restored', 'Pro is active on this device.'],
    [{ success: true, restored: false }, 'No purchases found', 'Nothing to restore for this account.'],
    [{ success: false }, 'Restore failed', 'Could not restore purchases. Try again.'],
    [{ success: false, error: 'Restore timed out. Try again.' }, 'Restore failed', 'Restore timed out. Try again.'],
  ])('restore %j → %s', async (result, title, body) => {
    useSubscriptionStore.setState({ restorePurchases: jest.fn(async () => result) });
    render();
    await settle();
    await act(async () => {
      fireEvent.press(screen.getByText('Restore purchases'));
    });
    expect(alertSpy).toHaveBeenCalledWith(title, body);
  });

  test('dev builds show Grant Pro (testing)', async () => {
    render();
    await settle();
    expect(screen.getByText('Grant Pro (testing)')).toBeTruthy();
  });
});

describe('guest (anonymous)', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAnonymous: true });
  });

  test('sees the highlight, comparison and prices, with Link account to purchase instead of buying', async () => {
    const r = render('/subscription?feature=custom_templates');
    await settle();
    expect(screen.getByText('Custom workout templates is included with Pro.')).toBeTruthy();
    expect(screen.getByText('Basic vs Pro')).toBeTruthy();
    expect(screen.getByText('$19.99/yr')).toBeTruthy();
    expect(screen.queryByText('Continue with Annual')).toBeNull();
    expect(screen.queryByText('Restore purchases')).toBeNull();
    fireEvent.press(screen.getByText('Link account to purchase'));
    expect(await screen.findByText('route:auth')).toBeTruthy();
    expect(r.getPathname()).toBe('/auth');
  });
});

describe('Pro current plan card', () => {
  test('store plan: plan, Renews {date}, Manage subscription, no plan picker', async () => {
    useSubscriptionStore.setState({
      state: { tier: 'pro', plan: 'annual', expiresAt: '2030-01-15T12:00:00Z' },
      isLoading: false,
    });
    render('/subscription?feature=personal_records');
    await settle();
    expect(screen.getByText('Pro')).toBeTruthy();
    expect(screen.getByText('Annual plan')).toBeTruthy();
    expect(screen.getByText(/^Renews /)).toBeTruthy();
    expect(screen.getByText('Manage subscription')).toBeTruthy();
    expect(screen.queryByText('Choose a plan')).toBeNull();
    expect(screen.queryByText(/is included with Pro\./)).toBeNull();
    expect(screen.getByText('Reset to Basic (testing)')).toBeTruthy();
  });

  test('complimentary lifetime: Lifetime, Manage hidden', async () => {
    useSubscriptionStore.setState({
      state: { tier: 'pro', plan: 'complimentary', expiresAt: '2226-08-13T00:09:50Z' },
      isLoading: false,
    });
    render();
    await settle();
    expect(screen.getByText('Complimentary plan')).toBeTruthy();
    expect(screen.getByText('Lifetime')).toBeTruthy();
    expect(screen.queryByText('Manage subscription')).toBeNull();
  });

  test('complimentary fixed-length: Until {date}', async () => {
    useSubscriptionStore.setState({
      state: { tier: 'pro', plan: 'complimentary', expiresAt: '2030-03-01T12:00:00Z' },
      isLoading: false,
    });
    render();
    await settle();
    expect(screen.getByText(/^Until /)).toBeTruthy();
    expect(screen.queryByText('Manage subscription')).toBeNull();
  });

  test('skeleton while loading with nothing cached', async () => {
    useSubscriptionStore.setState({ state: null, isLoading: true });
    render();
    await settle();
    expect(screen.queryByText('Current plan')).toBeNull();
    act(() => setPro(false));
    expect(await screen.findByText('Current plan')).toBeTruthy();
  });
});
