# earthquake-hub-frontend
Frontend code for the EarthquakeHub web app

## Local development
For local development, the backend is needed to serve the requests from the frontend. As
such, you need to spin up the backend code first, then the frontend. All of the
development setup makes use of docker.

1. Clone earthquake-hub-backend, 
    ```bash
    git clone git@github.com:UPRI-earthquake/earthquake-hub-backend.git
    ```
   and in it, set the following `.env` variables,
    ```bash
    CLIENT_DEV_HOST=localhost
    CLIENT_DEV_PORT=3000
    ```
   install all dependencies via `npm install` and finally, run it via 
   `docker compose up --attach backend` from which you should see the following:
    ```bash
    [nodemon] restarting due to changes...
    [nodemon] starting `node -r dotenv/config index.js`
    db-host: mongodb
    mysql-host: host.docker.internal
    Development backend listening at http://172.22.0.3:5000
    Development client expected (by CORS) at http://localhost:3000
    ```

2. Similar to above, clone this repository, 
    ```bash
    git clone git@github.com:UPRI-earthquake/earthquake-hub-frontend.git
    ```
   create .env file from .env.example, making sure to put this value
    ```bash
    REACT_APP_BACKEND_DEV=http://172.22.0.3:5000
    ```
   install the dependencies, via `npm install`
   and run `docker compose up`

## Publishing container image
1. Build the image, and tag with the correct [semantic versioning](https://semver.org/): 
    > Note: replace X.Y.Z, and you should be at the same directory as the Dockerfile

    ```bash
    docker build -t ghcr.io/upri-earthquake/earthquake-hub-frontend:X.Y.Z .
    ```
2. Push the image to ghcr.io:
    ```bash
    docker push ghcr.io/upri-earthquake/earthquake-hub-frontend:X.Y.Z
    ```


<!---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

--->
