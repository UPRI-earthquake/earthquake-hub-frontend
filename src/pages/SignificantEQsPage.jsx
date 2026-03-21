import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Card from '../components/Card';
import moment from '../utils/time';
import { getBackendHost } from '../utils/backendHost';
import InfoTooltip from '../components/InfoTooltip';
import './SignificantEQsPage.css';

/**
 * Significant Earthquakes list page. Renders a grid of cards loaded from backend
 * and navigates to detail page on card click.
 * @returns {JSX.Element}
 */
function SignificantEQsPage() {
  const [significantEQs, setSignificantEQs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Significant Earthquakes | Earthquake Hub';
    }
  }, []);

  const formatEventTime = useCallback((eventTime) => {
    const parsed = moment(eventTime);
    if (!parsed || !parsed.isValid()) return 'Date unavailable';
    return parsed.format('MMM D, YYYY • h:mm A');
  }, []);

  const fetchSignificantEQs = useCallback(async (signal) => {
    setError('');
    setLoading(true);
    try {
      const backendHost = getBackendHost();
      if (!backendHost) {
        throw new Error('Backend host is not configured.');
      }
      const response = await axios.get(`${backendHost}/significant-eqs/all`, {
        withCredentials: true,
        signal,
      });
      setSignificantEQs(Array.isArray(response?.data?.payload) ? response.data.payload : []);
    } catch (err) {
      if (axios.isCancel?.(err) || signal?.aborted) return;
      console.error('Error fetching significant EQs:', err);
      setError(err?.message || 'Unable to load events right now.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSignificantEQs(controller.signal);
    return () => controller.abort();
  }, [fetchSignificantEQs]);

  // Function for transitioning to another page on card click
  const handleCardClick = useCallback(
    (id) => {
      if (!id) return;
      const url = `/significant-eq-info?id=${id}`;
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (_) {
        navigate(url);
      }
    },
    [navigate],
  );

  const cards = useMemo(
    () =>
      significantEQs.map((card, index) => {
        const summary = card?.eventSummary || card?.description || '';
        const magnitude =
          typeof card?.magnitude === 'number'
            ? card.magnitude.toFixed(1).replace(/\.0$/, '')
            : card?.magnitude || '—';
        const depthValue = Number(card?.depth);
        const depth = Number.isFinite(depthValue) ? `${depthValue.toFixed(0)} km` : null;

        return (
          <Card
            key={card?._id || index}
            title={card?.title || 'Significant Earthquake'}
            magnitude={magnitude}
            location={card?.location || 'Location unavailable'}
            dateLabel={formatEventTime(card?.eventTime || card?.date)}
            depth={depth}
            summary={summary}
            onClick={() => handleCardClick(card?._id)}
          />
        );
      }),
    [formatEventTime, handleCardClick, significantEQs],
  );

  return (
    <div className="seq-page">
      <Header />
      <main className="seq-body">
        <section className="seq-hero">
          <div className="seq-hero-text">
            <div className="hero-title-row">
              <p className="eyebrow">Earthquake Hub · Library</p>
              <h1>
                Significant Earthquakes
                <InfoTooltip title="About this page" label="What is shown here?" variant="inline" className="hero-tip">
                  Recent strong events with accessible recordings and vetted summaries. Tap an event
                  to review details, download station data, or share authoritative references.
                </InfoTooltip>
              </h1>
            </div>
          </div>
          <div className="seq-hero-meta">
            <div className="meta-card">
              <span className="meta-label" aria-hidden="true">Events listed</span>
              <span className="meta-value" aria-label={`Events listed: ${significantEQs.length}`} title={`Events listed: ${significantEQs.length}`}>
                {significantEQs.length}
              </span>
            </div>
          </div>
        </section>

        <section className="seq-grid-section">
          {error && (
            <div className="seq-alert" role="status">
              {error}
            </div>
          )}
          {loading ? (
            <div className="seq-placeholder">Loading significant earthquakes…</div>
          ) : cards.length ? (
            <div className="cards-grid">{cards}</div>
          ) : (
            <div className="seq-placeholder">No significant earthquakes posted yet.</div>
          )}
        </section>
      </main>
    </div>
  );
}

export default SignificantEQsPage;
