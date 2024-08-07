import React, { useState, useEffect } from 'react';
import './Article.css';
import defaultThumbnail from './thumbnail.jpg';
import fetchPageTitle from './fetchAPI';

/**
 * Component to display article information with hover effects.
 * @param {object} url - The URL object for the article.
 * @returns {JSX.Element} The rendered article component.
 */
const Articles = ({ url }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [img, setImage] = useState(defaultThumbnail);

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchPageTitle(url);
      if (data) {
        setPageTitle(data.title);
        setMetaDescription(data.metaDescription);
        setAuthor(data.author);
        setImage(data.imgURL || defaultThumbnail);
      }
    };

    fetchData();
  }, [url]);

  console.log("Image path", img)

  return (
    <div
      className="column"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a href={url}>
        <div className={`post-module ${isHovered ? 'hover' : ''}`}>
          <div className="thumbnail">
          <img src={img !== '' ? img : defaultThumbnail} alt="Page Thumbnail" />
          </div>
          <div className="post-content">
            <div className="category">News</div>
            <h1 className="title">{pageTitle}</h1>
            <h2 className="sub_title">{author}</h2>
            <p className={`description ${isHovered ? 'show' : ''}`}>
              {metaDescription}
            </p>
            <div className="post-meta">
              <span className={`timestamp ${isHovered ? 'hide-timestamp' : ''}`}>
                <i className="fa fa-clock-o"></i> Read more...
              </span>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
};

export default Articles;
