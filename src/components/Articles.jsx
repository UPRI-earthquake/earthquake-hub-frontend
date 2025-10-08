import React, { useState, useEffect } from 'react';
import './Article.css';
import defaultThumbnail from '../assets/thumbnail.jpg';

/**
 * Component to display article information with hover effects.
 * @param {object} url - The URL object for the article.
 * @returns {JSX.Element} The rendered article component.
 */
const Articles = ({ url }) => {
  const [author, setAuthor] = useState('Loading...');
  const [img] = useState(defaultThumbnail);

  useEffect(() => {
    const fetchData = async () => {
      switch (true) {
        case url.includes('mb.com'):
          setAuthor('Manila Bulletin');
          break;

        case url.includes('phivolcs'):
          setAuthor('PHIVOLCS');
          break;

        case url.includes('sunstar'):
          setAuthor('Sunstar');
          break;

        case url.includes('inquirer'):
          setAuthor('Inquirer.net');
          break;

        case url.includes('abs-cbn'):
          setAuthor('ABSCBN News');
          break;

        case url.includes('gma'):
          setAuthor('GMA News');
          break;

        case url.includes('philstar'):
          setAuthor('Philstar');
          break;

        case url.includes('rappler'):
          setAuthor('Rappler');
          break;

        case url.includes('ndrrmc'):
          setAuthor('NDRRMC');
          break;

        case url.includes('pna'):
          setAuthor('Philippine News Agency');
          break;

        default:
          setAuthor('Unknown Source');
          break;
      }
    };

    fetchData();
  }, [url]);

  return (
    <div className="article-container" style={{ backgroundImage: `url(${img})` }}>
      <a href={url} target="_blank" rel="noreferrer noopener">
        <div className="article-content">
          <div className="article-category">News</div>
          <h3>{author}</h3>
          <div className="article-hover-details">
            <hr></hr>
            <p>Earthquake report from {author}</p>
            <br></br>
            <br></br>
            <i>Click to redirect to the article</i>
          </div>
        </div>
      </a>
    </div>
  );
};

export default Articles;
