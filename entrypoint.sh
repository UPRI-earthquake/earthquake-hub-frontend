#!/bin/sh

# Run prerequisities (import env vars)
./import-env.sh /usr/share/nginx/html/config.js

# Run the main application specified in CMD
exec "$@"
