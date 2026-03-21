import React, { useMemo } from 'react';
import './Article.css';
import defaultThumbnail from '../assets/thumbnail.jpg';

/**
 * Modern article card with source tag and CTA.
 */
const Articles = ({ url }) => {
  const safeHref = useMemo(() => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch (_) {}
    return '';
  }, [url]);

  const source = useMemo(() => {
    if (!url) return 'Unknown source';
    const lower = url.toLowerCase();
    if (lower.includes('mb.com')) return 'Manila Bulletin';
    if (lower.includes('phivolcs')) return 'PHIVOLCS';
    if (lower.includes('sunstar')) return 'Sunstar';
    if (lower.includes('inquirer')) return 'Inquirer.net';
    if (lower.includes('abs-cbn')) return 'ABS-CBN News';
    if (lower.includes('gma')) return 'GMA News';
    if (lower.includes('philstar')) return 'Philstar';
    if (lower.includes('rappler')) return 'Rappler';
    if (lower.includes('ndrrmc')) return 'NDRRMC';
    if (lower.includes('pna')) return 'Philippine News Agency';
    return 'Trusted source';
  }, [url]);

  const hostname = useMemo(() => {
    try {
      return safeHref ? new URL(safeHref).hostname.replace('www.', '') : '';
    } catch (_) {
      return '';
    }
  }, [safeHref]);

  const CardTag = safeHref ? 'a' : 'div';
  const cardProps = safeHref
    ? { href: safeHref, target: '_blank', rel: 'noreferrer noopener' }
    : { 'aria-disabled': 'true' };

  return (
    <CardTag className="article-card" {...cardProps}>
      <div className="article-media" style={{ backgroundImage: `url(${defaultThumbnail})` }}>
        <span className="article-tag">News</span>
      </div>
      <div className="article-body">
        <p className="article-kicker">{hostname || 'External link'}</p>
        <h3 className="article-title">{source}</h3>
        <div className="article-meta">
          <span>{safeHref ? 'Open article' : 'Link unavailable'}</span>
          <span aria-hidden="true">↗</span>
        </div>
      </div>
    </CardTag>
  );
};

export default Articles;
