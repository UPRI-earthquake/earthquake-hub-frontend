## Setting Up The Repository On Your Local Machine
For local development, the earthquake-hub-backend is needed to serve the requests from the frontend. As such, you need to spin up the backend code first, then the frontend. All of the
development setup makes use of docker.

1. Clone earthquake-hub-backend, 
    ```bash
    git clone git@github.com:UPRI-earthquake/earthquake-hub-backend.git
    ```
   1. Configure the back-end setup by creating a file named `.env`, containing the config variables. An example is available its `.env.example`.
   2. Install all dependencies via:
        ```bash
        npm install
        ```
   3. Build the image via:
        ```bash
        docker build -t ghcr.io/upri-earthquake/earthquake-hub-backend:latest .
        ```
   4. Run the container via: 
        ```bash
        docker compose up
        ```  
        from which you should see the following:
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
    1. Configure the sender-front-end setup by creating a file named `.env`, containing the config variables. An example is available on `.env.example`., making sure to put this value
        ```bash
        REACT_APP_BACKEND_DEV=http://172.22.0.3:5000
        REACT_APP_RINGSERVER_WS_DEV=ws://127.0.0.1:16000/datalink
        ```
    2. Install the dependencies via:
        ```bash
        npm install
        ```
    3. Build the image via:
        ```bash
        docker build -t ghcr.io/upri-earthquake/earthquake-hub-frontend:latest .
        ```
    4. Run the container via:
        ```bash
        docker compose up
        ```

## Development Workflow: Creating New Feature
Please refer to the [contributing guide](https://upri-earthquake.github.io/dev-guide-contributing) to the entire EarthquakeHub suite.