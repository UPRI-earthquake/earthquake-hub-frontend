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
  const [pageTitle, setPageTitle] = useState('Loading...');
  const [author, setAuthor] = useState('Loading...');
  const [img, setImage] = useState(defaultThumbnail);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const proxyUrl = 'https://thingproxy.freeboard.io/fetch/';
        // const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const response = await axios.get(proxyUrl + url, { withCredentials: false});
        const payload = response.data;

        const parser = new DOMParser();
        const doc = parser.parseFromString(payload, 'text/html');
        setPageTitle(doc.querySelector('title').innerText);
        setAuthor(doc.querySelector('meta[property="og:site_name"]').content);
        setImage(doc.querySelector('meta[property="og:image"]').content || defaultThumbnail);
      } catch (error) {
        console.log("Error fetching data from link: " + error)
        setAuthor("---");
        setImage(defaultThumbnail);
      }

      switch (true) {
        case url.includes("mb.com"):
          setAuthor("Manila Bulletin");
          break;

        case url.includes("phivolcs"):
          setAuthor("PHIVOLCS");
          break;

        case url.includes("sunstar"):
          setAuthor("Sunstar");
          break;

        case url.includes("inquirer"):
          setAuthor("Inquirer.net");
          break;

        case url.includes("abs-cbn"):
          setAuthor("ABSCBN News");
          break;

        case url.includes("gma"):
          setAuthor("GMA News");
          break;

        case url.includes("philstar"):
          setAuthor("Philstar");
          break;

        case url.includes("rappler"):
          setAuthor("Rappler");
          break;

        case url.includes("ndrrmc"):
          setAuthor("NDRRMC");
          break;

        case url.includes("pna"):
          setAuthor("Philippine News Agency");
          break;

        default:
          setAuthor("Unknown Source");
          break;
      }
    };

    fetchData();
  }, [url]);

  return (
    <div className="article-container" style={{ backgroundImage: `url(${img})` }}>
      <a href={url} target='_blank' rel="noreferrer noopener">
      <div className="article-content">
        <div className="article-category">News</div>
        <h3>{author}</h3>
        <div className="article-hover-details">
          <hr></hr>
          <p>{pageTitle}</p>
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
