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
  { id: '4', username: 'user4', content: 'Fourth report' },
  { id: '5', username: 'user5', content: 'Fifth report' },
  { id: '6', username: 'user6', content: 'Sixth report' },
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

    expect(screen.getByText(/No community reports yet/i)).toBeInTheDocument();
  });

  test('renders carousel container with featured report when reports are provided', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    expect(container.querySelector('.carouselContainer')).toBeInTheDocument();
    expect(screen.getByText('user1')).toBeInTheDocument();
    expect(screen.getByText('First report content here')).toBeInTheDocument();
  });

  test('renders dot indicators for multiple reports', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    expect(container.querySelectorAll('.dot')).toHaveLength(3);
  });

  test('caps preview dots to the latest preview set', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReportsWithOverflow} />);

    expect(container.querySelectorAll('.dot')).toHaveLength(5);
    expect(screen.queryByLabelText(/Go to preview report 6/i)).not.toBeInTheDocument();
  });

  test('does not render dots when there is only one report', () => {
    const { container } = render(<CommunityReportsCarousel reports={[mockReports[0]]} />);

    expect(container.querySelectorAll('.dot')).toHaveLength(0);
  });

  test('clicking a dot navigates to that report', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    fireEvent.click(container.querySelectorAll('.dot')[1]);

    expect(screen.getByText('Second report content here')).toBeInTheDocument();
    expect(screen.getByText('user2')).toBeInTheDocument();
  });

  test('active class moves when navigating to a different dot', () => {
    const { container } = render(<CommunityReportsCarousel reports={mockReports} />);

    expect(container.querySelectorAll('.dot')[0]).toHaveClass('active');
    fireEvent.click(container.querySelectorAll('.dot')[2]);

    expect(container.querySelectorAll('.dot')[2]).toHaveClass('active');
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

  test('renders image-only report fallback text', () => {
    render(<CommunityReportsCarousel reports={[{ id: '1', username: 'Anonymous', imageURL: '/uploads_dev/1.jpg' }]} />);

    expect(screen.getByText('Image report')).toBeInTheDocument();
  });
});
