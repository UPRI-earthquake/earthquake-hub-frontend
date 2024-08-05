import axios from 'axios';

/**
 * Fetches and parses the title, meta description, author, and image URL from the given webpage URL.
 * @param {string | object} url - The URL of the webpage or an object containing the URL.
 * @returns {Promise<object>} An object containing the title, meta description, author, and image URL.
 */
const fetchPageTitle = async (url) => {
  // Extract URL string if passed as an object
  while (typeof url === 'object' && url.url) {
    url = url.url;
  }

  console.log('URL:', url);
  
  const proxyUrl = 'https://thingproxy.freeboard.io/fetch/';
  // Uncomment the line below to use an alternative proxy
  // const proxyUrl = 'https://cors-anywhere.herokuapp.com/';

  try {
    const response = await axios.get(proxyUrl + url);
    const payload = response.data;
    console.log('PAYLOAD:', payload);

    const parser = new DOMParser();
    const doc = parser.parseFromString(payload, 'text/html');

    let title, metaDescription, author, imgURL;

    title = doc.querySelector('title').innerText;
    metaDescription = doc.querySelector('meta[name="description"]').content;
    author = doc.querySelector('meta[property="og:site_name"]').content;
    imgURL = doc.querySelector('meta[property="og:image"]').content;
    
    console.log('Title:', title);
    console.log('DESCRIPTION:', metaDescription);

    return { title, metaDescription, author, imgURL };
  } catch (fetchError) {
    console.error('Error occurred while fetching:', fetchError);
    return {
      title: "PHILIPPINE INSTITUTE OF VOLCANOLOGY AND SEISMOLOGY",
      metaDescription: '',
      author: 'PhiVolcs',
      imgURL: ''
    };
  }
};

export default fetchPageTitle;
