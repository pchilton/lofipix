import { cleanup, render } from '@testing-library/react-native';

const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), popToTop: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../src/lib/auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../src/lib/hooks', () => ({
  useAlbums: jest.fn(),
  usePhotos: jest.fn(),
  useAlbum: jest.fn(),
  useAlbumPhotos: jest.fn(),
  usePendingIds: jest.fn(),
  useSyncLabel: jest.fn(),
}));

jest.mock('../src/lib/domain/albums', () => ({
  createAlbum: jest.fn(async () => 'new-album'),
  updateAlbumNotes: jest.fn(async () => undefined),
  touchAlbum: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/domain/photos', () => ({
  capturePhoto: jest.fn(async () => 'photo-2'),
  deletePhoto: jest.fn(async () => undefined),
}));

jest.mock('../src/lib/photo-capture', () => ({
  deletePhotoBytes: jest.fn(async () => undefined),
  loadPhotoUri: jest.fn(async () => null),
  compressAndStorePhoto: jest.fn(),
  clearPhotoBytes: jest.fn(),
  PHOTO_IMAGE_QUALITY: 82,
}));

import * as auth from '../src/lib/auth';
import * as hooks from '../src/lib/hooks';
import { CaptureScreen } from '../src/screens/CaptureScreen';
import { DashboardScreen } from '../src/screens/DashboardScreen';
import { FinishScreen } from '../src/screens/FinishScreen';
import { PhotoReviewScreen } from '../src/screens/PhotoReviewScreen';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';

const now = new Date('2026-01-01T00:00:00Z');

const album = {
  id: 'album-1',
  organizationId: 'org-1',
  name: 'AB12 CDE',
  notes: null,
  version: 1,
  outboxNeeded: false,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};

const photo = {
  id: 'photo-1',
  organizationId: 'org-1',
  albumId: 'album-1',
  position: 1,
  imageWidth: 1280,
  imageHeight: 720,
  imageQuality: 82,
  imageSize: 200_000,
  originatedAt: now,
  imageChecksum: 'abcdef1234567890',
  version: 1,
  outboxNeeded: false,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockRouteParams = {};
  jest.mocked(auth.useAuth).mockReturnValue({
    status: 'signed-in',
    session: { userId: 'user-1', email: 'alice@example.test', name: 'Alice', organizationId: 'org-1' },
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => true),
  });
  jest.mocked(hooks.useAlbums).mockReturnValue({ data: [album], isLoading: false, error: null } as never);
  jest.mocked(hooks.usePhotos).mockReturnValue({ data: [photo], isLoading: false, error: null } as never);
  jest.mocked(hooks.useAlbum).mockReturnValue({ data: album, isLoading: false, error: null } as never);
  jest.mocked(hooks.useAlbumPhotos).mockReturnValue({ data: [photo], isLoading: false, error: null } as never);
  jest.mocked(hooks.usePendingIds).mockReturnValue(new Set(['album-1']));
  jest.mocked(hooks.useSyncLabel).mockReturnValue('Connected');
});

afterEach(() => {
  cleanup();
});

describe('screens', () => {
  it('renders the welcome screen', async () => {
    const view = await render(<WelcomeScreen />);
    expect(view.getByTestId('welcome-screen')).toBeTruthy();
    expect(view.getByTestId('sign-in-email')).toBeTruthy();
    expect(view.getByTestId('sign-in-button')).toBeTruthy();
  });

  it('renders the dashboard with album and duplicate flows', async () => {
    const view = await render(<DashboardScreen />);
    expect(view.getByTestId('dashboard-screen')).toBeTruthy();
    expect(view.getByText('AB12 CDE')).toBeTruthy();
    expect(view.getByTestId('start-album-button')).toBeTruthy();
    expect(view.getByTestId('sign-out-button')).toBeTruthy();
  });

  it('renders the capture screen', async () => {
    mockRouteParams = { albumId: 'album-1' };
    const view = await render(<CaptureScreen />);
    expect(view.getByTestId('capture-screen')).toBeTruthy();
    expect(view.getByTestId('capture-button')).toBeTruthy();
    expect(view.getByTestId('finish-album-button')).toBeTruthy();
  });

  it('renders the finish screen', async () => {
    mockRouteParams = { albumId: 'album-1' };
    const view = await render(<FinishScreen />);
    expect(view.getByTestId('finish-screen')).toBeTruthy();
    expect(view.getByTestId('submit-album-button')).toBeTruthy();
    expect(view.getByTestId('add-photos-button')).toBeTruthy();
  });

  it('renders the photo review screen', async () => {
    mockRouteParams = { albumId: 'album-1', photoId: 'photo-1' };
    const view = await render(<PhotoReviewScreen />);
    expect(view.getByTestId('photo-review-screen')).toBeTruthy();
    expect(view.getByTestId('delete-photo-button')).toBeTruthy();
    expect(view.getByText('Dimensions')).toBeTruthy();
  });
});
