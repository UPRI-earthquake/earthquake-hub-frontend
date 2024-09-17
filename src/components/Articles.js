import React, { useState, useEffect } from 'react';
import './Article.css';
import defaultThumbnail from './thumbnail.jpg';
import axios from 'axios';

/**
 * Component to display article information with hover effects.
 * @param {object} url - The URL object for the article.
 * @returns {JSX.Element} The rendered article component.
 */
const Articles = ({ url }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [pageTitle, setPageTitle] = useState('Loading...');
  const [metaDescription, setMetaDescription] = useState('Loading...');
  const [author, setAuthor] = useState('Loading...');
  const [img, setImage] = useState(defaultThumbnail);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const proxyUrl = 'https://thingproxy.freeboard.io/fetch/';
        // const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const response = await axios.get(proxyUrl + url, { withCredentials: false});
        const payload = response.data;
        console.log("RESPONSE: " + response)

        const parser = new DOMParser();
        const doc = parser.parseFromString(payload, 'text/html');
        setPageTitle(doc.querySelector('title').innerText);
        setMetaDescription(doc.querySelector('meta[name="description"]').content);
        setAuthor(doc.querySelector('meta[property="og:site_name"]').content);
        setImage(doc.querySelector('meta[property="og:image"]').content || defaultThumbnail);
      } catch (error) {
        console.log("Error fetching data from link: " + error)

        setPageTitle("...");
        setMetaDescription("...");
        setAuthor("...");
        setImage(defaultThumbnail);
      }
    };

    fetchData();
  }, [url]);

  return (
    <div
      className="column"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a href={url} target='_blank'>
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
                <i className="fa fa-clock-o"></i> Click here to redirect to the article.
              </span>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
};

export default Articles;
