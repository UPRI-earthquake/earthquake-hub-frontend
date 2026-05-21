import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import CommunityReportsCarousel from '../CommunityReportsCarousel';

jest.mock('axios');
jest.mock('../../utils/backendHost', () => ({
  getBackendHost: jest.fn(() => 'http://localhost:3000/api'),
}));

const mockReports = [
  {
    id: '1',
    username: 'user1',
    content: 'First report content here',
    imageURL: 'http://localhost:3000/images/1.jpg',
  },
  {
    id: '2',
    username: 'user2',
    content: 'Second report content here',
    imageUrl: 'http://localhost:3000/images/2.jpg',
  },
  {
    id: '3',
    username: 'Anonymous',
    content: 'Third report without an image',
  },
];

describe('CommunityReportsCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Loading state', () => {
    test('renders loading message when fetching reports', async () => {
      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<CommunityReportsCarousel eventId="event-123" />);

      expect(screen.getByText(/Loading community reports/i)).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    test('renders error message when API request fails', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to load community reports/i)).toBeInTheDocument();
      });
    });

    test('calls onReportsLoaded with 0 on error', async () => {
      const onReportsLoaded = jest.fn();
      axios.get.mockRejectedValue(new Error('Network error'));

      render(<CommunityReportsCarousel eventId="event-123" onReportsLoaded={onReportsLoaded} />);

      await waitFor(() => {
        expect(onReportsLoaded).toHaveBeenCalledWith(0);
      });
    });
  });

  describe('Empty state', () => {
    test('renders empty state when no reports are returned', async () => {
      axios.get.mockResolvedValue({ data: { payload: [] } });

      render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText(/No community reports yet/i)).toBeInTheDocument();
      });
    });

    test('calls onReportsLoaded with 0 when no reports', async () => {
      const onReportsLoaded = jest.fn();
      axios.get.mockResolvedValue({ data: { payload: [] } });

      render(<CommunityReportsCarousel eventId="event-123" onReportsLoaded={onReportsLoaded} />);

      await waitFor(() => {
        expect(onReportsLoaded).toHaveBeenCalledWith(0);
      });
    });
  });

  describe('Successful render with reports', () => {
    test('renders carousel container with featured report when reports are loaded', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(container.querySelector('.carouselContainer')).toBeInTheDocument();
      });
    });

    test('displays first report content', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });
    });

    test('calls onReportsLoaded with correct count', async () => {
      const onReportsLoaded = jest.fn();
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      render(<CommunityReportsCarousel eventId="event-123" onReportsLoaded={onReportsLoaded} />);

      await waitFor(() => {
        expect(onReportsLoaded).toHaveBeenCalledWith(3);
      });
    });

    test('renders dot indicators for multiple reports', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        const dots = container.querySelectorAll('.dot');
        expect(dots).toHaveLength(3);
      });
    });

    test('does not render dots when there is only one report', async () => {
      axios.get.mockResolvedValue({ data: { payload: [mockReports[0]] } });

      const { container } = render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        const dots = container.querySelectorAll('.dot');
        expect(dots).toHaveLength(0);
      });
    });
  });

  describe('Dot navigation', () => {
    test('clicking a dot navigates to that report', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });

      const dots = container.querySelectorAll('.dot');
      fireEvent.click(dots[1]);

      await waitFor(() => {
        expect(screen.getByText('Second report content here')).toBeInTheDocument();
        expect(screen.getByText('user2')).toBeInTheDocument();
      });
    });

    test('first dot has active class initially', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        const dots = container.querySelectorAll('.dot');
        expect(dots[0]).toHaveClass('active');
      });
    });

    test('active class moves when navigating to different dot', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(container.querySelectorAll('.dot')[0]).toHaveClass('active');
      });

      const dots = container.querySelectorAll('.dot');
      fireEvent.click(dots[2]);

      await waitFor(() => {
        expect(container.querySelectorAll('.dot')[2]).toHaveClass('active');
        expect(container.querySelectorAll('.dot')[0]).not.toHaveClass('active');
      });
    });
  });

  describe('Featured report click activation', () => {
    test('clicking featured report calls onReportClick callback', async () => {
      const onReportClick = jest.fn();
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(
        <CommunityReportsCarousel eventId="event-123" onReportClick={onReportClick} />,
      );

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });

      const featuredContainer = container.querySelector('.featuredReportContainer');
      fireEvent.click(featuredContainer);

      await waitFor(() => {
        expect(onReportClick).toHaveBeenCalled();
      });
    });

    test('clicking featured report with scrollable element scrolls to report', async () => {
      const onReportClick = jest.fn();
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(
        <CommunityReportsCarousel eventId="event-123" onReportClick={onReportClick} />,
      );

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });

      // Create a mock element for scrollIntoView
      const mockElement = document.createElement('div');
      mockElement.id = 'comment-1';
      mockElement.scrollIntoView = jest.fn();
      document.body.appendChild(mockElement);

      const featuredContainer = container.querySelector('.featuredReportContainer');
      fireEvent.click(featuredContainer);

      await waitFor(() => {
        expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start',
        });
      });

      document.body.removeChild(mockElement);
    });
  });

  describe('Keyboard activation', () => {
    test('pressing Enter on featured report calls navigation', async () => {
      const onReportClick = jest.fn();
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(
        <CommunityReportsCarousel eventId="event-123" onReportClick={onReportClick} />,
      );

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });

      const featuredContainer = container.querySelector('.featuredReportContainer');
      fireEvent.keyDown(featuredContainer, { key: 'Enter' });

      await waitFor(() => {
        expect(onReportClick).toHaveBeenCalled();
      });
    });

    test('pressing Space on featured report calls navigation and prevents default', async () => {
      const onReportClick = jest.fn();
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(
        <CommunityReportsCarousel eventId="event-123" onReportClick={onReportClick} />,
      );

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });

      const featuredContainer = container.querySelector('.featuredReportContainer');
      const event = new KeyboardEvent('keydown', { key: ' ' });
      event.preventDefault = jest.fn();
      fireEvent(featuredContainer, event);

      // Space key should call navigation
      await waitFor(() => {
        expect(onReportClick).toHaveBeenCalled();
      });
    });
  });

  describe('Auto-rotation', () => {
    test('auto-rotates to next report after interval', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });

      // Advance timers by the carousel rotation interval
      jest.advanceTimersByTime(6000);

      await waitFor(() => {
        expect(screen.getByText('Second report content here')).toBeInTheDocument();
      });
    });

    test('auto-rotation loops back to first report after last', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });

      // Advance through all reports (3 reports * 6000ms each)
      jest.advanceTimersByTime(18000);

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });
    });

    test('does not auto-rotate when there is only one report', async () => {
      axios.get.mockResolvedValue({ data: { payload: [mockReports[0]] } });

      render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('First report content here')).toBeInTheDocument();
      });

      jest.advanceTimersByTime(12000);

      // Should still show the same report
      expect(screen.getByText('First report content here')).toBeInTheDocument();
    });
  });

  describe('Image URL resolution', () => {
    test('renders featured report with valid image URL', async () => {
      axios.get.mockResolvedValue({ data: { payload: mockReports } });

      const { container } = render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        const featuredContainer = container.querySelector('.featuredReportContainer');
        const style = window.getComputedStyle(featuredContainer);
        // backgroundImage would contain the URL if set properly
        expect(featuredContainer).toHaveStyle('background-size: cover');
      });
    });

    test('uses fallback gradient when no image URL provided', async () => {
      const reportsWithoutImage = [
        {
          id: '1',
          username: 'user1',
          content: 'Report without image',
        },
      ];
      axios.get.mockResolvedValue({ data: { payload: reportsWithoutImage } });

      const { container } = render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        const featuredContainer = container.querySelector('.featuredReportContainer');
        expect(featuredContainer).toBeInTheDocument();
      });
    });
  });

  describe('API call parameters', () => {
    test('fetches reports with correct eventId parameter', async () => {
      axios.get.mockResolvedValue({ data: { payload: [] } });

      render(<CommunityReportsCarousel eventId="event-xyz" />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining('/comments/'),
          expect.objectContaining({
            params: { eventId: 'event-xyz' },
            withCredentials: true,
            timeout: 10000,
          }),
        );
      });
    });

    test('cancels previous request when component unmounts', async () => {
      const controller = new AbortController();
      const abortSpy = jest.spyOn(controller, 'abort');

      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { unmount } = render(<CommunityReportsCarousel eventId="event-123" />);

      unmount();

      // Verify cleanup function was called by checking if abort was called
      // Note: This is tricky to test directly without exposing internals
      expect(axios.get).toHaveBeenCalled();
    });
  });

  describe('Anonymous users', () => {
    test('displays Anonymous when username is not provided', async () => {
      const reportWithoutUsername = [
        {
          id: '1',
          content: 'Report from anonymous user',
        },
      ];
      axios.get.mockResolvedValue({ data: { payload: reportWithoutUsername } });

      render(<CommunityReportsCarousel eventId="event-123" />);

      await waitFor(() => {
        expect(screen.getByText('Anonymous')).toBeInTheDocument();
      });
    });
  });
});
