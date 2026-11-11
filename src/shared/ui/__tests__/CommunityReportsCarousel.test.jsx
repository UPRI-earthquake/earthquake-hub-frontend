import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import CommunityReportsCarousel from '../CommunityReportsCarousel';

jest.mock('../../utils/backendHost', () => ({
  getBackendHost: jest.fn(() => 'http://localhost:3000/api'),
}));

const mockReports = [
  {
    id: '1',
    username: 'user1',
    content: 'First report content here',
    imageURL: '/uploads_dev/1.jpg',
  },
  {
    id: '2',
    username: 'user2',
    content: 'Second report content here',
    imageUrl: '/uploads_dev/2.jpg',
  },
  {
    id: '3',
    username: 'Anonymous',
    content: 'Third report without an image',
  },
];

const mockReportsWithOverflow = [
  ...mockReports,
  { id: '4', username: 'user4', content: 'Fourth report', imageURL: '/uploads_dev/4.jpg' },
  { id: '5', username: 'user5', content: 'Fifth report', imageURL: '/uploads_dev/5.jpg' },
  { id: '6', username: 'user6', content: 'Sixth report', imageURL: '/uploads_dev/6.jpg' },
];

function mockReducedMotion(matches = false) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

describe('CommunityReportsCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('renders loading message when reports are loading', () => {
    render(<CommunityReportsCarousel loading reports={[]} />);

    expect(screen.getByText(/Loading community reports/i)).toBeInTheDocument();
  });

  test('renders announced error when reports fail to load', () => {
    render(<CommunityReportsCarousel error="Unable to load community reports." reports={[]} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load community reports.');
  });

  test('renders empty state when there are no reports', () => {
    render(<CommunityReportsCarousel reports={[]} />);

    expect(screen.getByText(/No image reports yet/i)).toBeInTheDocument();
  });

  test('renders carousel container with featured report when reports are provided', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    expect(container.querySelector('.carouselContainer')).toBeInTheDocument();
    expect(screen.getByLabelText('Reported by user1')).toBeInTheDocument();
    expect(screen.getByText('First report content here')).toBeInTheDocument();
  });

  test('renders dot indicators only for image reports', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    expect(container.querySelectorAll('.dot')).toHaveLength(2);
    expect(screen.queryByText('Third report without an image')).not.toBeInTheDocument();
  });

  test('caps preview dots to the latest preview set', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReportsWithOverflow} />);

    expect(container.querySelectorAll('.dot')).toHaveLength(5);
    expect(screen.queryByLabelText(/Go to preview report 6/i)).not.toBeInTheDocument();
  });

  test('prioritizes helpful image reports before recency in the preview', () => {
    render(
      <CommunityReportsCarousel
        reports={[
          {
            id: 'newer',
            username: 'newer-user',
            content: 'Newer image report',
            imageURL: '/uploads_dev/newer.jpg',
            helpfulCount: 1,
            createdAt: '2026-06-24T04:00:00.000Z',
          },
          {
            id: 'older-helpful',
            username: 'older-user',
            content: 'More helpful image report',
            imageURL: '/uploads_dev/older.jpg',
            helpfulCount: 4,
            createdAt: '2026-06-24T03:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('More helpful image report')).toBeInTheDocument();
    expect(screen.queryByText('Newer image report')).not.toBeInTheDocument();
  });

  test('does not render dots when there is only one report', () => {
    const { container } = render(<CommunityReportsCarousel reports={[mockReports[0]]} />);

    expect(container.querySelectorAll('.dot')).toHaveLength(0);
  });

  test('clicking a dot navigates to that report', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    fireEvent.click(container.querySelectorAll('.dot')[1]);

    expect(screen.getByText('Second report content here')).toBeInTheDocument();
    expect(screen.getByLabelText('Reported by user2')).toBeInTheDocument();
  });

  test('active class moves when navigating to a different dot', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    expect(container.querySelectorAll('.dot')[0]).toHaveClass('active');
    fireEvent.click(container.querySelectorAll('.dot')[1]);

    expect(container.querySelectorAll('.dot')[1]).toHaveClass('active');
    expect(container.querySelectorAll('.dot')[0]).not.toHaveClass('active');
  });

  test('clicking featured report calls callback and scrolls to report', async () => {
    const onReportClick = jest.fn();
    const mockElement = document.createElement('div');
    mockElement.id = 'comment-1';
    mockElement.scrollIntoView = jest.fn();
    document.body.appendChild(mockElement);

    const { container } = render(
      <CommunityReportsCarousel reports={mockReports} onReportClick={onReportClick} />,
    );

    fireEvent.click(container.querySelector('.featuredReportContainer'));

    expect(onReportClick).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    document.body.removeChild(mockElement);
  });

  test('uses commentId as the stable report anchor when Mongo ids are not exposed', async () => {
    const onReportClick = jest.fn();
    const mockElement = document.createElement('div');
    mockElement.id = 'comment-report-public-id';
    mockElement.scrollIntoView = jest.fn();
    document.body.appendChild(mockElement);

    const { container } = render(
      <CommunityReportsCarousel
        reports={[{
          commentId: 'report-public-id',
          username: 'Anonymous',
          content: 'Public report content',
          imageURL: '/uploads_dev/public.jpg',
        }]}
        onReportClick={onReportClick}
      />,
    );

    fireEvent.click(container.querySelector('.featuredReportContainer'));

    expect(onReportClick).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    document.body.removeChild(mockElement);
  });

  test('keyboard activation opens the selected report', () => {
    const onReportClick = jest.fn();
    const { container } = render(
      <CommunityReportsCarousel reports={mockReports} onReportClick={onReportClick} />,
    );

    fireEvent.keyDown(container.querySelector('.featuredReportContainer'), { key: 'Enter' });

    expect(onReportClick).toHaveBeenCalled();
  });

  test('clicking a featured report image opens image preview when available', () => {
    const onReportClick = jest.fn();
    const onImagePreview = jest.fn();
    const { container } = render(
      <CommunityReportsCarousel
        reports={mockReports}
        onReportClick={onReportClick}
        onImagePreview={onImagePreview}
      />,
    );

    fireEvent.click(container.querySelector('.featuredReportContainer'));

    expect(onImagePreview).toHaveBeenCalledWith(expect.objectContaining({
      src: '/uploads_dev/1.jpg',
      alt: 'Submitted report attachment from user1',
      source: 'community-carousel',
      galleryIndex: 0,
      overlay: {
        author: 'user1',
        text: 'First report content here',
      },
      gallery: expect.arrayContaining([
        expect.objectContaining({ src: '/uploads_dev/1.jpg' }),
        expect.objectContaining({ src: '/uploads_dev/2.jpg' }),
      ]),
    }));
    expect(onReportClick).not.toHaveBeenCalled();
  });

  test('keyboard activation opens image preview when the selected report has an image', () => {
    const onImagePreview = jest.fn();
    const { container } = render(
      <CommunityReportsCarousel reports={mockReports} onImagePreview={onImagePreview} />,
    );

    fireEvent.keyDown(container.querySelector('.featuredReportContainer'), { key: 'Enter' });

    expect(onImagePreview).toHaveBeenCalled();
  });

  test('auto-rotates when motion is allowed', () => {
    render(<CommunityReportsCarousel reports={mockReports} />);

    expect(screen.getByText('First report content here')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(screen.getByText('Second report content here')).toBeInTheDocument();
  });

  test('does not auto-rotate when reduced motion is preferred', () => {
    mockReducedMotion(true);
    render(<CommunityReportsCarousel reports={mockReports} />);

    act(() => {
      jest.advanceTimersByTime(12000);
    });

    expect(screen.getByText('First report content here')).toBeInTheDocument();
  });

  test('pauses auto-rotation after manual dot interaction', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    fireEvent.click(container.querySelectorAll('.dot')[1]);
    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(screen.getByText('Second report content here')).toBeInTheDocument();
  });

  test('renders anonymous avatar without placeholder text for image-only reports', () => {
    const { container } = render(
      <CommunityReportsCarousel reports={[{ id: '1', username: 'Anonymous', imageURL: '/uploads_dev/1.jpg' }]} />,
    );

    expect(screen.queryByText('Anonymous')).not.toBeInTheDocument();
    expect(screen.queryByText('Image report')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reported by Anonymous')).toBeInTheDocument();
    expect(container.querySelector('.contentOverlay')).toBeInTheDocument();
  });

  test('renders named author initials without full author text for image-only reports', () => {
    const { container } = render(
      <CommunityReportsCarousel reports={[{ id: '1', username: 'Field team', imageURL: '/uploads_dev/1.jpg' }]} />,
    );

    expect(screen.queryByText('Field team')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reported by Field team')).toBeInTheDocument();
    expect(screen.getByText('FT')).toBeInTheDocument();
    expect(container.querySelector('.contentOverlay')).toBeInTheDocument();
  });

  test('renders report text without anonymous author label', () => {
    render(
      <CommunityReportsCarousel
        reports={[{
          id: '1',
          username: 'Anonymous',
          content: 'Visible community observation',
          imageURL: '/uploads_dev/1.jpg',
        }]}
      />,
    );

    expect(screen.queryByText('Anonymous')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reported by Anonymous')).toBeInTheDocument();
    expect(screen.getByText('Visible community observation')).toBeInTheDocument();
  });

  test('does not include text-only reports in the carousel', () => {
    render(
      <CommunityReportsCarousel
        reports={[{
          id: 'text-only',
          username: 'Field team',
          content: 'Text-only observation',
        }]}
      />,
    );

    expect(screen.getByText(/No image reports yet/i)).toBeInTheDocument();
    expect(screen.queryByText('Text-only observation')).not.toBeInTheDocument();
  });
});
